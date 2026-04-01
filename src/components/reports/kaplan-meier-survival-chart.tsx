"use client";

import { useRef } from "react";
import Plotly from "plotly.js-dist-min";
import Plot from "react-plotly.js";
import { toast } from "sonner";

import { useTheme } from "@/components/theme-provider";
import type { AnalysisSurvivalResponse } from "@/lib/schemas/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type KaplanMeierSurvivalChartProps = {
  payload: AnalysisSurvivalResponse;
};

function formatMonths(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toFixed(1)} ay`;
}

function formatPValue(value: number) {
  if (value < 0.0001) {
    return value.toExponential(2);
  }
  return value.toFixed(4);
}

function formatHazard(payload: AnalysisSurvivalResponse) {
  const hr = payload.statistics.hazardRatio;
  if (!hr) {
    return "Hesaplanamadı";
  }

  const low = payload.statistics.hazardRatioCiLow;
  const high = payload.statistics.hazardRatioCiHigh;

  if (low && high) {
    return `${hr.toFixed(3)} (95% CI: ${low.toFixed(3)} - ${high.toFixed(3)})`;
  }

  return hr.toFixed(3);
}

export function KaplanMeierSurvivalChart({ payload }: KaplanMeierSurvivalChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const plotRef = useRef<HTMLElement | null>(null);

  const mutated = payload.groups.mutated;
  const wildType = payload.groups.wildType;

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
          ? `kaplan-meier-analysis-${payload.analysisId}.svg`
          : `kaplan-meier-analysis-${payload.analysisId}-300dpi.png`;
      anchor.click();
      toast.success(
        format === "svg"
          ? "Kaplan-Meier SVG indirildi."
          : "Kaplan-Meier 300 DPI PNG indirildi."
      );
    } catch {
      toast.error("Kaplan-Meier grafiği indirilemedi.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => void handleDownloadPlot("svg")}>
          Download SVG
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleDownloadPlot("png")}>
          Download 300 DPI PNG
        </Button>
      </div>
      {/*
        Avoid height: "100%" on Plot — it overrides Tailwind and collapses when the
        parent chain has no explicit height (same issue as ReportVolcanoPlot).
      */}
      <div className="h-[min(460px,70vh)] min-h-[340px] w-full shrink-0">
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines",
            name: `${mutated.label} (n=${mutated.sampleCount})`,
            x: mutated.curve.map((point) => point.time),
            y: mutated.curve.map((point) => point.survival),
            line: {
              color: "#ef4444",
              width: 2.5,
              shape: "hv",
            },
            hovertemplate:
              "<b>Mutasyonlu</b><br>Zaman: %{x:.1f} ay<br>Sağkalım: %{y:.3f}<extra></extra>",
          },
          {
            type: "scatter",
            mode: "lines",
            name: `${wildType.label} (n=${wildType.sampleCount})`,
            x: wildType.curve.map((point) => point.time),
            y: wildType.curve.map((point) => point.survival),
            line: {
              color: "#3b82f6",
              width: 2.5,
              shape: "hv",
            },
            hovertemplate:
              "<b>Mutasyonsuz</b><br>Zaman: %{x:.1f} ay<br>Sağkalım: %{y:.3f}<extra></extra>",
          },
        ]}
        layout={{
          autosize: true,
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          margin: { l: 58, r: 20, t: 18, b: 46 },
          font: {
            color: isDark ? "#e4e4e7" : "#27272a",
          },
          xaxis: {
            title: { text: "Takip Süresi (Ay)" },
            gridcolor: isDark ? "#3f3f46" : "#e4e4e7",
            zerolinecolor: isDark ? "#52525b" : "#d4d4d8",
          },
          yaxis: {
            title: { text: "Sağkalım Olasılığı" },
            range: [0, 1.05],
            dtick: 0.1,
            gridcolor: isDark ? "#3f3f46" : "#e4e4e7",
            zerolinecolor: isDark ? "#52525b" : "#d4d4d8",
          },
          legend: {
            orientation: "h",
            x: 0,
            y: 1.14,
          },
          hovermode: "x unified",
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
        className="h-full min-h-[340px] w-full"
        useResizeHandler
        style={{ width: "100%" }}
      />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <p className="text-muted-foreground">Log-Rank Test p-value</p>
          <p className="font-semibold">{formatPValue(payload.statistics.logRankPValue)}</p>
        </div>
        <div className="rounded-md border bg-muted/20 p-3 text-sm md:col-span-2 xl:col-span-1">
          <p className="text-muted-foreground">Hazard Ratio</p>
          <p className="font-semibold">{formatHazard(payload)}</p>
        </div>
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <p className="text-muted-foreground">Mutasyonlu Medyan Sağkalım</p>
          <p className="font-semibold">{formatMonths(mutated.medianSurvivalMonths)}</p>
        </div>
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <p className="text-muted-foreground">Mutasyonsuz Medyan Sağkalım</p>
          <p className="font-semibold">{formatMonths(wildType.medianSurvivalMonths)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">Gen: {payload.gene}</Badge>
        <span>
          Olay sayısı: {mutated.eventCount + wildType.eventCount} / {mutated.sampleCount + wildType.sampleCount}
        </span>
      </div>
    </div>
  );
}
