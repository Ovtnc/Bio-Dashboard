"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLinkIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ProteinStructureCardProps = {
  gene: string | null;
  mutationHints?: string[];
};

type NglComponentLike = {
  addRepresentation: (type: string, params?: Record<string, unknown>) => void;
  autoView: () => void;
};

type NglStageLike = {
  removeAllComponents: () => void;
  loadFile: (
    url: string,
    params?: Record<string, unknown>
  ) => Promise<void | NglComponentLike>;
  setSpin: (enabled: boolean) => void;
  handleResize: () => void;
  dispose: () => void;
};

const GENE_PDB_FALLBACK: Record<string, string[]> = {
  TP53: ["1TUP", "2OCJ", "4HJE"],
  BRCA1: ["1JM7"],
  BRCA2: ["1MJE"],
  EGFR: ["1M17", "2GS6"],
  KRAS: ["4OBE", "6MBT"],
  PIK3CA: ["4OVU"],
  PTEN: ["1D5R"],
  MYC: ["5I50"],
  BRAF: ["1UWH", "6P7G"],
  ALK: ["2XP2"],
};

const pdbCache = new Map<string, string | null>();

function normalizePdbIdentifier(raw: string | undefined) {
  if (!raw) return null;
  const entry = raw.split("_")[0]?.trim().toUpperCase();
  if (!entry) return null;
  return /^[0-9A-Z]{4}$/.test(entry) ? entry : null;
}

async function queryRcsbByGene(gene: string, operator: "exact_match" | "contains_words") {
  const response = await fetch("https://search.rcsb.org/rcsbsearch/v2/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: {
        type: "terminal",
        service: "text",
        parameters: {
          attribute: "rcsb_entity_source_organism.rcsb_gene_name.value",
          operator,
          value: gene,
        },
      },
      return_type: "polymer_entity",
      request_options: {
        paginate: { start: 0, rows: 5 },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    result_set?: Array<{ identifier?: string }>;
  };

  return normalizePdbIdentifier(payload.result_set?.[0]?.identifier);
}

async function resolvePdbId(gene: string) {
  const upper = gene.toUpperCase();
  if (pdbCache.has(upper)) {
    return pdbCache.get(upper) ?? null;
  }

  try {
    const exact = await queryRcsbByGene(upper, "exact_match");
    if (exact) {
      pdbCache.set(upper, exact);
      return exact;
    }

    const contains = await queryRcsbByGene(upper, "contains_words");
    if (contains) {
      pdbCache.set(upper, contains);
      return contains;
    }
  } catch {
    // RCSB erişim hatasında fallback kullanılacak.
  }

  const fallback = GENE_PDB_FALLBACK[upper]?.[0] ?? null;
  pdbCache.set(upper, fallback);
  return fallback;
}

function extractResidueIndexes(mutations: string[]) {
  const indexes = new Set<number>();

  const patterns = [
    /p\.[A-Z][a-z]{0,2}(\d{1,4})[A-Z*][a-z]{0,2}/g,
    /\b[A-Z](\d{1,4})[A-Z*]\b/g,
    /(?:codon|residue|position)\s*(\d{1,4})/gi,
  ];

  for (const mutation of mutations) {
    for (const pattern of patterns) {
      for (const match of mutation.matchAll(pattern)) {
        const parsed = Number(match[1]);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 9999) {
          indexes.add(parsed);
        }
      }
    }
  }

  return Array.from(indexes).sort((a, b) => a - b).slice(0, 8);
}

export function ProteinStructureCard({ gene, mutationHints = [] }: ProteinStructureCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<NglStageLike | null>(null);
  const spinEnabledRef = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [pdbId, setPdbId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [highlightedResidues, setHighlightedResidues] = useState<number[]>([]);

  const normalizedGene = gene?.trim().toUpperCase() ?? null;
  const residueIndexes = useMemo(() => extractResidueIndexes(mutationHints), [mutationHints]);
  const mutationSignature = useMemo(() => mutationHints.join("|"), [mutationHints]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let disposed = false;

    const initializeViewer = async () => {
      if (!containerRef.current || !normalizedGene) {
        setError(null);
        setPdbId(null);
        setHighlightedResidues([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const NGL = await import("ngl");
        if (disposed) return;

        if (!stageRef.current) {
          stageRef.current = new NGL.Stage(containerRef.current, {
            backgroundColor: "transparent",
            tooltip: true,
          });
        }

        const stage = stageRef.current;
        stage.removeAllComponents();

        const resolvedPdb = await resolvePdbId(normalizedGene);
        if (!resolvedPdb) {
          throw new Error(`${normalizedGene} için uygun PDB yapısı bulunamadı.`);
        }

        if (disposed) return;

        setPdbId(resolvedPdb);
        const component = await stage.loadFile(`rcsb://${resolvedPdb}`, {
          defaultRepresentation: false,
        });

        if (disposed) return;
        if (!component) {
          throw new Error("Protein bileşeni oluşturulamadı.");
        }

        component.addRepresentation("cartoon", {
          colorScheme: "chainname",
          opacity: 0.95,
        });

        if (residueIndexes.length > 0) {
          const selection = residueIndexes.join(" OR ");
          component.addRepresentation("ball+stick", {
            sele: selection,
            color: "#ff2bd6",
            scale: 2.4,
            aspectRatio: 1.4,
          });
          component.addRepresentation("spacefill", {
            sele: selection,
            color: "#ff2bd6",
            radiusScale: 1.2,
            opacity: 0.88,
          });
          setHighlightedResidues(residueIndexes);
        } else {
          setHighlightedResidues([]);
        }

        component.autoView();
        stage.setSpin(spinEnabledRef.current);
        stage.handleResize();
      } catch (viewerError) {
        setError(
          viewerError instanceof Error
            ? viewerError.message
            : "Protein yapısı yüklenemedi."
        );
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    };

    void initializeViewer();

    const onResize = () => {
      if (stageRef.current) {
        stageRef.current.handleResize();
      }
    };

    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
    };
  }, [normalizedGene, mutationSignature, reloadToken, residueIndexes]);

  useEffect(() => {
    spinEnabledRef.current = isSpinning;
    if (stageRef.current) {
      stageRef.current.setSpin(isSpinning);
    }
  }, [isSpinning]);

  useEffect(() => {
    return () => {
      if (stageRef.current) {
        stageRef.current.dispose();
        stageRef.current = null;
      }
    };
  }, []);

  if (!normalizedGene) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
        Protein 3D görünümü için bir gen seçin.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Gene: {normalizedGene}</Badge>
          {pdbId ? <Badge variant="outline">PDB: {pdbId}</Badge> : null}
          {highlightedResidues.length > 0 ? (
            <Badge className="bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300">
              Mutasyon Vurgusu: {highlightedResidues.join(", ")}
            </Badge>
          ) : (
            <Badge variant="outline">Mutasyon lokusu bulunamadı</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={isSpinning ? "default" : "outline"}
            onClick={() => setIsSpinning((prev) => !prev)}
          >
            {isSpinning ? "Spin: Açık" : "Spin: Kapalı"}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => setReloadToken((prev) => prev + 1)}
            aria-label="Protein görünümünü yenile"
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>
          {pdbId ? (
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={`https://www.rcsb.org/structure/${pdbId}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="PDB kaydını aç"
                />
              }
            >
              <ExternalLinkIcon className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-[420px] w-full overflow-hidden rounded-xl border bg-background/40">
        <div ref={containerRef} className="h-[460px] w-full" />

        {isLoading ? (
          <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Protein yapısı yükleniyor...
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-x-4 bottom-4 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
