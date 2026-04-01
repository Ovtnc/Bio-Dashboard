"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangleIcon, NetworkIcon } from "lucide-react";
import { toast } from "sonner";
import type { Core, EventObjectNode } from "cytoscape";

import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import {
  pathwayOverlayResponseSchema,
  type PathwayOverlayResponse,
} from "@/lib/schemas/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type PathwayMapProps = {
  analysisId: number | null;
  pathwayName: string;
  className?: string;
};

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  gene: string;
  regulation: "up" | "down" | "neutral";
  log2FoldChange: number | null;
  pValue: number | null;
  adjustedPValue: number | null;
  matched: boolean;
};

function formatPValue(value: number | null) {
  if (value === null) {
    return "-";
  }
  if (value < 0.001) {
    return value.toExponential(2);
  }
  return value.toFixed(4);
}

export function PathwayMap({ analysisId, pathwayName, className }: PathwayMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [payload, setPayload] = useState<PathwayOverlayResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    gene: "",
    regulation: "neutral",
    log2FoldChange: null,
    pValue: null,
    adjustedPValue: null,
    matched: false,
  });

  useEffect(() => {
    if (!analysisId) {
      setPayload(null);
      setError("Pathway analizi için önce tamamlanmış bir analiz bulunmalıdır.");
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const response = await fetchApiWithAuth(
          `/api/analysis/${analysisId}/pathway/${encodeURIComponent(pathwayName)}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const responsePayload = await response.json().catch(() => null);

        if (!response.ok) {
          const detail =
            responsePayload && typeof responsePayload === "object" && "detail" in responsePayload
              ? String(responsePayload.detail)
              : "Pathway verisi alınamadı.";
          throw new Error(detail);
        }

        const parsed = pathwayOverlayResponseSchema.safeParse(responsePayload);
        if (!parsed.success) {
          throw new Error("Pathway veri formatı doğrulanamadı.");
        }

        setPayload(parsed.data);
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          requestError instanceof Error ? requestError.message : "Pathway yüklemesi başarısız.";
        setError(message);
        setPayload(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [analysisId, pathwayName]);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    if (!container || !payload || isLoading) {
      return;
    }

    const renderGraph = async () => {
      try {
        const cytoscapeModule = await import("cytoscape");
        const cytoscape = cytoscapeModule.default;
        if (cancelled || !containerRef.current) {
          return;
        }

        const elements = [
          ...payload.elements.nodes.map((node) => ({
            data: {
              id: node.id,
              label: node.label,
              color: node.color,
              regulation: node.regulation,
              matched: node.matched,
              log2FoldChange: node.log2FoldChange,
              pValue: node.pValue,
              adjustedPValue: node.adjustedPValue,
            },
            position: { x: node.x, y: node.y },
          })),
          ...payload.elements.edges.map((edge) => ({
            data: {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              interaction: edge.interaction,
            },
          })),
        ];

        const cy = cytoscape({
          container: containerRef.current,
          elements,
          layout: {
            name: "preset",
            fit: true,
            padding: 32,
          },
          minZoom: 0.35,
          maxZoom: 2.5,
          wheelSensitivity: 0.2,
          style: [
            {
              selector: "node",
              style: {
                width: 48,
                height: 48,
                "background-color": "data(color)",
                label: "data(label)",
                color: "#f4f4f5",
                "font-size": 11,
                "font-weight": 600,
                "text-outline-color": "#18181b",
                "text-outline-width": 2,
                "text-valign": "center",
                "text-halign": "center",
                "border-width": 1.5,
                "border-color": "#27272a",
              },
            },
            {
              selector: "edge",
              style: {
                width: 2,
                "line-color": "#52525b",
                "target-arrow-color": "#52525b",
                "target-arrow-shape": "triangle",
                "curve-style": "bezier",
                opacity: 0.85,
              },
            },
            {
              selector: "node[matched = false]",
              style: {
                opacity: 0.65,
              },
            },
          ],
        });

        cyRef.current = cy;

        const onNodeHover = (event: EventObjectNode) => {
          const node = event.target;
          const rendered = event.renderedPosition;
          setTooltip({
            visible: true,
            x: rendered.x + 12,
            y: rendered.y + 12,
            gene: String(node.data("label") ?? node.id()),
            regulation: (String(node.data("regulation")) as TooltipState["regulation"]) || "neutral",
            log2FoldChange:
              typeof node.data("log2FoldChange") === "number" ? Number(node.data("log2FoldChange")) : null,
            pValue: typeof node.data("pValue") === "number" ? Number(node.data("pValue")) : null,
            adjustedPValue:
              typeof node.data("adjustedPValue") === "number" ? Number(node.data("adjustedPValue")) : null,
            matched: Boolean(node.data("matched")),
          });
        };

        const onNodeMove = (event: EventObjectNode) => {
          const rendered = event.renderedPosition;
          setTooltip((current) => ({
            ...current,
            x: rendered.x + 12,
            y: rendered.y + 12,
          }));
        };

        const onNodeOut = () => {
          setTooltip((current) => ({
            ...current,
            visible: false,
          }));
        };

        cy.on("mouseover", "node", onNodeHover);
        cy.on("mousemove", "node", onNodeMove);
        cy.on("mouseout", "node", onNodeOut);
      } catch (graphError) {
        const message =
          graphError instanceof Error ? graphError.message : "Pathway haritası çizilemedi.";
        setError(message);
        toast.error(message);
      }
    };

    void renderGraph();

    return () => {
      cancelled = true;
      setTooltip((current) => ({ ...current, visible: false }));
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [isLoading, payload]);

  const regulationBadgeClass = useMemo(() => {
    if (tooltip.regulation === "up") {
      return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
    }
    if (tooltip.regulation === "down") {
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
    }
    return "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300";
  }, [tooltip.regulation]);

  if (!analysisId) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
        Yolak haritası için tamamlanmış bir analiz bekleniyor.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-[520px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="rounded-lg border border-red-200/70 bg-red-50/60 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="size-4" />
          <span>{error ?? "Pathway verisi bulunamadı."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary" className="gap-1">
          <NetworkIcon className="size-3.5" />
          {payload.pathway.name}
        </Badge>
        <Badge variant="outline">Eşleşen Gen: {payload.stats.matched}</Badge>
        <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
          Up: {payload.stats.up}
        </Badge>
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
          Down: {payload.stats.down}
        </Badge>
      </div>
      <div className="mb-3 text-xs text-muted-foreground">{payload.pathway.description}</div>

      <div className="relative overflow-hidden rounded-xl border bg-zinc-950/95">
        <div ref={containerRef} className="h-[520px] w-full" />

        {tooltip.visible ? (
          <div
            className="pointer-events-none absolute z-20 min-w-52 rounded-md border bg-background/95 p-3 text-xs shadow-md backdrop-blur"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-semibold">{tooltip.gene}</span>
              <Badge className={regulationBadgeClass}>{tooltip.regulation.toUpperCase()}</Badge>
            </div>
            {tooltip.matched ? (
              <div className="space-y-1 text-muted-foreground">
                <p>Log2FC: {tooltip.log2FoldChange?.toFixed(3) ?? "-"}</p>
                <p>P-Value: {formatPValue(tooltip.pValue)}</p>
                <p>Adj. P-Value: {formatPValue(tooltip.adjustedPValue)}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">Bu gen için analiz eşleşmesi bulunamadı.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
