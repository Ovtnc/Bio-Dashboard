export const ANALYSIS_SEGMENT_BASE_PATHS = ["/qc", "/genome-browser", "/reports"] as const;

export function parsePositiveInt(rawValue: string | null | undefined): number | null {
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function parseAnalysisPath(pathname: string) {
  const normalizedPath = pathname || "/";

  for (const basePath of ANALYSIS_SEGMENT_BASE_PATHS) {
    if (normalizedPath === basePath) {
      return {
        basePath,
        supportsSegment: true,
        analysisIdFromPath: null as number | null,
      };
    }

    if (normalizedPath.startsWith(`${basePath}/`)) {
      const rest = normalizedPath.slice(basePath.length + 1);
      const firstSegment = rest.split("/")[0] ?? "";
      return {
        basePath,
        supportsSegment: true,
        analysisIdFromPath: parsePositiveInt(firstSegment),
      };
    }
  }

  return {
    basePath: normalizedPath,
    supportsSegment: false,
    analysisIdFromPath: null as number | null,
  };
}

export function buildAnalysisScopedUrl(
  pathname: string,
  searchParams: URLSearchParams,
  analysisId: number | null
) {
  const scope = parseAnalysisPath(pathname);
  const nextParams = new URLSearchParams(searchParams.toString());
  nextParams.delete("analysisId");

  let nextPath = pathname;
  if (scope.supportsSegment) {
    nextPath = analysisId ? `${scope.basePath}/${analysisId}` : scope.basePath;
  } else {
    if (analysisId !== null) {
      nextParams.set("analysisId", String(analysisId));
    }
  }

  const query = nextParams.toString();
  return query ? `${nextPath}?${query}` : nextPath;
}

export function buildAnalysisHrefForBase(
  basePath: string,
  analysisId: number | null,
  params?: URLSearchParams
) {
  const scope = parseAnalysisPath(basePath);
  const nextParams = new URLSearchParams(params?.toString() ?? "");
  nextParams.delete("analysisId");

  let nextPath = basePath;
  if (scope.supportsSegment) {
    nextPath = analysisId ? `${scope.basePath}/${analysisId}` : scope.basePath;
  } else if (analysisId !== null) {
    nextParams.set("analysisId", String(analysisId));
  }

  const query = nextParams.toString();
  return query ? `${nextPath}?${query}` : nextPath;
}
