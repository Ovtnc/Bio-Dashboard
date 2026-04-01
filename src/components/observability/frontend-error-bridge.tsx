"use client";

import { useEffect, useRef } from "react";

import { getApiBaseUrl } from "@/lib/api-base-url";

type ClientLogPayload = {
  source: "frontend";
  category: string;
  severity: "P0" | "P1" | "P2" | "P3";
  message: string;
  path?: string;
  stack?: string;
  context?: Record<string, unknown>;
};

function classifySeverity(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("out of memory")
    || normalized.includes("security")
    || normalized.includes("token")
    || normalized.includes("unauthorized")
  ) {
    return "P0" as const;
  }
  if (normalized.includes("failed") || normalized.includes("error")) {
    return "P1" as const;
  }
  return "P2" as const;
}

function sendClientLog(payload: ClientLogPayload) {
  const endpoint = `${getApiBaseUrl()}/api/observability/client-log`;
  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(endpoint, blob);
    return;
  }

  void fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  });
}

export function FrontendErrorBridge() {
  const dedupeRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const message = event.message || "Bilinmeyen frontend hatası";
      const dedupeKey = `${window.location.pathname}:${message}`;
      if (dedupeRef.current.has(dedupeKey)) {
        return;
      }
      dedupeRef.current.add(dedupeKey);

      sendClientLog({
        source: "frontend",
        category: "ui.runtime",
        severity: classifySeverity(message),
        message,
        path: window.location.pathname,
        stack: event.error instanceof Error ? event.error.stack : undefined,
        context: {
          file: event.filename,
          line: event.lineno,
          column: event.colno,
          userAgent: navigator.userAgent,
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";
      const dedupeKey = `${window.location.pathname}:promise:${message}`;
      if (dedupeRef.current.has(dedupeKey)) {
        return;
      }
      dedupeRef.current.add(dedupeKey);

      sendClientLog({
        source: "frontend",
        category: "ui.promise",
        severity: classifySeverity(message),
        message,
        path: window.location.pathname,
        stack: reason instanceof Error ? reason.stack : undefined,
        context: {
          userAgent: navigator.userAgent,
        },
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

