import { NextRequest } from "next/server";

const RAW_BACKEND_BASE_URL =
  process.env.INTERNAL_BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function resolveBackendBaseUrl() {
  const configured = stripTrailingSlash(RAW_BACKEND_BASE_URL);
  try {
    const parsed = new URL(configured);
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
    }
    return stripTrailingSlash(parsed.toString());
  } catch {
    return configured;
  }
}

function buildTargetUrl(request: NextRequest, pathSegments: string[]) {
  const backendBase = resolveBackendBaseUrl();
  const path = pathSegments.join("/");
  const search = new URL(request.url).search;
  return `${backendBase}/${path}${search}`;
}

function shouldForwardBody(method: string) {
  const upperMethod = method.toUpperCase();
  return upperMethod !== "GET" && upperMethod !== "HEAD";
}

async function forward(request: NextRequest, pathSegments: string[]) {
  const targetUrl = buildTargetUrl(request, pathSegments);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  let body: BodyInit | undefined;
  if (shouldForwardBody(request.method)) {
    const contentLength = request.headers.get("content-length");
    const hasBody = contentLength ? Number(contentLength) > 0 : true;
    if (hasBody) {
      const rawBody = await request.arrayBuffer();
      if (rawBody.byteLength > 0) {
        body = rawBody;
      }
    }
  }

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
    cache: "no-store",
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("connection");
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return forward(request, path);
}
