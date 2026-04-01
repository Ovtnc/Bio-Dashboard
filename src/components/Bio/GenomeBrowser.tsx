"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSession } from "next-auth/react";
import {
  CrosshairIcon,
  DnaIcon,
  FilePlus2Icon,
  GripVerticalIcon,
  LocateFixedIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { useGeneBasket } from "@/components/providers/gene-basket-provider";
import {
  GLOBAL_GENE_SEARCH_EVENT,
  readStoredGeneSearch,
  type GeneSearchEventPayload,
} from "@/lib/gene-search";
import {
  IGV_SUPPORTED_EXTENSIONS,
  resolveIgvTrackDefinition,
} from "@/lib/igv-track-utils";

type IgvTrack = {
  name?: string;
};

type IgvBrowserInstance = {
  search: (locus: string) => unknown;
  currentLoci?: () => string[] | string;
  destroy?: () => void;
  removeAllTracks?: () => void;
  findTracks?: {
    (func: (track: IgvTrack) => boolean): IgvTrack[];
    (property: string, value: unknown): IgvTrack[];
  };
  removeTrack?: (track: IgvTrack) => void;
  loadTrack?: (track: Record<string, unknown>) => Promise<unknown>;
};

type IgvCreateBrowser = (
  element: HTMLElement,
  options: Record<string, unknown>
) => Promise<IgvBrowserInstance>;

type TrackPreset = "all" | "genes" | "alignment";

type ApiFileMetadata = {
  id: number;
  name: string;
  type: string;
  path: string;
  trackType?: "alignment" | "variant" | "annotation" | "wig" | "unsupported";
  hasIndex?: boolean;
};

const IGV_CDN_SRC = "https://cdn.jsdelivr.net/npm/igv@3.8.0/dist/igv.min.js";
const DEMO_ALIGNMENT_LOCUS = "chr11:119,076,212-119,102,218";
const UPLOADED_TRACK_NAME_PREFIX = "Uploaded:";

const LEFT_PANEL_WIDTH_KEY = "bio-dash:genome-browser:left-panel-width";
const LEFT_PANEL_MIN = 280;
const LEFT_PANEL_MAX = 520;
const MAIN_PANEL_MIN = 560;

const GENE_LOCUS_MAP: Record<string, string> = {
  BRCA1: "chr17:43,044,295-43,170,245",
  TP53: "chr17:7,661,779-7,687,550",
  EGFR: "chr7:55,086,714-55,275,031",
  MYC: "chr8:127,735,434-127,742,951",
};

const PRESET_LOCI = [
  { label: "Demo Bölgesi", locus: DEMO_ALIGNMENT_LOCUS },
  { label: "BRCA1", locus: GENE_LOCUS_MAP.BRCA1 },
  { label: "TP53", locus: GENE_LOCUS_MAP.TP53 },
  { label: "EGFR", locus: GENE_LOCUS_MAP.EGFR },
] as const;

const CHROMOSOMES = Array.from({ length: 22 }, (_, index) => `chr${index + 1}`).concat("chrX");

function createGenesTrack() {
  return {
    name: "Genes",
    type: "annotation",
    color: "#0f766e",
    displayMode: "EXPANDED",
    height: 90,
    searchable: true,
    features: [
      {
        chr: "chr17",
        start: 43044294,
        end: 43170245,
        name: "BRCA1",
        strand: "+",
      },
      {
        chr: "chr17",
        start: 7661779,
        end: 7687550,
        name: "TP53",
        strand: "-",
      },
    ],
  } as const;
}

function createAlignmentTrack() {
  return {
    name: "Sample Alignment (BAM)",
    type: "alignment",
    format: "bam",
    url: "https://raw.githubusercontent.com/igvteam/igv.js/master/test/data/bam/HG002_chr11_119076212_119102218_2.bam",
    indexURL:
      "https://raw.githubusercontent.com/igvteam/igv.js/master/test/data/bam/HG002_chr11_119076212_119102218_2.bam.bai",
    visibilityWindow: 300000,
    height: 320,
  } as const;
}

function resolveCreateBrowserExport(moduleValue: unknown): IgvCreateBrowser {
  const igvModule = moduleValue as {
    createBrowser?: IgvCreateBrowser;
    default?: { createBrowser?: IgvCreateBrowser };
  };

  const createBrowser = igvModule.createBrowser ?? igvModule.default?.createBrowser;
  if (!createBrowser) {
    throw new Error("IGV createBrowser exportu bulunamadı.");
  }

  return createBrowser;
}

async function loadCreateBrowserWithFallback(): Promise<IgvCreateBrowser> {
  try {
    return resolveCreateBrowserExport(await import("igv"));
  } catch {
    // Paket export çözümlemesi başarısızsa UMD fallback'i kullan.
  }

  if (typeof window === "undefined") {
    throw new Error("IGV sadece tarayıcı ortamında başlatılabilir.");
  }

  const fromWindow = () =>
    (window as Window & { igv?: { createBrowser?: IgvCreateBrowser } }).igv?.createBrowser;
  const existing = fromWindow();
  if (existing) {
    return existing;
  }

  await new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById("igv-cdn-script") as
      | HTMLScriptElement
      | null;

    if (existingScript) {
      if (fromWindow()) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("IGV CDN script yüklenemedi.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "igv-cdn-script";
    script.src = IGV_CDN_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("IGV CDN script yüklenemedi."));
    document.head.appendChild(script);
  });

  const createBrowser = fromWindow();
  if (!createBrowser) {
    throw new Error("IGV createBrowser exportu bulunamadı.");
  }

  return createBrowser;
}

