"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSession } from "next-auth/react";

import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import { getApiBaseUrl } from "@/lib/api-base-url";
import {
  analysisStartRequestSchema,
  analysisStartResponseSchema,
  parseAnalysisStatusPayload,
  type AnalysisStatusPayload,
} from "@/lib/schemas/api";

const ACTIVE_JOB_STORAGE_KEY = "bio-dash.active-analysis-job-id";
const WS_RECONNECT_DELAY_MS = 1500;
const WS_FORBIDDEN_CLOSE_CODE = 1008;

function isActiveStatus(status: AnalysisStatusPayload["status"]) {
  return status === "started" || status === "processing";
}

function toWebSocketUrl(jobId: string, token?: string) {
  const url = new URL(`/ws/analysis/${jobId}`, getApiBaseUrl());
  if (token) {
    url.searchParams.set("token", token);
  }
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

async function readResponsePayload(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function useAnalysisRealtime() {
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatusPayload>({
    job_id: null,
    status: "idle",
    stage: "Idle",
    progress: 0,
    error: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const latestStatusRef = useRef<AnalysisStatusPayload>(analysisStatus);
  const hasBootstrappedRef = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latestStatusRef.current = analysisStatus;
  }, [analysisStatus]);

  const persistJobState = useCallback((nextStatus: AnalysisStatusPayload) => {
    if (typeof window === "undefined") {
      return;
    }

    if (nextStatus.job_id && isActiveStatus(nextStatus.status)) {
      window.localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, nextStatus.job_id);
      return;
    }

    window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }
    hasBootstrappedRef.current = true;

    let cancelled = false;

    const bootstrap = async () => {
      try {
        let nextStatus: AnalysisStatusPayload | null = null;
        const savedJobId =
          typeof window !== "undefined"
            ? window.localStorage.getItem(ACTIVE_JOB_STORAGE_KEY)
            : null;

        if (savedJobId) {
          const response = await fetchApiWithAuth(`/api/job/${savedJobId}`, {
            method: "GET",
            cache: "no-store",
          });

          if (response.status !== 404 && response.ok) {
            const payload = await readResponsePayload(response);
            nextStatus = parseAnalysisStatusPayload(payload, savedJobId);
          } else {
            window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
          }
        }

        if (!nextStatus) {
          const response = await fetchApiWithAuth("/api/run-analysis/status", {
            method: "GET",
            cache: "no-store",
          });

          if (response.ok) {
            const payload = await readResponsePayload(response);
            nextStatus = parseAnalysisStatusPayload(payload, null);
          }
        }

        if (!cancelled && nextStatus) {
          setAnalysisStatus(nextStatus);
          persistJobState(nextStatus);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [persistJobState]);

  useEffect(() => {
    const jobId = analysisStatus.job_id;
    if (!jobId) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      return;
    }

    let disposed = false;

    const connect = async () => {
      if (disposed) {
        return;
      }

      const session = await getSession();
      const accessToken = session?.accessToken;
      if (!accessToken) {
        const idleStatus: AnalysisStatusPayload = {
          job_id: null,
          status: "idle",
          stage: "Idle",
          progress: 0,
          error: null,
        };
        setAnalysisStatus(idleStatus);
        persistJobState(idleStatus);
        return;
      }

      if (socketRef.current) {
        socketRef.current.close();
      }

      const ws = new WebSocket(toWebSocketUrl(jobId, accessToken));
      socketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as unknown;
          const nextStatus = parseAnalysisStatusPayload(payload, jobId);
          setAnalysisStatus(nextStatus);
          persistJobState(nextStatus);

          if (!isActiveStatus(nextStatus.status)) {
            ws.close();
          }
        } catch {
          // Geçersiz payload geldiğinde bağlantı açık kalır.
        }
      };

      ws.onclose = (event) => {
        if (socketRef.current === ws) {
          socketRef.current = null;
        }

        if (disposed || event.code === WS_FORBIDDEN_CLOSE_CODE) {
          return;
        }

        const latest = latestStatusRef.current;
        const shouldReconnect = latest.job_id === jobId && isActiveStatus(latest.status);
        if (shouldReconnect) {
          reconnectTimerRef.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
        }
      };
    };

    void connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [analysisStatus.job_id, persistJobState]);

  const startAnalysis = useCallback(async (fileId: number, sampleId?: string) => {
    const requestPayload = analysisStartRequestSchema.safeParse({
      file_id: fileId,
      sample_id: sampleId,
    });

    if (!requestPayload.success) {
      return { ok: false as const, message: requestPayload.error.issues[0]?.message };
    }

    setIsSubmitting(true);
    try {
      const response = await fetchApiWithAuth("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload.data),
      });

      const payload = await readResponsePayload(response);
      if (!response.ok) {
        const detail =
          payload && typeof payload === "object" && "detail" in payload
            ? String(payload.detail)
            : `API error: ${response.status}`;
        return { ok: false as const, message: detail };
      }

      const parsedResponse = analysisStartResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        return { ok: false as const, message: "Analiz başlatma cevabı doğrulanamadı." };
      }

      const nextStatus: AnalysisStatusPayload = {
        job_id: parsedResponse.data.job_id,
        status: parsedResponse.data.status,
        stage: "Queued",
        progress: 0,
        error: null,
      };
      setAnalysisStatus(nextStatus);
      persistJobState(nextStatus);
      return { ok: true as const };
    } catch {
      return {
        ok: false as const,
        message: "Analiz başlatılamadı. Backend servis durumunu kontrol edin.",
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [persistJobState]);

  const runJobAction = useCallback(
    async (action: "cancel" | "retry", jobIdOverride?: string) => {
      const targetJobId = jobIdOverride ?? latestStatusRef.current.job_id;
      if (!targetJobId) {
        return { ok: false as const, message: "İşlem için aktif analiz bulunamadı." };
      }

      if (action === "cancel") {
        setIsCancelling(true);
      } else {
        setIsRetrying(true);
      }

      try {
        const response = await fetchApiWithAuth(`/api/job/${targetJobId}/${action}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const payload = await readResponsePayload(response);

        if (!response.ok) {
          const detail =
            payload && typeof payload === "object" && "detail" in payload
              ? String(payload.detail)
              : `API error: ${response.status}`;
          return { ok: false as const, message: detail };
        }

        const fallbackJobId =
          payload && typeof payload === "object" && "job_id" in payload
            ? String(payload.job_id ?? targetJobId)
            : targetJobId;
        const nextStatus = parseAnalysisStatusPayload(payload, fallbackJobId);
        setAnalysisStatus(nextStatus);
        persistJobState(nextStatus);

        return {
          ok: true as const,
          message:
            payload && typeof payload === "object" && "message" in payload
              ? String(payload.message ?? "")
              : undefined,
          jobId: nextStatus.job_id,
        };
      } catch {
        return {
          ok: false as const,
          message: "İstek tamamlanamadı. Backend servis durumunu kontrol edin.",
        };
      } finally {
        if (action === "cancel") {
          setIsCancelling(false);
        } else {
          setIsRetrying(false);
        }
      }
    },
    [persistJobState]
  );

  const cancelAnalysis = useCallback(
    async (jobIdOverride?: string) => runJobAction("cancel", jobIdOverride),
    [runJobAction]
  );

  const retryAnalysis = useCallback(
    async (jobIdOverride?: string) => runJobAction("retry", jobIdOverride),
    [runJobAction]
  );

  return {
    analysisStatus,
    isLoading,
    isSubmitting,
    isCancelling,
    isRetrying,
    startAnalysis,
    cancelAnalysis,
    retryAnalysis,
  };
}
