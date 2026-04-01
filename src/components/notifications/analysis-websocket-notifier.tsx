"use client";

import { useEffect, useRef, useState } from "react";
import { getSession } from "next-auth/react";
import { toast } from "sonner";

import { useNotifications } from "@/components/notifications/notification-provider";
import { getApiBaseUrl } from "@/lib/api-base-url";
import {
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

export function AnalysisWebsocketNotifier() {
  const { addNotification } = useNotifications();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStatusRef = useRef<AnalysisStatusPayload | null>(null);
  const emittedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncActiveJob = () => {
      const current = window.localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
      setActiveJobId((prev) => (prev === current ? prev : current));
    };

    syncActiveJob();

    const intervalId = window.setInterval(syncActiveJob, 1200);
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_JOB_STORAGE_KEY) {
        syncActiveJob();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!activeJobId) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      latestStatusRef.current = null;
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
        return;
      }

      if (socketRef.current) {
        socketRef.current.close();
      }

      const ws = new WebSocket(toWebSocketUrl(activeJobId, accessToken));
      socketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as unknown;
          const nextStatus = parseAnalysisStatusPayload(payload, activeJobId);
          latestStatusRef.current = nextStatus;

          const statusKey = `${activeJobId}:${nextStatus.status}`;
          if (nextStatus.status === "completed" && !emittedRef.current.has(statusKey)) {
            emittedRef.current.add(statusKey);
            const jobSuffix = activeJobId.slice(-6).toUpperCase();
            const title = `Analiz #${jobSuffix} başarıyla tamamlandı`;
            const description = "Pipeline tüm aşamalarıyla başarıyla sonlandı.";
            addNotification({ title, description });
            toast.success(title, { description });
          }

          if (nextStatus.status === "failed" && !emittedRef.current.has(statusKey)) {
            emittedRef.current.add(statusKey);
            const jobSuffix = activeJobId.slice(-6).toUpperCase();
            const title = `Analiz #${jobSuffix} başarısız oldu`;
            const description = nextStatus.error ?? "Pipeline çalışması sırasında hata alındı.";
            addNotification({ title, description });
            toast.error(title, { description });
          }

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
        const shouldReconnect =
          latest?.job_id === activeJobId && isActiveStatus(latest.status);

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
  }, [activeJobId, addNotification]);

  return null;
}
