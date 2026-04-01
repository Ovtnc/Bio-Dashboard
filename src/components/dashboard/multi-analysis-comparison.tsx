"use client";

import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { CheckIcon, DatabaseIcon, GitCompareArrowsIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { useGeneBasket } from "@/components/providers/gene-basket-provider";
import { useTheme } from "@/components/theme-provider";
import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type ApiDifferentialExpressionRow = {
  GenID: string;
  log2FoldChange: number;
  p_value: number;
  adjustedPValue?: number;
  expressionLevel?: number;
};

type DifferentialExpressionRow = {
  genId: string;
  log2FoldChange: number;
  pValue: number;
  adjustedPValue: number;
  expressionLevel: number;
};

type ComboBar = {
  mask: number;
  count: number;
  label: string;
  comboTitle: string;
};

function toExpressionLevel(log2FoldChange: number, pValue: number, index: number) {
  const baseline = 1200;
  const foldImpact = Math.abs(log2FoldChange) * 2100;
  const significanceImpact = (1 - pValue / 0.05) * 6500;
  const variance = (index % 13) * 137;
  return Math.max(250, Math.round(baseline + foldImpact + significanceImpact + variance));
}

function calculateAdjustedPValues(values: number[]) {
  const size = values.length;
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);

  const adjusted = new Array(size).fill(1);
  let runningMin = 1;

  for (let i = size - 1; i >= 0; i -= 1) {
    const rank = i + 1;
    const candidate = Math.min(1, (sorted[i].value * size) / rank);
    runningMin = Math.min(runningMin, candidate);
    adjusted[sorted[i].index] = Number(runningMin.toFixed(6));
  }

  return adjusted;
}

function normalizeRows(payload: ApiDifferentialExpressionRow[]) {
  const sanitized = payload.map((item) => ({
    genId: String(item.GenID ?? "").trim().toUpperCase(),
    log2FoldChange: Number(item.log2FoldChange),
    pValue: Number(item.p_value),
    adjustedPValue: item.adjustedPValue !== undefined ? Number(item.adjustedPValue) : undefined,
    expressionLevel: item.expressionLevel !== undefined ? Number(item.expressionLevel) : undefined,
  }));

  const adjustedValues = calculateAdjustedPValues(sanitized.map((row) => row.pValue));

  return sanitized
    .map((row, index): DifferentialExpressionRow => ({
      genId: row.genId,
      log2FoldChange: row.log2FoldChange,
      pValue: row.pValue,
      adjustedPValue:
        row.adjustedPValue !== undefined ? row.adjustedPValue : adjustedValues[index],
      expressionLevel:
        row.expressionLevel !== undefined
          ? row.expressionLevel
          : toExpressionLevel(row.log2FoldChange, row.pValue, index),
    }))
    .filter((row) => row.genId.length > 0 && Number.isFinite(row.pValue));
}

function popcount(value: number) {
  let count = 0;
  let n = value;
  while (n > 0) {
    n &= n - 1;
    count += 1;
  }
  return count;
}

function shortLabel(item: CompletedAnalysisItem, index: number) {
  const core = item.sampleId || item.fileName || `Analysis-${item.analysisId}`;
  const compact = core.length > 16 ? `${core.slice(0, 16)}…` : core;
  return `A${index + 1} · ${compact}`;
}

