"use client";

import { useRef } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import type { GoCategory, EnrichmentRow } from "@/lib/functional-enrichment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORY_COLOR: Record<GoCategory, string> = {
  "Biological Process": "#0ea5e9",
  "Molecular Function": "#22c55e",
  "Cellular Component": "#f59e0b",
};

type FunctionalEnrichmentChartProps = {
  title: GoCategory;
  rows: EnrichmentRow[];
};

function formatPAdj(value: number) {
  if (value < 0.001) {
    return value.toExponential(2);
  }
  return value.toFixed(4);
}

export function FunctionalEnrichmentChart({ title, rows }: FunctionalEnrichmentChartProps) {
  const color = CATEGORY_COLOR[title];
  const containerRef = useRef<HTMLDivElement | null>(null);

  const serializeSvg = () => {
    const svgElement = containerRef.current?.querySelector("svg");
    if (!svgElement) {
      return null;
    }

    const serializer = new XMLSerializer();
    let svgMarkup = serializer.serializeToString(svgElement);
    if (!svgMarkup.includes("xmlns=")) {
      svgMarkup = svgMarkup.replace(
        "<svg",
        '<svg xmlns="http://www.w3.org/2000/svg"'
      );
    }
    return {
      svgMarkup,
      width: Math.max(800, Math.round(svgElement.getBoundingClientRect().width || 800)),
      height: Math.max(600, Math.round(svgElement.getBoundingClientRect().height || 600)),
    };
  };

  const downloadSvg = () => {
    const payload = serializeSvg();
    if (!payload) {
      toast.error("Grafik henüz hazır değil.");
      return;
    }

    const blob = new Blob([payload.svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.toLowerCase().replace(/\s+/g, "-")}-enrichment.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Enrichment grafiği SVG indirildi.");
  };

  const downloadPng = async () => {
    const payload = serializeSvg();
    if (!payload) {
      toast.error("Grafik henüz hazır değil.");
      return;
    }

    const svgBlob = new Blob([payload.svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();
    const scale = 300 / 96;

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("SVG render edilemedi."));
        image.src = svgUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(payload.width * scale));
      canvas.height = Math.max(1, Math.round(payload.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas context oluşturulamadı.");
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const pngBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1)
      );
      if (!pngBlob) {
        throw new Error("PNG oluşturulamadı.");
      }

      const pngUrl = URL.createObjectURL(pngBlob);
      const anchor = document.createElement("a");
      anchor.href = pngUrl;
      anchor.download = `${title.toLowerCase().replace(/\s+/g, "-")}-enrichment-300dpi.png`;
      anchor.click();
      URL.revokeObjectURL(pngUrl);
      toast.success("Enrichment grafiği 300 DPI PNG indirildi.");
    } catch {
      toast.error("Enrichment grafiği PNG olarak indirilemedi.");
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={downloadSvg}
              disabled={rows.length === 0}
            >
              Download SVG
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void downloadPng()}
              disabled={rows.length === 0}
            >
              Download 300 DPI PNG
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            p-adj &lt; 0.05 için anlamlı terim bulunamadı.
          </div>
        ) : (
          <div className="h-[260px] w-full" ref={containerRef}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, "dataMax"]} tickFormatter={(value) => value.toFixed(1)} />
                <YAxis type="category" dataKey="term" width={180} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, _name, payload) => {
                    const row = payload.payload as EnrichmentRow;
                    const numericValue = Number(value ?? 0);
                    return [
                      `Score: ${numericValue.toFixed(2)} | p-adj: ${formatPAdj(row.adjustedPValue)} | Hit: ${row.hitCount}/${row.termSize}`,
                      "Enrichment",
                    ];
                  }}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {rows.map((row) => (
                    <Cell key={`${row.category}-${row.term}`} fill={color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
