"use client";

import { getSession, signOut } from "next-auth/react";

import { getApiBaseUrlCandidates } from "@/lib/api-base-url";

const BACKEND_TOKEN_ENDPOINT = "/api/auth/backend-token";
let isSessionResetInProgress = false;

async function resolveAccessToken() {
  const session = await getSession();
  if (session?.accessToken) {
    return session.accessToken;
  }

  try {
    const response = await fetch(BACKEND_TOKEN_ENDPOINT, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { accessToken?: string };
    if (typeof payload.accessToken === "string" && payload.accessToken.length > 0) {
      return payload.accessToken;
    }
  } catch {
    return null;
  }

  return null;
}

async function buildAuthHeaders(headers?: HeadersInit) {
  const merged = new Headers(headers ?? {});
  const accessToken = await resolveAccessToken();

  if (accessToken) {
    merged.set("Authorization", `Bearer ${accessToken}`);
  }

  return merged;
}

export async function fetchApiWithAuth(path: string, init?: RequestInit) {
  const headers = await buildAuthHeaders(init?.headers);
  const baseUrls = getApiBaseUrlCandidates();
  let response: Response | null = null;
  let lastNetworkError: unknown = null;

  for (const baseUrl of baseUrls) {
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
      });
      break;
    } catch (error) {
      lastNetworkError = error;
      continue;
    }
  }

  if (!response && typeof window !== "undefined") {
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    try {
      response = await fetch(`/api/backend/${normalizedPath}`, {
        ...init,
        headers,
      });
    } catch (proxyError) {
      lastNetworkError = proxyError;
    }
  }

  if (!response) {
    if (lastNetworkError instanceof Error) {
      throw lastNetworkError;
    }
    throw new Error("API sunucusuna bağlanılamadı.");
  }

  if (
    response.status === 401 &&
    typeof window !== "undefined" &&
    !isSessionResetInProgress
  ) {
    isSessionResetInProgress = true;
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const callbackUrl = currentPath.startsWith("/") ? currentPath : "/dashboard";

    void signOut({
      callbackUrl: `/login?reauth=1&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    }).finally(() => {
      isSessionResetInProgress = false;
    });
  }

  return response;
}