function toUpperSafe(value: string) {
  return value.trim().toUpperCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readCurrentLocus(browser: IgvBrowserInstance | null): string | null {
  const loci = browser?.currentLoci?.();
  if (!loci) {
    return null;
  }

  if (Array.isArray(loci)) {
    return loci[0] ?? null;
  }

  return loci;
}

function parseRequestedFileIds(
  searchParams: Pick<URLSearchParams, "getAll" | "get"> | null
): number[] {
  if (!searchParams) {
    return [];
  }

  const rawValues = [
    ...searchParams.getAll("fileId"),
    ...searchParams
      .get("fileIds")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [],
  ];

  const parsedIds = rawValues
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  return Array.from(new Set(parsedIds));
}

function getTrackSummary(trackNames: string[]) {
  if (trackNames.length === 0) {
    return null;
  }

  if (trackNames.length === 1) {
    return trackNames[0];
  }

  return `${trackNames.length} dosya track'i`;
}

async function fetchFileMetadata(fileId: number): Promise<ApiFileMetadata> {
  const response = await fetchApiWithAuth(`/api/files/${fileId}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Dosya metadata alınamadı (HTTP ${response.status}).`);
  }

  return (await response.json()) as ApiFileMetadata;
}

function withToken(url: string, accessToken?: string | null) {
  if (!accessToken) {
    return url;
  }

  const parsed = new URL(url);
  parsed.searchParams.set("token", accessToken);
  return parsed.toString();
}

function buildTrackConfigFromMetadata(
  metadata: ApiFileMetadata,
  accessToken?: string | null
) {
  const trackDefinition = resolveIgvTrackDefinition(metadata.name, metadata.type);
  if (!trackDefinition) {
    return {
      ok: false as const,
      warning: `${metadata.name} desteklenmiyor. Desteklenen uzantılar: ${IGV_SUPPORTED_EXTENSIONS.join(", ")}`,
    } as const;
  }

  const apiBaseUrl = getApiBaseUrl();
  const requiresIndex = trackDefinition.requiresIndex;
  const hasIndex = Boolean(metadata.hasIndex);

  if (requiresIndex && !hasIndex) {
    return {
      ok: false as const,
      warning: `${metadata.name} için indeks dosyası gerekli (.bam => .bai, .vcf => .tbi/.csi). Lütfen ilgili indeks dosyasını yükleyin.`,
    } as const;
  }

  const trackConfig: Record<string, unknown> = {
    name: `${UPLOADED_TRACK_NAME_PREFIX} ${metadata.name}`,
    type: trackDefinition.type,
    format: trackDefinition.format,
    url: withToken(`${apiBaseUrl}/api/files/${metadata.id}/stream`, accessToken),
    height: trackDefinition.type === "alignment" ? 320 : 140,
  };

  if (trackDefinition.type === "alignment") {
    trackConfig.visibilityWindow = 300000;
  }

  if (requiresIndex && hasIndex) {
    trackConfig.indexURL = withToken(`${apiBaseUrl}/api/files/${metadata.id}/index`, accessToken);
  }

  return {
    ok: true as const,
    trackConfig,
    metadata,
    requiresIndex,
    hasIndex,
  } as const;
}

