"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DnaIcon,
  FlaskConicalIcon,
  GitBranchPlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useActiveAnalysis } from "@/hooks/useActiveAnalysis";
import { buildAnalysisHrefForBase, parseAnalysisPath } from "@/lib/analysis-route";
import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type CompletedAnalysisItem = {
  analysisId: number;
  jobId: string;
  label: string;
  sampleId: string | null;
  fileId: number | null;
  fileName: string | null;
  analysisType: string | null;
  stage: string | null;
  updatedAt: string | null;
};

type NavigatorTab = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  tabParam?: string;
};

const ANALYSIS_TABS: NavigatorTab[] = [
  { label: "QC", href: "/qc", icon: FlaskConicalIcon },
  { label: "Genome Browser", href: "/genome-browser", icon: DnaIcon },
  {
    label: "Differential Expression",
    href: "/differential-expression",
    icon: ActivityIcon,
  },
  { label: "Pathway Map", href: "/reports", icon: GitBranchPlusIcon, tabParam: "pathway" },
];

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return "Bilinmiyor";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Bilinmiyor";
  }

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildTabHref(
  tab: NavigatorTab,
  activeAnalysisId: number | null
) {
  const params = new URLSearchParams();
  if (activeAnalysisId) {
    params.set("analysisId", String(activeAnalysisId));
  }
  if (tab.tabParam) {
    params.set("tab", tab.tabParam);
  }
  return buildAnalysisHrefForBase(tab.href, activeAnalysisId, params);
}

export function AnalysisNavigator() {
  const pathname = usePathname();
  const { activeAnalysisId, isReady, setActiveAnalysisId } = useActiveAnalysis();

  const [completedAnalyses, setCompletedAnalyses] = useState<CompletedAnalysisItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCompletedAnalyses = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const response = await fetchApiWithAuth("/api/analysis/completed?limit=120", {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => [])) as CompletedAnalysisItem[];
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            if (!cancelled) {
              setCompletedAnalyses([]);
            }
            return;
          }
          throw new Error("Tamamlanan analizler alınamadı.");
        }

        if (cancelled) {
          return;
        }

        setCompletedAnalyses(payload);

        if (isReady && activeAnalysisId === null && payload.length > 0) {
          setActiveAnalysisId(payload[0].analysisId, { replace: true, syncUrl: true });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setHasError(true);
        const message =
          error instanceof Error
            ? error.message
            : "Aktif analiz listesi yüklenemedi.";
        toast.error(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadCompletedAnalyses();
    return () => {
      cancelled = true;
    };
  }, [activeAnalysisId, isReady, setActiveAnalysisId]);

  const activeAnalysis = useMemo(
    () =>
      completedAnalyses.find((analysis) => analysis.analysisId === activeAnalysisId) ?? null,
    [activeAnalysisId, completedAnalyses]
  );
  const activeIndex = useMemo(
    () => completedAnalyses.findIndex((analysis) => analysis.analysisId === activeAnalysisId),
    [activeAnalysisId, completedAnalyses]
  );
  const previousAnalysis =
    activeIndex >= 0 && activeIndex < completedAnalyses.length - 1
      ? completedAnalyses[activeIndex + 1]
      : null;
  const nextAnalysis = activeIndex > 0 ? completedAnalyses[activeIndex - 1] : null;

  const activeLabel = activeAnalysis
    ? activeAnalysis.label
    : activeAnalysisId
      ? `Analiz #${activeAnalysisId}`
      : "Seçilmedi";

  return (
    <div className="border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="space-y-2 px-4 py-3 md:px-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-medium text-muted-foreground">Aktif Analiz:</span>
            <Badge variant="secondary" className="max-w-[260px] truncate sm:max-w-[340px]">
              {activeLabel}
            </Badge>
            {activeAnalysis?.updatedAt ? (
              <span className="text-xs text-muted-foreground">
                Güncellendi: {formatUpdatedAt(activeAnalysis.updatedAt)}
              </span>
            ) : null}
          </div>

          <div className="w-full sm:w-[320px] lg:w-[360px]">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!previousAnalysis}
                onClick={() => {
                  if (!previousAnalysis) {
                    return;
                  }
                  setActiveAnalysisId(previousAnalysis.analysisId, { replace: true, syncUrl: true });
                }}
                aria-label="Önceki analiz"
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={activeAnalysisId ? String(activeAnalysisId) : undefined}
                  onValueChange={(value) => {
                    const parsed = Number(value);
                    if (!Number.isInteger(parsed) || parsed <= 0) {
                      return;
                    }
                    setActiveAnalysisId(parsed, { replace: true, syncUrl: true });
                  }}
                  disabled={completedAnalyses.length === 0}
                >
                  <SelectTrigger aria-label="Aktif analiz seçimi">
                    <SelectValue
                      placeholder={
                        hasError
                          ? "Analiz listesi alınamadı"
                          : completedAnalyses.length === 0
                            ? "Tamamlanan analiz yok"
                            : "Tamamlanan analiz seçin"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {completedAnalyses.map((analysis) => (
                      <SelectItem key={analysis.analysisId} value={String(analysis.analysisId)}>
                        {analysis.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!nextAnalysis}
                onClick={() => {
                  if (!nextAnalysis) {
                    return;
                  }
                  setActiveAnalysisId(nextAnalysis.analysisId, { replace: true, syncUrl: true });
                }}
                aria-label="Sonraki analiz"
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <nav className="overflow-x-auto pb-1">
          <div className="flex w-max items-center gap-2 pr-2">
            {ANALYSIS_TABS.map((tab) => {
              const href = buildTabHref(tab, activeAnalysisId);
              const currentBasePath = parseAnalysisPath(pathname).basePath;
              const isActive =
                currentBasePath === tab.href;
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.label}
                  href={href}
                  className={cn(
                    "inline-flex items-center whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-zinc-200 text-muted-foreground hover:border-zinc-300 hover:bg-muted/30 dark:border-zinc-800 dark:hover:border-zinc-700"
                  )}
                >
                  <Icon className="mr-1.5 size-3.5" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
