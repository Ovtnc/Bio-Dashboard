"use client";

import { useRef } from "react";
import Plotly from "plotly.js-dist-min";
import Plot from "react-plotly.js";
import { toast } from "sonner";

import { useTheme } from "@/components/theme-provider";
import type { DifferentialExpressionRow } from "@/hooks/useBioData";
import { Button } from "@/components/ui/button";

type ReportVolcanoPlotProps = {
  rows: DifferentialExpressionRow[];
  selectedGene: string | null;
  onSelectGene: (gene: string) => void;
};

function toPointColor(row: DifferentialExpressionRow) {
  if (row.pValue < 0.05 && row.log2FoldChange > 1) {
    return "#dc2626";
  }
  if (row.pValue < 0.05 && row.log2FoldChange < -1) {
    return "#2563eb";
  }
  return "#71717a";
}

export function ReportVolcanoPlot({ rows, selectedGene, onSelectGene }: ReportVolcanoPlotProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const plotRef = useRef<HTMLElement | null>(null);

  const x = rows.map((row) => row.log2FoldChange);
  const y = rows.map((row) => -Math.log10(Math.max(row.pValue, 1e-12)));
  const labels = rows.map((row) => row.genId);
  const colors = rows.map((row) =>
    selectedGene && row.genId.toUpperCase() === selectedGene.toUpperCase()
      ? "#f97316"
      : toPointColor(row)
  );

  const handleDownloadPlot = async (format: "svg" | "png") => {
    const graph = plotRef.current;
    if (!graph) {
      toast.error("Grafik henüz hazır değil.");
      return;
    }

    const rect = graph.getBoundingClientRect();
    const width = Math.max(1200, Math.round(rect.width || 1200));
    const height = Math.max(760, Math.round(rect.height || 760));
    const scale = format === "png" ? 300 / 96 : 1;

    try {
      const imageDataUrl = await Plotly.toImage(graph, {
        format,
        width,
        height,
        scale,
      });
      const anchor = document.createElement("a");
      anchor.href = imageDataUrl;
      anchor.download =
        format === "svg"
          ? "volcano-plot-analysis.svg"
          : "volcano-plot-analysis-300dpi.png";
      anchor.click();
      toast.success(
        format === "svg"
          ? "Volcano Plot SVG indirildi."
          : "Volcano Plot 300 DPI PNG indirildi."
      );
    } catch {
      toast.error("Grafik indirilemedi.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="no-print flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => void handleDownloadPlot("svg")}>
          Download SVG
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleDownloadPlot("png")}>
          Download 300 DPI PNG
        </Button>
      </div>
      {/*
        Do not set height: "100%" on Plot — inline style beats Tailwind and collapses
        when the parent has no explicit height, leaving only a sliver of the chart visible.
      */}
      <div className="h-[min(420px,70vh)] min-h-[320px] w-full shrink-0">
      <Plot
        data={[
          {
            type: "scattergl",
            mode: "markers",
            x,
            y,
            text: labels,
            hovertemplate:
              "<b>%{text}</b><br>Log2FC: %{x:.2f}<br>-log10(P): %{y:.2f}<extra></extra>",
            marker: {
              size: 9,
              color: colors,
              line: {
                width: 0.6,
                color: isDark ? "rgba(245,245,245,0.25)" : "rgba(24,24,27,0.25)",
              },
              opacity: 0.9,
            },
            customdata: labels,
          },
        ]}
        layout={{
          autosize: true,
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: {
            color: isDark ? "#e4e4e7" : "#27272a",
          },
          margin: { l: 50, r: 20, t: 16, b: 48 },
          xaxis: {
            title: { text: "Log2 Fold Change" },
            zeroline: true,
            zerolinecolor: isDark ? "#52525b" : "#d4d4d8",
            gridcolor: isDark ? "#3f3f46" : "#e4e4e7",
          },
          yaxis: {
            title: { text: "-log10(P-Value)" },
            gridcolor: isDark ? "#3f3f46" : "#e4e4e7",
          },
          hovermode: "closest",
        }}
        config={{
          responsive: true,
          displaylogo: false,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
        }}
        onInitialized={(_, graphDiv) => {
          plotRef.current = graphDiv as HTMLElement;
        }}
        onUpdate={(_, graphDiv) => {
          plotRef.current = graphDiv as HTMLElement;
        }}
        onClick={(event) => {
          const point = event.points?.[0];
          const gene = Array.isArray(point?.customdata)
            ? String(point?.customdata?.[0] ?? "")
            : String(point?.customdata ?? "");
          if (gene) {
            onSelectGene(gene);
          }
        }}
        className="h-full min-h-[320px] w-full"
        useResizeHandler
        style={{ width: "100%" }}
      />
      </div>
    </div>
  );
}