export function GenomeBrowser() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const igvContainerRef = useRef<HTMLDivElement | null>(null);
  const igvBrowserRef = useRef<IgvBrowserInstance | null>(null);
  const lastAutoFocusRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
  const { toggleGene, hasGene } = useGeneBasket();
  const lastHandledGeneRef = useRef<string | null>(null);
  const lastHandledFileQueryRef = useRef<string | null>(null);

  const [selectedChromosome, setSelectedChromosome] = useState("chr11");
  const [trackPreset, setTrackPreset] = useState<TrackPreset>("all");
  const [quickGoValue, setQuickGoValue] = useState("");
  const [activeLocus, setActiveLocus] = useState(DEMO_ALIGNMENT_LOCUS);
  const [isReady, setIsReady] = useState(false);
  const [isTrackLoading, setIsTrackLoading] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    if (typeof window === "undefined") {
      return 340;
    }

    const rawValue = window.localStorage.getItem(LEFT_PANEL_WIDTH_KEY);
    if (!rawValue) {
      return 340;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      return 340;
    }

    return clamp(parsedValue, LEFT_PANEL_MIN, LEFT_PANEL_MAX);
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTrackName, setActiveTrackName] = useState<string | null>(null);

  const baseTracks = useMemo(() => [createGenesTrack()], []);

  const layoutStyle = useMemo(
    () => ({ ["--sidebar-width" as string]: `${leftPanelWidth}px` }) as CSSProperties,
    [leftPanelWidth]
  );

  const searchLocus = useCallback(async (locus: string) => {
    if (!igvBrowserRef.current) {
      return;
    }

    await Promise.resolve(igvBrowserRef.current.search(locus));
  }, []);

  const goToLocus = useCallback(
    async (locus: string) => {
      try {
        setErrorMessage(null);
        await searchLocus(locus);
        const currentLocus = readCurrentLocus(igvBrowserRef.current);
        setActiveLocus(currentLocus ?? locus);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Locus araması sırasında beklenmeyen bir hata oluştu.";
        setErrorMessage(message);
        toast.error(message);
      }
    },
    [searchLocus]
  );

  const removeUploadedTracks = useCallback(() => {
    const browser = igvBrowserRef.current;
    if (!browser) {
      return;
    }

    const uploadedTracks =
      browser.findTracks?.((track) => (track.name ?? "").startsWith(UPLOADED_TRACK_NAME_PREFIX)) ??
      [];

    for (const track of uploadedTracks) {
      browser.removeTrack?.(track);
    }
  }, []);

  const loadUploadedTracks = useCallback(
    async (fileIds: number[], options?: { replaceUploadedTracks?: boolean }) => {
      if (!igvBrowserRef.current) {
        return;
      }

      if (fileIds.length === 0) {
        if (options?.replaceUploadedTracks) {
          removeUploadedTracks();
          setActiveTrackName(null);
        }
        return;
      }

      setIsTrackLoading(true);
      try {
        setErrorMessage(null);
        const session = await getSession();
        const accessToken = session?.accessToken;
        const metadataList = await Promise.all(fileIds.map((fileId) => fetchFileMetadata(fileId)));
        const trackConfigs: Record<string, unknown>[] = [];
        const loadedTrackNames: string[] = [];
        const warnings: string[] = [];

        for (const metadata of metadataList) {
          const built = buildTrackConfigFromMetadata(metadata, accessToken);
          if (!built.ok) {
            warnings.push(built.warning);
            continue;
          }

          trackConfigs.push(built.trackConfig);
          loadedTrackNames.push(metadata.name);

        }

        if (trackConfigs.length === 0) {
          throw new Error("Seçilen dosyalar için yüklenebilir IGV track bulunamadı.");
        }

        if (options?.replaceUploadedTracks) {
          removeUploadedTracks();
        }

        for (const trackConfig of trackConfigs) {
          await igvBrowserRef.current.loadTrack?.(trackConfig);
        }

        setActiveTrackName(getTrackSummary(loadedTrackNames));
        for (const warning of warnings) {
          toast.warning(warning);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Dosya izleri IGV tarayıcıya yüklenemedi.";
        setErrorMessage(message);
        toast.error(message);
      } finally {
        setIsTrackLoading(false);
      }
    },
    [removeUploadedTracks]
  );

  const applyGeneSearch = useCallback(
    (rawGeneOrLocus: string) => {
      const cleaned = rawGeneOrLocus.trim();
      if (!cleaned) {
        return;
      }

      const normalized = toUpperSafe(cleaned);
      if (lastHandledGeneRef.current === normalized) {
        return;
      }
      lastHandledGeneRef.current = normalized;

      const locus = GENE_LOCUS_MAP[normalized] ?? cleaned;
      setQuickGoValue(normalized);
      void goToLocus(locus);
    },
    [goToLocus]
  );

  const applyTrackPreset = useCallback(async (preset: TrackPreset) => {
    const browser = igvBrowserRef.current;
    if (!browser) {
      return;
    }

    try {
      setErrorMessage(null);

      const existingTracks =
        browser.findTracks?.((track) => {
          const trackName = (track.name ?? "").toLowerCase();
          return trackName === "genes" || trackName.includes("sample alignment");
        }) ?? [];

      for (const track of existingTracks) {
        browser.removeTrack?.(track);
      }

      if (preset === "all" || preset === "genes") {
        await browser.loadTrack?.({ ...createGenesTrack() });
      }

      if (preset === "all" || preset === "alignment") {
        await browser.loadTrack?.({ ...createAlignmentTrack() });
      }

      setTrackPreset(preset);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Track görünümü güncellenirken bir hata oluştu.";
      setErrorMessage(message);
      toast.error(message);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const containerEl = igvContainerRef.current;

    const setupBrowser = async () => {
      if (!containerEl) {
        return;
      }

      try {
        setErrorMessage(null);
        setIsReady(false);

        const createBrowser = await loadCreateBrowserWithFallback();
        const initialSearchParams =
          typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const requestedFileIds = parseRequestedFileIds(initialSearchParams);
        const requestedFileSignature = requestedFileIds.join(",");
        const initialTrackList: Record<string, unknown>[] = [...baseTracks];
        const session = await getSession();
        const accessToken = session?.accessToken;

        if (requestedFileIds.length > 0) {
          try {
            const metadataList = await Promise.all(
              requestedFileIds.map((fileId) => fetchFileMetadata(fileId))
            );

            const warnings: string[] = [];
            for (const metadata of metadataList) {
              const built = buildTrackConfigFromMetadata(metadata, accessToken);
              if (!built.ok) {
                warnings.push(built.warning);
                continue;
              }

              initialTrackList.push(built.trackConfig);
            }

            if (warnings.length > 0 && isMounted) {
              for (const warning of warnings) {
                toast.warning(warning);
              }
            }
          } catch (error) {
            if (isMounted) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Başlangıç track verileri yüklenemedi.";
              toast.error(message);
            }
          }
        } else {
          initialTrackList.push(createAlignmentTrack());
        }

        const browser = (await createBrowser(containerEl, {
          genome: "hg38",
          locus: DEMO_ALIGNMENT_LOCUS,
          minimumBases: 40,
          showCenterGuide: true,
          showCursorTrackingGuide: true,
          showNavigation: true,
          showRuler: true,
          tracks: initialTrackList,
        })) as IgvBrowserInstance;

        if (!isMounted) {
          browser?.destroy?.();
          return;
        }

        igvBrowserRef.current = browser;
        lastHandledFileQueryRef.current = requestedFileSignature || null;

        if (requestedFileIds.length > 0) {
          const loadedTrackNames = initialTrackList
            .map((track) => String(track.name ?? ""))
            .filter((name) => name.startsWith(UPLOADED_TRACK_NAME_PREFIX))
            .map((name) => name.replace(`${UPLOADED_TRACK_NAME_PREFIX} `, ""));
          setActiveTrackName(getTrackSummary(loadedTrackNames));
        } else {
          setActiveTrackName(null);
        }

        const locus = readCurrentLocus(browser);
        if (locus) {
          setActiveLocus(locus);
        }
        setIsReady(true);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "IGV tarayıcısı başlatılırken beklenmeyen bir hata oluştu."
        );
      }
    };

    void setupBrowser();

    return () => {
      isMounted = false;
      if (igvBrowserRef.current?.destroy) {
        igvBrowserRef.current.destroy();
      } else if (igvBrowserRef.current?.removeAllTracks) {
        igvBrowserRef.current.removeAllTracks();
      }
      igvBrowserRef.current = null;
      if (containerEl) {
        containerEl.innerHTML = "";
      }
    };
  }, [baseTracks]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const geneParam = searchParams.get("gene");
    if (geneParam) {
      applyGeneSearch(geneParam);
      return;
    }

    const storedGene = readStoredGeneSearch();
    if (storedGene) {
      applyGeneSearch(storedGene);
    }
  }, [applyGeneSearch, isReady, searchParams]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const requestedFileIds = parseRequestedFileIds(searchParams);
    const signature = requestedFileIds.join(",");
    if (!signature) {
      lastHandledFileQueryRef.current = null;
      removeUploadedTracks();
      setActiveTrackName(null);
      return;
    }

    if (lastHandledFileQueryRef.current === signature) {
      return;
    }

    lastHandledFileQueryRef.current = signature;
    void loadUploadedTracks(requestedFileIds, { replaceUploadedTracks: true });
  }, [isReady, loadUploadedTracks, removeUploadedTracks, searchParams]);

  useEffect(() => {
    const onGlobalGeneSearch = (event: Event) => {
      const customEvent = event as CustomEvent<GeneSearchEventPayload>;
      const gene = customEvent.detail?.gene;
      if (!gene) {
        return;
      }
      applyGeneSearch(gene);
    };

    window.addEventListener(GLOBAL_GENE_SEARCH_EVENT, onGlobalGeneSearch);
    return () => {
      window.removeEventListener(GLOBAL_GENE_SEARCH_EVENT, onGlobalGeneSearch);
    };
  }, [applyGeneSearch]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const rootRect = rootRef.current?.getBoundingClientRect();
      if (!rootRect) {
        return;
      }

      const maxAllowed = Math.max(LEFT_PANEL_MIN, Math.min(LEFT_PANEL_MAX, rootRect.width - MAIN_PANEL_MIN));
      const nextWidth = clamp(event.clientX - rootRect.left, LEFT_PANEL_MIN, maxAllowed);
      setLeftPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LEFT_PANEL_WIDTH_KEY, String(Math.round(leftPanelWidth)));
      }
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, leftPanelWidth]);

  useEffect(() => {
    const keyword = toUpperSafe(quickGoValue);
    const locus = GENE_LOCUS_MAP[keyword];
    if (!locus || locus === lastAutoFocusRef.current) {
      return;
    }

    lastAutoFocusRef.current = locus;
    void searchLocus(locus).catch(() => {});
  }, [quickGoValue, searchLocus]);

  const handleFocusAction = () => {
    const normalized = toUpperSafe(quickGoValue);
    const locus = GENE_LOCUS_MAP[normalized] ?? quickGoValue.trim();
    if (!locus) {
      toast.error("Lütfen bir gen adı veya locus girin.");
      return;
    }

    void goToLocus(locus);
  };

  return (
    <div
      ref={rootRef}
      style={layoutStyle}
      className={[
        "grid gap-5 xl:gap-0 xl:grid-cols-[var(--sidebar-width)_12px_minmax(0,1fr)]",
        isResizing ? "select-none" : "",
      ].join(" ")}
    >
      <Card className="h-fit border-zinc-200/70 bg-gradient-to-b from-zinc-50 to-white dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 xl:rounded-r-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Hızlı Git</CardTitle>
          <p className="text-xs text-muted-foreground">
            Gen adını veya genomik aralığı girerek tarayıcıyı hedef bölgeye taşıyın.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="gene-search" className="text-xs font-medium text-muted-foreground">
              Gen veya Locus
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="gene-search"
                value={quickGoValue}
                onChange={(event) => setQuickGoValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleFocusAction();
                  }
                }}
                placeholder="BRCA1, TP53 veya chr17:7,661,779-7,687,550"
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={!quickGoValue.trim()}
              onClick={() => {
                const normalized = toUpperSafe(quickGoValue);
                if (!normalized) {
                  return;
                }
                toggleGene({
                  geneId: normalized,
                  source: "genome-browser-input",
                });
              }}
            >
              <FilePlus2Icon className="mr-2 size-3.5" />
              Yazılan Geni Sepete Ekle
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Kısayol Genler</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(GENE_LOCUS_MAP).map(([gene, locus]) => (
                <div key={gene} className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setQuickGoValue(gene);
                      void goToLocus(locus);
                    }}
                  >
                    {gene}
                  </Button>
                  <Button
                    type="button"
                    variant={hasGene(gene) ? "default" : "ghost"}
                    size="icon-sm"
                    onClick={() =>
                      toggleGene({
                        geneId: gene,
                        source: "genome-browser-shortcut",
                      })
                    }
                    aria-label={`${gene} genini sepete ekle`}
                  >
                    <FilePlus2Icon className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Hazır Bölgeler</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_LOCI.map((item) => (
                <Button
                  key={item.label}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuickGoValue(item.label);
                    void goToLocus(item.locus);
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={handleFocusAction}>
            <LocateFixedIcon className="mr-2 size-4" />
            Odağa Al
          </Button>

          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            İpucu: Demo hizalama verisi varsayılan olarak `chr11` bölgesinde yüklüdür.
            Ardından BRCA1/TP53 gibi genlere tek tıkla geçiş yapabilirsiniz.
          </div>
        </CardContent>
      </Card>

      <div className="hidden xl:flex items-center justify-center">
        <button
          type="button"
          aria-label="Panel genişliğini ayarla"
          onMouseDown={() => setIsResizing(true)}
          className="group flex h-full w-full cursor-col-resize items-center justify-center"
        >
          <div className="flex h-16 w-2 items-center justify-center rounded-full bg-zinc-200/70 transition-colors group-hover:bg-zinc-300 dark:bg-zinc-800 dark:group-hover:bg-zinc-700">
            <GripVerticalIcon className="size-3.5 text-zinc-500 dark:text-zinc-400" />
          </div>
        </button>
      </div>

      <Card className="overflow-hidden border-zinc-200/70 bg-card/90 shadow-sm backdrop-blur-sm dark:border-zinc-800 xl:rounded-l-none">
        <CardHeader className="space-y-4 border-b bg-muted/20 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <DnaIcon className="size-4 text-primary" />
              Interaktif Genom Tarayıcı (IGV.js)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="w-fit">
                {isReady ? "Durum: Hazır" : "Durum: Yükleniyor"}
              </Badge>
              {activeTrackName ? (
                <Badge
                  variant="secondary"
                  className="w-fit bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                >
                  Track: {activeTrackName}
                </Badge>
              ) : null}
              <Badge
                variant="secondary"
                className="w-fit bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                Reference: hg38
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[180px_180px_minmax(0,1fr)_auto] md:items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Kromozom:</span>
              <Select
                value={selectedChromosome}
                onValueChange={(value) => {
                  if (!value) {
                    return;
                  }
                  setSelectedChromosome(value);
                  void goToLocus(value);
                }}
              >
                <SelectTrigger className="w-[120px]" aria-label="Kromozom seçici">
                  <SelectValue placeholder="Kromozom seç" />
                </SelectTrigger>
                <SelectContent>
                  {CHROMOSOMES.map((chromosome) => (
                    <SelectItem key={chromosome} value={chromosome}>
                      {chromosome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">İzler:</span>
              <Select
                value={trackPreset}
                onValueChange={(value) => {
                  if (value === "all" || value === "genes" || value === "alignment") {
                    void applyTrackPreset(value);
                  }
                }}
              >
                <SelectTrigger className="w-[140px]" aria-label="Track görünümü">
                  <SelectValue placeholder="Track seçimi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm İzler</SelectItem>
                  <SelectItem value="genes">Sadece Genes</SelectItem>
                  <SelectItem value="alignment">Sadece Alignment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 rounded-md border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
              <CrosshairIcon className="size-3.5" />
              <span className="truncate">Aktif Locus: {activeLocus}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuickGoValue("Demo Bölgesi");
                setSelectedChromosome("chr11");
                void goToLocus(DEMO_ALIGNMENT_LOCUS);
              }}
            >
              <RotateCcwIcon className="mr-1.5 size-3.5" />
              Demo&apos;ya Dön
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {errorMessage ? (
            <div className="flex h-[calc(100vh-220px)] items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              IGV tarayıcısı yüklenemedi: {errorMessage}
            </div>
          ) : (
            <div className="relative">
              {!isReady || isTrackLoading ? (
                <div className="absolute inset-0 z-10 flex h-[calc(100vh-220px)] items-center justify-center rounded-lg border bg-background/80 p-6 backdrop-blur-sm">
                  <div className="w-full max-w-2xl space-y-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <Skeleton className="h-56 w-full rounded-lg" />
                    <p className="text-xs text-muted-foreground">
                      {!isReady
                        ? "IGV tarayıcı başlatılıyor..."
                        : "Dosya izi yükleniyor, lütfen bekleyin..."}
                    </p>
                  </div>
                </div>
              ) : null}
              <div
                ref={igvContainerRef}
                className="h-[calc(100vh-220px)] w-full rounded-lg border bg-background dark:bg-zinc-950/40"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
