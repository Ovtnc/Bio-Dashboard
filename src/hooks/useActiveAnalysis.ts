"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  buildAnalysisScopedUrl,
  parseAnalysisPath,
  parsePositiveInt,
} from "@/lib/analysis-route";

const ACTIVE_ANALYSIS_PARAM = "analysisId";
const ACTIVE_ANALYSIS_STORAGE_KEY = "bio-dash.active-analysis-id";

type SetActiveAnalysisOptions = {
  syncUrl?: boolean;
  replace?: boolean;
};

export function useActiveAnalysis() {
  const pathname = usePathname();
  const router = useRouter();

  const [activeAnalysisId, setActiveAnalysisState] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const currentSearch = typeof window === "undefined" ? "" : window.location.search;
      const normalizedSearch = currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch;
      const currentParams = new URLSearchParams(normalizedSearch);
      const queryAnalysisId = parsePositiveInt(currentParams.get(ACTIVE_ANALYSIS_PARAM));
      const pathScope = parseAnalysisPath(pathname);
      const pathAnalysisId = pathScope.analysisIdFromPath;
      const storedAnalysisId = parsePositiveInt(
        window.localStorage.getItem(ACTIVE_ANALYSIS_STORAGE_KEY)
      );
      const resolvedAnalysisId = queryAnalysisId ?? pathAnalysisId ?? storedAnalysisId;

      setActiveAnalysisState((previous) =>
        previous === resolvedAnalysisId ? previous : resolvedAnalysisId
      );

      if (resolvedAnalysisId !== null) {
        window.localStorage.setItem(ACTIVE_ANALYSIS_STORAGE_KEY, String(resolvedAnalysisId));
      }

      const nextUrl = buildAnalysisScopedUrl(pathname, currentParams, resolvedAnalysisId);
      const currentUrl = normalizedSearch ? `${pathname}?${normalizedSearch}` : pathname;
      if (nextUrl !== currentUrl) {
        router.replace(nextUrl, { scroll: false });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const setActiveAnalysisId = useCallback(
    (nextAnalysisId: number | null, options?: SetActiveAnalysisOptions) => {
      const normalized = nextAnalysisId && nextAnalysisId > 0 ? Math.trunc(nextAnalysisId) : null;
      const syncUrl = options?.syncUrl ?? true;
      const replace = options?.replace ?? true;

      setActiveAnalysisState(normalized);

      if (typeof window !== "undefined") {
        if (normalized === null) {
          window.localStorage.removeItem(ACTIVE_ANALYSIS_STORAGE_KEY);
        } else {
          window.localStorage.setItem(ACTIVE_ANALYSIS_STORAGE_KEY, String(normalized));
        }
      }

      if (!syncUrl) {
        return;
      }

      const currentParams =
        typeof window === "undefined"
          ? new URLSearchParams()
          : new URLSearchParams(window.location.search);
      const nextUrl = buildAnalysisScopedUrl(pathname, currentParams, normalized);
      if (replace) {
        router.replace(nextUrl, { scroll: false });
      } else {
        router.push(nextUrl, { scroll: false });
      }
    },
    [pathname, router]
  );

  return useMemo(
    () => ({
      activeAnalysisId,
      isReady: true,
      setActiveAnalysisId,
      paramKey: ACTIVE_ANALYSIS_PARAM,
    }),
    [activeAnalysisId, setActiveAnalysisId]
  );
}
