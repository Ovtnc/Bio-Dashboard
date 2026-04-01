"use client";

type PathwayNode = {
  id: string;
  label: string;
  gene?: string;
};

type PathwaySimulationCardProps = {
  nodes: PathwayNode[];
  impactedGenes: string[];
};

export function PathwaySimulationCard({ nodes, impactedGenes }: PathwaySimulationCardProps) {
  const impactedSet = new Set(impactedGenes.map((gene) => gene.toUpperCase()));

  return (
    <div className="w-full max-w-full overflow-hidden rounded-lg border bg-muted/15 p-6">
      <div className="flex w-full max-w-full flex-wrap items-stretch justify-around gap-4" data-pathway-flow>
        {nodes.map((node, index) => {
          const impacted = node.gene ? impactedSet.has(node.gene.toUpperCase()) : false;
          const isLast = index === nodes.length - 1;

          return (
            <div
              key={node.id}
              className="flex min-w-[150px] flex-1 basis-[170px] items-center gap-3 md:max-w-[240px]"
            >
              <div
                className={[
                  "relative flex h-24 w-full min-w-0 items-center justify-center rounded-xl border px-3 text-center",
                  impacted
                    ? "border-red-500/80 bg-red-500/10"
                    : "border-slate-500/70 bg-slate-500/10",
                ].join(" ")}
              >
                <div className="space-y-1">
                  <p className="line-clamp-2 break-words text-xs font-semibold leading-4 text-foreground">
                    {node.label}
                  </p>
                  {node.gene ? (
                    <p className="truncate text-[11px] text-muted-foreground">{node.gene}</p>
                  ) : null}
                </div>
                {impacted ? (
                  <span className="absolute top-2 right-2 inline-flex size-2.5 animate-pulse rounded-full bg-red-500" />
                ) : null}
              </div>
              {!isLast ? (
                <div className="hidden h-[2px] flex-1 self-center rounded-full bg-slate-400/60 xl:block">
                  <div
                    className={[
                      "h-full rounded-full",
                      impacted ? "w-full bg-red-500/80" : "w-full bg-slate-400/60",
                    ].join(" ")}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-5 w-full rounded-md border border-slate-300/70 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Kırmızı yanan düğümler, analizde anlamlı değişim gösteren genlerle ilişkili yolak etkilerini temsil eder.
      </p>
    </div>
  );
}
