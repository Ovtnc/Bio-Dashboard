"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import type { NetworkLink, NetworkNode } from "@/lib/functional-enrichment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

type InteractionNetworkGraphProps = {
  nodes: NetworkNode[];
  links: NetworkLink[];
};

function toNodeColor(log2FoldChange: number) {
  if (log2FoldChange > 1) {
    return "#dc2626";
  }
  if (log2FoldChange < -1) {
    return "#2563eb";
  }
  return "#71717a";
}

export function InteractionNetworkGraph({ nodes, links }: InteractionNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(900);
  const graphData = useMemo(
    () => ({
      nodes: nodes.map((node) => ({
        ...node,
        color: toNodeColor(node.log2FoldChange),
      })),
      links,
    }),
    [links, nodes]
  );

  useEffect(() => {
    const target = containerRef.current;
    if (!target) {
      return;
    }

    const updateSize = () => {
      setWidth(Math.max(320, Math.floor(target.clientWidth)));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Interactive Interaction Network</CardTitle>
      </CardHeader>
      <CardContent>
        {nodes.length === 0 ? (
          <div className="flex h-[360px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            Ağ oluşturmak için anlamlı gen bulunamadı.
          </div>
        ) : (
          <div ref={containerRef} className="h-[360px] w-full rounded-md border bg-muted/10">
            <ForceGraph2D
              graphData={graphData}
              width={width}
              height={360}
              nodeRelSize={6}
              linkWidth={(link) => Math.max(1, Number((link as NetworkLink).weight ?? 1) * 2)}
              nodeColor={(node) => String((node as { color?: string }).color ?? "#71717a")}
              nodeLabel={(node) => {
                const typed = node as NetworkNode;
                return `${typed.label} | log2FC: ${typed.log2FoldChange.toFixed(2)} | p: ${typed.pValue.toExponential(2)}`;
              }}
              linkColor={() => "rgba(148,163,184,0.55)"}
              cooldownTicks={80}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