export function MultiAnalysisComparison() {
  const { resolvedTheme } = useTheme();
  const { createBasket } = useGeneBasket();
  const isDark = resolvedTheme === "dark";

  const [analyses, setAnalyses] = useState<CompletedAnalysisItem[]>([]);
  const [selectedAnalysisIds, setSelectedAnalysisIds] = useState<number[]>([]);
  const [rowsByAnalysis, setRowsByAnalysis] = useState<Record<number, DifferentialExpressionRow[]>>({});
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAnalyses = async () => {
      setIsLoadingAnalyses(true);
      try {
        const response = await fetchApiWithAuth("/api/analysis/completed?limit=120", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => [])) as CompletedAnalysisItem[];

        if (!response.ok) {
          throw new Error("Tamamlanan analiz listesi alınamadı.");
        }

        if (!cancelled) {
          setAnalyses(payload);
          if (payload.length >= 2) {
            setSelectedAnalysisIds(payload.slice(0, 2).map((item) => item.analysisId));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setAnalyses([]);
          setSelectedAnalysisIds([]);
          const message =
            error instanceof Error
              ? error.message
              : "Kıyaslama için analiz listesi yüklenemedi.";
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAnalyses(false);
        }
      }
    };

    void loadAnalyses();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedAnalysisIds.length < 2) {
      setRowsByAnalysis({});
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const loadRows = async () => {
      setIsLoadingRows(true);
      try {
        const resultPairs = await Promise.all(
          selectedAnalysisIds.map(async (analysisId) => {
            const response = await fetchApiWithAuth(
              `/api/analysis/differential-expression?analysis_id=${analysisId}`,
              {
                method: "GET",
                cache: "no-store",
                signal: controller.signal,
              }
            );

            if (!response.ok) {
              throw new Error(`Analiz #${analysisId} verisi alınamadı.`);
            }

            const payload = (await response.json().catch(() => [])) as ApiDifferentialExpressionRow[];
            return [analysisId, normalizeRows(payload)] as const;
          })
        );

        if (!cancelled) {
          setRowsByAnalysis(Object.fromEntries(resultPairs));
        }
      } catch (error) {
        if (controller.signal.aborted || cancelled) {
          return;
        }

        setRowsByAnalysis({});
        const message =
          error instanceof Error
            ? error.message
            : "Analiz kıyaslama verisi yüklenemedi.";
        toast.error(message);
      } finally {
        if (!cancelled) {
          setIsLoadingRows(false);
        }
      }
    };

    void loadRows();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedAnalysisIds]);

  const selectedAnalyses = useMemo(
    () =>
      selectedAnalysisIds
        .map((id) => analyses.find((item) => item.analysisId === id))
        .filter((item): item is CompletedAnalysisItem => Boolean(item)),
    [analyses, selectedAnalysisIds]
  );

  const analysisTags = useMemo(
    () => selectedAnalyses.map((item, index) => ({
      id: item.analysisId,
      tag: `A${index + 1}`,
      label: shortLabel(item, index),
      fullLabel: item.label,
    })),
    [selectedAnalyses]
  );

  const rowMapsByAnalysis = useMemo(() => {
    const maps: Record<number, Map<string, DifferentialExpressionRow>> = {};
    selectedAnalysisIds.forEach((analysisId) => {
      maps[analysisId] = new Map(
        (rowsByAnalysis[analysisId] ?? []).map((row) => [row.genId, row])
      );
    });
    return maps;
  }, [rowsByAnalysis, selectedAnalysisIds]);

  const comparisonModel = useMemo(() => {
    if (selectedAnalysisIds.length < 2) {
      return {
        commonGenes: [] as string[],
        upsetBars: [] as ComboBar[],
        upsetMatrix: [] as number[][],
        heatmapGenes: [] as string[],
        heatmapMatrix: [] as Array<Array<number | null>>,
      };
    }

    const selectedSets = selectedAnalysisIds.map((analysisId) => {
      const rows = rowsByAnalysis[analysisId] ?? [];
      return new Set(rows.map((row) => row.genId));
    });

    const fullMask = (1 << selectedSets.length) - 1;
    const geneMaskMap = new Map<string, number>();

    selectedSets.forEach((geneSet, index) => {
      const bit = 1 << index;
      geneSet.forEach((gene) => {
        geneMaskMap.set(gene, (geneMaskMap.get(gene) ?? 0) | bit);
      });
    });

    const commonGenes = Array.from(geneMaskMap.entries())
      .filter(([, mask]) => mask === fullMask)
      .map(([gene]) => gene)
      .sort((a, b) => a.localeCompare(b));

    const comboCounts = new Map<number, number>();
    geneMaskMap.forEach((mask) => {
      if (popcount(mask) < 2) {
        return;
      }
      comboCounts.set(mask, (comboCounts.get(mask) ?? 0) + 1);
    });

    const upsetBars = Array.from(comboCounts.entries())
      .map(([mask, count]) => {
        const members = analysisTags
          .filter((_, idx) => (mask & (1 << idx)) !== 0)
          .map((item) => item.tag);
        const titles = analysisTags
          .filter((_, idx) => (mask & (1 << idx)) !== 0)
          .map((item) => item.fullLabel);
        return {
          mask,
          count,
          label: members.join(" ∩ "),
          comboTitle: titles.join(" + "),
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const upsetMatrix = analysisTags.map((_, rowIndex) =>
      upsetBars.map((combo) => ((combo.mask & (1 << rowIndex)) !== 0 ? 1 : 0))
    );

    const geneStats = new Map<string, { minP: number; maxAbsFc: number }>();
    selectedAnalysisIds.forEach((analysisId) => {
      (rowsByAnalysis[analysisId] ?? []).forEach((row) => {
        const current = geneStats.get(row.genId);
        if (!current) {
          geneStats.set(row.genId, {
            minP: row.pValue,
            maxAbsFc: Math.abs(row.log2FoldChange),
          });
          return;
        }

        current.minP = Math.min(current.minP, row.pValue);
        current.maxAbsFc = Math.max(current.maxAbsFc, Math.abs(row.log2FoldChange));
      });
    });

    const heatmapGenes = Array.from(geneStats.entries())
      .map(([gene, metric]) => ({
        gene,
        score: -Math.log10(Math.max(metric.minP, 1e-12)) + metric.maxAbsFc,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((item) => item.gene);

    const heatmapMatrix = heatmapGenes.map((gene) =>
      selectedAnalysisIds.map((analysisId) => {
        const row = rowMapsByAnalysis[analysisId]?.get(gene);
        if (!row) {
          return null;
        }
        return row.expressionLevel;
      })
    );

    return {
      commonGenes,
      upsetBars,
      upsetMatrix,
      heatmapGenes,
      heatmapMatrix,
    };
  }, [analysisTags, rowMapsByAnalysis, rowsByAnalysis, selectedAnalysisIds]);

  const hasEnoughSelection = selectedAnalysisIds.length >= 2;
  const upsetMaxCount = useMemo(
    () =>
      Math.max(
        1,
        ...comparisonModel.upsetBars.map((item) =>
          Number.isFinite(item.count) ? item.count : 0
        )
      ),
    [comparisonModel.upsetBars]
  );

  const selectedSummaryLabel =
    selectedAnalysisIds.length === 0
      ? "Analiz seçilmedi"
      : `${selectedAnalysisIds.length} analiz seçildi`;

  const saveCommonAsBasket = () => {
    if (comparisonModel.commonGenes.length === 0) {
      toast.info("Ortak gen bulunamadığı için yeni sepet oluşturulamadı.");
      return;
    }

    createBasket(comparisonModel.commonGenes, {
      source: `multi-analysis:${selectedAnalysisIds.join(",")}`,
      analysisId: null,
    });
    toast.success(`${comparisonModel.commonGenes.length} ortak gen yeni sepete kaydedildi.`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <GitCompareArrowsIcon className="size-4 text-primary" />
          Multi-Analysis Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card className="overflow-hidden border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Analiz Seçimi</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {isLoadingAnalyses ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Skeleton key={`analysis-select-skeleton-${idx}`} className="h-8 w-full" />
                  ))}
                </div>
              ) : analyses.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Kıyaslama için tamamlanmış analiz bulunamadı.
                </div>
              ) : (
                <Command className="rounded-md border">
                  <CommandInput placeholder="Analiz ara..." />
                  <CommandList>
                    <CommandEmpty>Analiz bulunamadı.</CommandEmpty>
                    <CommandGroup heading="Tamamlanan Analizler">
                      {analyses.map((analysis) => {
                        const selected = selectedAnalysisIds.includes(analysis.analysisId);
                        return (
                          <CommandItem
                            key={analysis.analysisId}
                            value={`${analysis.label} ${analysis.sampleId ?? ""} ${analysis.analysisId}`}
                            onSelect={() => {
                              setSelectedAnalysisIds((previous) => {
                                if (previous.includes(analysis.analysisId)) {
                                  return previous.filter((id) => id !== analysis.analysisId);
                                }
                                return [...previous, analysis.analysisId];
                              });
                            }}
                            className="justify-between"
                          >
                            <span className="truncate pr-2 text-xs md:text-sm">{analysis.label}</span>
                            {selected ? <CheckIcon className="size-4 text-emerald-500" /> : null}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Kıyaslama Özeti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{selectedSummaryLabel}</Badge>
                <Badge variant="outline">
                  Ortak Gen: {comparisonModel.commonGenes.length.toLocaleString("tr-TR")}
                </Badge>
                <Badge variant="outline">
                  Kesişim Kombinasyonu: {comparisonModel.upsetBars.length.toLocaleString("tr-TR")}
                </Badge>
                <Badge variant="outline">
                  Heatmap Geni: {comparisonModel.heatmapGenes.length.toLocaleString("tr-TR")}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {analysisTags.map((item) => (
                  <Badge key={item.id} variant="outline" className="max-w-[240px] truncate">
                    {item.label}
                  </Badge>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={saveCommonAsBasket}
                disabled={!hasEnoughSelection || comparisonModel.commonGenes.length === 0}
              >
                <SaveIcon className="mr-2 size-4" />
                Ortak Genleri Yeni Bir Sepet Olarak Kaydet
              </Button>
            </CardContent>
          </Card>
        </div>

        {!hasEnoughSelection ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Upset Plot ve Comparative Heatmap için en az 2 analiz seçin.
          </div>
        ) : isLoadingRows ? (
          <div className="grid gap-4">
            <Skeleton className="h-[320px] w-full" />
            <Skeleton className="h-[380px] w-full" />
          </div>
        ) : (
          <div className="grid gap-4">
            <Card style={{ height: "250px" }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Upset Plot (Kesişim Analizi)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {comparisonModel.upsetBars.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Seçili analizlerde çoklu kesişim kombinasyonu bulunamadı.
                  </div>
                ) : (
                  <>
                    <Plot
                      data={[
                        {
                          type: "bar",
                          x: comparisonModel.upsetBars.map((item) => item.label),
                          y: comparisonModel.upsetBars.map((item) => item.count),
                          marker: {
                            color: isDark ? "#22d3ee" : "#0891b2",
                            line: {
                              color: isDark ? "#155e75" : "#164e63",
                              width: 1,
                            },
                          },
                          opacity: 0.95,
                          customdata: comparisonModel.upsetBars.map((item) => item.comboTitle),
                          hovertemplate:
                            "<b>%{x}</b><br>Kesişim Gen Sayısı: %{y}<br>%{customdata}<extra></extra>",
                        },
                      ]}
                      layout={{
                        autosize: true,
                        paper_bgcolor: "transparent",
                        plot_bgcolor: "transparent",
                        margin: { l: 92, r: 28, t: 36, b: 126 },
                        bargap: 0.35,
                        font: {
                          color: isDark ? "#e4e4e7" : "#27272a",
                        },
                        xaxis: {
                          title: { text: "Analiz Kesişim Kombinasyonları" },
                          tickangle: -20,
                          automargin: true,
                          tickfont: { size: 11 },
                          type: "category",
                          categoryorder: "array",
                          categoryarray: comparisonModel.upsetBars.map((item) => item.label),
                          gridcolor: isDark ? "#3f3f46" : "#e4e4e7",
                        },
                        yaxis: {
                          title: { text: "Gen Sayısı" },
                          automargin: true,
                          range: [0, Math.max(2, Math.ceil(upsetMaxCount * 1.2))],
                          tick0: 0,
                          dtick: upsetMaxCount <= 20 ? 1 : undefined,
                          tickformat: "d",
                          ticks: "outside",
                          ticklen: 6,
                          gridcolor: isDark ? "#3f3f46" : "#e4e4e7",
                        },
                      }}
                      config={{
                        responsive: true,
                        displaylogo: false,
                        displayModeBar: false,
                        modeBarButtonsToRemove: ["lasso2d", "select2d"],
                      }}
                      className="h-[520px] w-full"
                      useResizeHandler
                      style={{ width: "100%", height: "100%" }}
                    />

                    {comparisonModel.upsetBars.length >= 2 ? (
                      <Plot
                        data={[
                          {
                            type: "heatmap",
                            z: comparisonModel.upsetMatrix,
                            x: comparisonModel.upsetBars.map((item) => item.label),
                            y: analysisTags.map((item) => item.tag),
                            colorscale: [
                              [0, isDark ? "rgba(63,63,70,0.25)" : "rgba(212,212,216,0.65)"],
                              [1, isDark ? "#22d3ee" : "#0891b2"],
                            ],
                            zmin: 0,
                            zmax: 1,
                            showscale: false,
                            hovertemplate: "<b>%{y}</b><br>%{x}<br>Üyelik: %{z}<extra></extra>",
                          },
                        ]}
                        layout={{
                          autosize: true,
                          paper_bgcolor: "transparent",
                          plot_bgcolor: "transparent",
                          margin: { l: 84, r: 20, t: 12, b: 72 },
                          font: {
                            color: isDark ? "#e4e4e7" : "#27272a",
                          },
                          xaxis: {
                            title: { text: "Kombinasyon" },
                            tickangle: -20,
                            automargin: true,
                            tickfont: { size: 11 },
                          },
                          yaxis: {
                            title: { text: "Analiz" },
                            automargin: true,
                            tickfont: { size: 12 },
                          },
                        }}
                        config={{
                          responsive: true,
                          displaylogo: false,
                          modeBarButtonsToRemove: ["lasso2d", "select2d"],
                        }}
                        className="h-[320px] w-full"
                        useResizeHandler
                        style={{ width: "100%", height: "100%" }}
                      />
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Matrix görünümü için en az 2 kesişim kombinasyonu gerekir. Şu an yalnızca{" "}
                        <span className="font-medium">
                          {comparisonModel.upsetBars.length.toLocaleString("tr-TR")}
                        </span>{" "}
                        kombinasyon bulundu.
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <DatabaseIcon className="size-4 text-primary" />
                  Comparative Heatmap (Top 50 Gene Expression)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {comparisonModel.heatmapGenes.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Heatmap için yeterli diferansiyel ifade verisi bulunamadı.
                  </div>
                ) : (
                  <Plot
                    data={[
                      {
                        type: "heatmap",
                        z: comparisonModel.heatmapMatrix,
                        x: analysisTags.map((item) => item.tag),
                        y: comparisonModel.heatmapGenes,
                        colorscale: "YlGnBu",
                        hovertemplate:
                          "<b>%{y}</b><br>Analiz: %{x}<br>Expression Level: %{z}<extra></extra>",
                        colorbar: {
                          title: { text: "Expression" },
                        },
                      },
                    ]}
                    layout={{
                      autosize: true,
                      paper_bgcolor: "transparent",
                      plot_bgcolor: "transparent",
                      margin: { l: 96, r: 28, t: 8, b: 48 },
                      font: {
                        color: isDark ? "#e4e4e7" : "#27272a",
                      },
                      xaxis: {
                        title: { text: "Analizler" },
                      },
                      yaxis: {
                        title: { text: "Top 50 Gen" },
                        automargin: true,
                      },
                    }}
                    config={{
                      responsive: true,
                      displaylogo: false,
                      modeBarButtonsToRemove: ["lasso2d", "select2d"],
                    }}
                    className="h-[620px] w-full"
                    useResizeHandler
                    style={{ width: "100%", height: "100%" }}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
