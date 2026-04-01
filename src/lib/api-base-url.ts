const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function toUnique(values: string[]) {
  return Array.from(new Set(values.map((value) => stripTrailingSlash(value).trim()).filter(Boolean)));
}

export function getApiBaseUrlCandidates() {
  const configured = stripTrailingSlash(DEFAULT_API_BASE_URL);

  if (typeof window === "undefined") {
    return [configured];
  }

  try {
    const url = new URL(configured);
    const currentHostname = window.location.hostname;
    const candidates: string[] = [];

    if (isLoopbackHost(url.hostname) && !isLoopbackHost(currentHostname)) {
      const lanUrl = new URL(configured);
      lanUrl.hostname = currentHostname;
      candidates.push(stripTrailingSlash(lanUrl.toString()));
      candidates.push(configured);
      return toUnique(candidates);
    }

    if (!isLoopbackHost(url.hostname) && isLoopbackHost(currentHostname)) {
      candidates.push(configured);
      const localUrl = new URL(configured);
      localUrl.hostname = "localhost";
      candidates.push(stripTrailingSlash(localUrl.toString()));
      return toUnique(candidates);
    }

    candidates.push(stripTrailingSlash(url.toString()));
    return toUnique(candidates);
  } catch {
    return [configured];
  }
}

export function getApiBaseUrl() {
  const [first] = getApiBaseUrlCandidates();
  return first ?? stripTrailingSlash(DEFAULT_API_BASE_URL);
}
