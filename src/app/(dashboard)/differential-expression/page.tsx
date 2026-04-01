"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ColumnFiltersState,
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDownIcon, DownloadIcon, FilePlus2Icon } from "lucide-react";
import { toast } from "sonner";

import { useGeneBasket } from "@/components/providers/gene-basket-provider";
import { useTheme } from "@/components/theme-provider";
import { useBioData, type DifferentialExpressionRow } from "@/hooks/useBioData";
import { useActiveAnalysis } from "@/hooks/useActiveAnalysis";
import {
  GLOBAL_GENE_SEARCH_EVENT,
  readStoredGeneSearch,
  type GeneSearchEventPayload,
} from "@/lib/gene-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TermTooltip } from "@/components/ui/term-tooltip";
import { PlotCodeExport } from "@/components/plots/plot-code-export";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <Skeleton className="h-[420px] w-full" />
  ),
});

function formatPValue(value: number) {
  if (value < 0.001) {
    return value.toExponential(2);
  }

  return value.toFixed(4);
}

function PValueBadge({ value }: { value: number }) {
  const isLow = value < 0.05;

  return (
    <Badge
      className={
        isLow
          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
          : "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/20"
      }
      variant="secondary"
    >
      {formatPValue(value)}
    </Badge>
  );
}

function DifferentialExpressionContent() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [smartPValueMax, setSmartPValueMax] = useState<number | null>(null);
  const [smartFoldChangeMin, setSmartFoldChangeMin] = useState<number | null>(null);
  const [selectedPlotGene, setSelectedPlotGene] = useState<string | null>(null);
  const { activeAnalysisId } = useActiveAnalysis();
  const { toggleGene, hasGene } = useGeneBasket();
  const { resolvedTheme } = useTheme();
  const { data, isLoading, error } = useBioData(true, activeAnalysisId);
  const hasShownErrorToast = useRef(false);
  const searchParams = useSearchParams();
  const [plotThemeStyle, setPlotThemeStyle] = useState({
    fontColor: "#27272a",
    gridColor: "#e4e4e7",
    zeroLineColor: "#d4d4d8",
  });

  useEffect(() => {
    if (error && !hasShownErrorToast.current) {
      toast.error("Analiz verisi alınamadı. Backend servisini kontrol edin.");
      hasShownErrorToast.current = true;
    }
  }, [error]);

  useEffect(() => {
    if (resolvedTheme === "dark") {
      setPlotThemeStyle({
        fontColor: "#f4f4f5",
        gridColor: "#3f3f46",
        zeroLineColor: "#52525b",
      });
      return;
    }

    setPlotThemeStyle({
      fontColor: "#27272a",
      gridColor: "#e4e4e7",
      zeroLineColor: "#d4d4d8",
    });
  }, [resolvedTheme]);

  const volcanoPoints = useMemo(
    () =>
      data.map((row) => {
        const negLog10PValue = -Math.log10(row.pValue);
        const status =
          row.pValue < 0.05 && row.log2FoldChange > 1
            ? "up"
            : row.pValue < 0.05 && row.log2FoldChange < -1
              ? "down"
              : "neutral";

        return {
          ...row,
          negLog10PValue,
          status,
        };
      }),
    [data]
  );

  const upRegulated = volcanoPoints.filter((point) => point.status === "up");
  const downRegulated = volcanoPoints.filter((point) => point.status === "down");
  const neutral = volcanoPoints.filter((point) => point.status === "neutral");

  const columns = useMemo<ColumnDef<DifferentialExpressionRow>[]>(
    () => [
      {
        accessorKey: "genId",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Gen ID
            <ArrowUpDownIcon className="ml-2 size-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={hasGene(row.original.genId) ? "default" : "ghost"}
              size="icon-sm"
              onClick={() =>
                toggleGene({
                  geneId: row.original.genId,
                  analysisId: activeAnalysisId,
                  source: "differential-expression-table",
                })
              }
              aria-label={`${row.original.genId} genini sepete ekle`}
            >
              <FilePlus2Icon className="size-3.5" />
            </Button>
            <span className="font-medium tracking-tight">{row.original.genId}</span>
          </div>
        ),
      },
      {
        accessorKey: "log2FoldChange",
        header: ({ column }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="-ml-3"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Log2 Fold Change
              <ArrowUpDownIcon className="ml-2 size-4" />
            </Button>
            <TermTooltip
              label="Log2FC"
              iconOnly
              description="Log2FC, gen ifadesindeki değişimin log2 ölçekli kat sayısıdır. +1 iki kat artışı, -1 yarıya düşüşü temsil eder."
              className="-ml-1"
            />
          </div>
        ),
        cell: ({ row }) => row.original.log2FoldChange.toFixed(2),
      },
      {
        accessorKey: "pValue",
        header: ({ column }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="-ml-3"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              P-Value
              <ArrowUpDownIcon className="ml-2 size-4" />
            </Button>
            <TermTooltip
              label="P-Value"
              iconOnly
              description="P-Value, gözlenen farkın tesadüfen ortaya çıkma olasılığıdır. Düşük değerler daha güçlü istatistiksel anlamlılık gösterir."
              className="-ml-1"
            />
          </div>
        ),
        cell: ({ row }) => <PValueBadge value={row.original.pValue} />,
      },
      {
        accessorKey: "adjustedPValue",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Adjusted P-Value
            <ArrowUpDownIcon className="ml-2 size-4" />
          </Button>
        ),
        cell: ({ row }) => <PValueBadge value={row.original.adjustedPValue} />,
      },
      {
        accessorKey: "expressionLevel",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Expression Level
            <ArrowUpDownIcon className="ml-2 size-4" />
          </Button>
        ),
        cell: ({ row }) => row.original.expressionLevel.toLocaleString("en-US"),
      },
    ],
    [activeAnalysisId, hasGene, toggleGene]
  );

  const filteredData = useMemo(
    () =>
      data.filter((row) => {
        if (smartPValueMax !== null && row.pValue >= smartPValueMax) {
          return false;
        }
        if (smartFoldChangeMin !== null && Math.abs(row.log2FoldChange) <= smartFoldChangeMin) {
          return false;
        }
        return true;
      }),
    [data, smartFoldChangeMin, smartPValueMax]
  );

  // TanStack Table returns imperative helpers; React Compiler incompatibility warning is expected here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  });

  useEffect(() => {
    const applyGeneFilter = (gene: string) => {
      table.getColumn("genId")?.setFilterValue(gene);
    };

    const parseParamNumber = (
      value: string | null,
      min: number,
      max: number
    ): number | null => {
      if (!value) {
        return null;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return null;
      }
      return Math.min(max, Math.max(min, parsed));
    };

    const queryGene = searchParams.get("gene");
    const queryPMax = parseParamNumber(searchParams.get("pMax"), 0, 1);
    const queryFcMin = parseParamNumber(searchParams.get("fcMin"), 0, 100);
    setSmartPValueMax(queryPMax);
    setSmartFoldChangeMin(queryFcMin);

    if (queryGene) {
      applyGeneFilter(queryGene.toUpperCase());
    } else {
      const storedGene = readStoredGeneSearch();
      if (storedGene) {
        applyGeneFilter(storedGene);
      }
    }

    const onGlobalGeneSearch = (event: Event) => {
      const customEvent = event as CustomEvent<GeneSearchEventPayload>;
      const gene = customEvent.detail?.gene;
      if (!gene) {
        return;
      }
      applyGeneFilter(gene.toUpperCase());
    };

    window.addEventListener(GLOBAL_GENE_SEARCH_EVENT, onGlobalGeneSearch);
    return () => {
      window.removeEventListener(GLOBAL_GENE_SEARCH_EVENT, onGlobalGeneSearch);
    };
  }, [searchParams, table]);

  const exportCsv = () => {
    if (!table.getPrePaginationRowModel().rows.length) {
      return;
    }

    const rows = table.getPrePaginationRowModel().rows.map((row) => row.original);
    const headers = [
      "Gen ID",
      "Log2 Fold Change",
      "P-Value",
      "Adjusted P-Value",
      "Expression Level",
    ];
    const csvLines = rows.map((row) =>
      [
        row.genId,
        row.log2FoldChange.toFixed(2),
        row.pValue,
        row.adjustedPValue,
        row.expressionLevel,
      ].join(",")
    );
    const content = [headers.join(","), ...csvLines].join("\n");

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "differential-expression-results.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 p-4 md:p-6">
      <section className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  Diferansiyel İfade
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gen bazlı fark analiz sonuçları
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aktif analiz: {activeAnalysisId ? `#${activeAnalysisId}` : "seçilmedi"}
                </p>
              </div>
              <Button
                onClick={exportCsv}
                disabled={isLoading || !table.getPrePaginationRowModel().rows.length}
              >
                <DownloadIcon className="mr-2 size-4" />
                CSV Olarak İndir
              </Button>
            </div>

            {isLoading ? (
              <Skeleton className="h-10 w-full max-w-sm" />
            ) : (
              <div className="space-y-2">
                <div className="w-full max-w-sm">
                  <Input
                    placeholder="Gen adına göre ara (örn: TP53)"
                    value={(table.getColumn("genId")?.getFilterValue() as string) ?? ""}
                    onChange={(event) => table.getColumn("genId")?.setFilterValue(event.target.value)}
                  />
                </div>
                {smartPValueMax !== null || smartFoldChangeMin !== null ? (
                  <p className="text-xs text-muted-foreground">
                    Aktif Akıllı Filtre:
                    {smartPValueMax !== null ? ` p < ${smartPValueMax}` : ""}
                    {smartFoldChangeMin !== null
                      ? `${smartPValueMax !== null ? " |" : ""} |log2FC| > ${smartFoldChangeMin}`
                      : ""}
                  </p>
                ) : null}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span>Volcano Plot</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!selectedPlotGene}
                    onClick={() => {
                      if (!selectedPlotGene) {
                        return;
                      }
                      toggleGene({
                        geneId: selectedPlotGene,
                        analysisId: activeAnalysisId,
                        source: "differential-expression-volcano",
                      });
                      toast.success(`${selectedPlotGene} geni sepete güncellendi.`);
                    }}
                  >
                    <FilePlus2Icon className="mr-1.5 size-3.5" />
                    {selectedPlotGene ? `${selectedPlotGene} Sepete Ekle` : "Gen Seçin"}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[420px] w-full" />
                ) : (
                  <div className="w-full">
                    <Plot
                      data={[
                        {
                          x: neutral.map((point) => point.log2FoldChange),
                          y: neutral.map((point) => point.negLog10PValue),
                          text: neutral.map((point) => point.genId),
                          customdata: neutral.map((point) => point.pValue),
                          type: "scattergl",
                          mode: "markers",
                          name: "Nötr",
                          marker: { color: "#9ca3af", size: 10, opacity: 0.85 },
                          hovertemplate:
                            "<b>%{text}</b><br>Log2 Fold Change: %{x:.2f}<br>-log10(P-Value): %{y:.2f}<br>P-Value: %{customdata:.4g}<extra></extra>",
                        },
                        {
                          x: upRegulated.map((point) => point.log2FoldChange),
                          y: upRegulated.map((point) => point.negLog10PValue),
                          text: upRegulated.map((point) => point.genId),
                          customdata: upRegulated.map((point) => point.pValue),
                          type: "scattergl",
                          mode: "markers",
                          name: "Up-regulated",
                          marker: { color: "#dc2626", size: 11, opacity: 0.95 },
                          hovertemplate:
                            "<b>%{text}</b><br>Log2 Fold Change: %{x:.2f}<br>-log10(P-Value): %{y:.2f}<br>P-Value: %{customdata:.4g}<extra></extra>",
                        },
                        {
                          x: downRegulated.map((point) => point.log2FoldChange),
                          y: downRegulated.map((point) => point.negLog10PValue),
                          text: downRegulated.map((point) => point.genId),
                          customdata: downRegulated.map((point) => point.pValue),
                          type: "scattergl",
                          mode: "markers",
                          name: "Down-regulated",
                          marker: { color: "#2563eb", size: 11, opacity: 0.95 },
                          hovertemplate:
                            "<b>%{text}</b><br>Log2 Fold Change: %{x:.2f}<br>-log10(P-Value): %{y:.2f}<br>P-Value: %{customdata:.4g}<extra></extra>",
                        },
                      ]}
                      layout={{
                        autosize: true,
                        height: 420,
                        margin: { l: 60, r: 20, t: 20, b: 55 },
                        paper_bgcolor: "transparent",
                        plot_bgcolor: "transparent",
                        font: { color: plotThemeStyle.fontColor },
                        hovermode: "closest",
                        xaxis: {
                          title: { text: "Log2 Fold Change" },
                          zeroline: true,
                          zerolinecolor: plotThemeStyle.zeroLineColor,
                          gridcolor: plotThemeStyle.gridColor,
                        },
                        yaxis: {
                          title: { text: "-log10(P-Value)" },
                          gridcolor: plotThemeStyle.gridColor,
                        },
                        legend: {
                          orientation: "h",
                          y: 1.15,
                          x: 0,
                        },
                      }}
                      config={{
                        responsive: true,
                        displaylogo: false,
                      }}
                      onClick={(event) => {
                        const point = event.points?.[0];
                        const gene =
                          Array.isArray(point?.text)
                            ? String(point?.text?.[0] ?? "")
                            : String(point?.text ?? "");
                        if (gene) {
                          setSelectedPlotGene(gene);
                        }
                      }}
                      useResizeHandler
                      style={{ width: "100%", height: "420px" }}
                    />
                    <PlotCodeExport
                      spec={{
                        title: "Volcano Plot",
                        xLabel: "Log2 Fold Change",
                        yLabel: "-log10(P-Value)",
                        datasets: [
                          {
                            name: "Nötr",
                            x: neutral.map((point) => point.log2FoldChange),
                            y: neutral.map((point) => point.negLog10PValue),
                            mode: "markers",
                            type: "scatter",
                            color: "#9ca3af",
                          },
                          {
                            name: "Up-regulated",
                            x: upRegulated.map((point) => point.log2FoldChange),
                            y: upRegulated.map((point) => point.negLog10PValue),
                            mode: "markers",
                            type: "scatter",
                            color: "#dc2626",
                          },
                          {
                            name: "Down-regulated",
                            x: downRegulated.map((point) => point.log2FoldChange),
                            y: downRegulated.map((point) => point.negLog10PValue),
                            mode: "markers",
                            type: "scatter",
                            color: "#2563eb",
                          },
                        ],
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      </TableRow>
                    ))
                  ) : table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        Sonuç bulunamadı.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Toplam {table.getPrePaginationRowModel().rows.length} sonuç
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => table.previousPage()}
                  disabled={isLoading || !table.getCanPreviousPage()}
                >
                  Önceki
                </Button>
                <span className="text-sm text-muted-foreground">
                  Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                </span>
                <Button
                  variant="outline"
                  onClick={() => table.nextPage()}
                  disabled={isLoading || !table.getCanNextPage()}
                >
                  Sonraki
                </Button>
              </div>
            </div>
      </section>
    </main>
  );
}

function DifferentialExpressionPageSkeleton() {
  return (
    <main className="flex-1 p-4 md:p-6">
      <section className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-full max-w-sm" />
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[420px] w-full" />
          </CardContent>
        </Card>
        <div className="overflow-hidden rounded-lg border">
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={`de-page-skeleton-row-${index}`} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function DifferentialExpressionPage() {
  return (
    <Suspense fallback={<DifferentialExpressionPageSkeleton />}>
      <DifferentialExpressionContent />
    </Suspense>
  );
}
