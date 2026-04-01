"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ActivityIcon,
  BarChart3Icon,
  DnaIcon,
  FileTextIcon,
  FolderKanbanIcon,
  HomeIcon,
  MicroscopeIcon,
  SearchIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import { broadcastGeneSearch } from "@/lib/gene-search";
import { smartSearchResponseSchema, type SmartSearchResult } from "@/lib/schemas/api";
import {
  buildDifferentialExpressionSearchParams,
  parseSmartSearchQuery,
} from "@/lib/smart-search";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type CommandEntry = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  shortcut?: string;
  keywords: string[];
  action: () => void;
};

type FileSuggestion = {
  id: number;
  name: string;
};

type DifferentialExpressionSuggestion = {
  GenID: string;
};

type CompletedAnalysisSuggestion = {
  analysisId: number;
  label: string;
  sampleId: string | null;
  stage: string | null;
};

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [smartSearchResults, setSmartSearchResults] = useState<SmartSearchResult[]>([]);
  const [smartSearchTotal, setSmartSearchTotal] = useState(0);
  const [isSmartSearchLoading, setIsSmartSearchLoading] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [geneSuggestions, setGeneSuggestions] = useState<string[]>([]);
  const [fileSuggestions, setFileSuggestions] = useState<FileSuggestion[]>([]);
  const [analysisSuggestions, setAnalysisSuggestions] = useState<CompletedAnalysisSuggestion[]>([]);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const router = useRouter();
  const hintPlaceholders = useMemo(
    () => [
      "İpucu: p < 0.05 yazarak filtrele",
      "İpucu: fc > 1.5 ile yüksek değişimleri bul",
      "İpucu: gen:TP53 yazarak hızlı git",
      "Örnek: p < 0.01 BRCA1",
    ],
    []
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      setOpen((current) => !current);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const normalizedQueryGene = useMemo(() => query.trim().toUpperCase(), [query]);
  const hasCustomGeneQuery =
    normalizedQueryGene.length >= 2 && /^[A-Z0-9._-]+$/.test(normalizedQueryGene);
  const smartFilters = useMemo(() => parseSmartSearchQuery(query), [query]);
  const hasSmartSearchIntent = smartFilters.hasRule;

  useEffect(() => {
    if (!open) {
      setSmartSearchResults([]);
      setSmartSearchTotal(0);
      setIsSmartSearchLoading(false);
      return;
    }

    if (!hasSmartSearchIntent) {
      setSmartSearchResults([]);
      setSmartSearchTotal(0);
      setIsSmartSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSmartSearchLoading(true);
      try {
        const response = await fetchApiWithAuth(
          `/api/search/smart?q=${encodeURIComponent(query)}&limit=8`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setSmartSearchResults([]);
            setSmartSearchTotal(0);
            return;
          }
          throw new Error(`Smart search isteği başarısız (${response.status})`);
        }

        const payload = await response.json();
        const parsed = smartSearchResponseSchema.safeParse(payload);
        if (!parsed.success) {
          setSmartSearchResults([]);
          setSmartSearchTotal(0);
          return;
        }

        setSmartSearchResults(parsed.data.results);
        setSmartSearchTotal(parsed.data.totalMatches);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error(error);
        setSmartSearchResults([]);
        setSmartSearchTotal(0);
      } finally {
        if (!controller.signal.aborted) {
          setIsSmartSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [hasSmartSearchIntent, open, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (fileSuggestions.length > 0 && geneSuggestions.length > 0 && analysisSuggestions.length > 0) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadContext = async () => {
      setIsContextLoading(true);
      try {
        const [filesResponse, genesResponse, analysesResponse] = await Promise.all([
          fetchApiWithAuth("/api/files", {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }),
          fetchApiWithAuth("/api/analysis/differential-expression", {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }),
          fetchApiWithAuth("/api/analysis/completed?limit=40", {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        if (!cancelled && filesResponse.ok) {
          const filesPayload = (await filesResponse.json().catch(() => [])) as FileSuggestion[];
          const normalizedFiles = filesPayload
            .filter((file) => Number.isInteger(file.id) && typeof file.name === "string")
            .slice(0, 8);
          setFileSuggestions(normalizedFiles);
        }

        if (!cancelled && genesResponse.ok) {
          const genesPayload = (await genesResponse.json().catch(() => [])) as DifferentialExpressionSuggestion[];
          const uniqueGenes = Array.from(
            new Set(
              genesPayload
                .map((row) => String(row.GenID ?? "").trim().toUpperCase())
                .filter((gene) => gene.length > 0)
            )
          ).slice(0, 12);
          setGeneSuggestions(uniqueGenes);
        }

        if (!cancelled && analysesResponse.ok) {
          const analysesPayload = (await analysesResponse.json().catch(() => [])) as CompletedAnalysisSuggestion[];
          const normalizedAnalyses = analysesPayload
            .filter((analysis) => Number.isInteger(analysis.analysisId) && typeof analysis.label === "string")
            .slice(0, 12);
          setAnalysisSuggestions(normalizedAnalyses);
        }
      } catch {
        if (!cancelled) {
          setFileSuggestions([]);
          setGeneSuggestions([]);
          setAnalysisSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setIsContextLoading(false);
        }
      }
    };

    void loadContext();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [analysisSuggestions.length, fileSuggestions.length, geneSuggestions.length, open]);

  const pageEntries = useMemo<CommandEntry[]>(
    () => [
      {
        id: "page-dashboard",
        title: "Dashboard",
        description: "Proje özeti ve canlı analiz paneli",
        icon: HomeIcon,
        shortcut: "P",
        keywords: ["dashboard", "home", "ozet", "ana panel"],
        action: () => router.push("/dashboard"),
      },
      {
        id: "page-analysis",
        title: "Analiz Durumu",
        description: "Pipeline adımlarını canlı takip et",
        icon: ActivityIcon,
        shortcut: "P",
        keywords: ["analysis", "status", "pipeline"],
        action: () => router.push("/analysis-status"),
      },
      {
        id: "page-qc",
        title: "QC",
        description: "Veri kalite kontrol dashboard'u",
        icon: BarChart3Icon,
        shortcut: "P",
        keywords: ["qc", "quality", "fastq", "kalite"],
        action: () => router.push("/qc"),
      },
      {
        id: "page-diff-exp",
        title: "Diferansiyel İfade",
        description: "Gen bazlı tablo ve volcano plot",
        icon: MicroscopeIcon,
        shortcut: "P",
        keywords: ["differential", "expression", "gen"],
        action: () => router.push("/differential-expression"),
      },
      {
        id: "page-files",
        title: "Dosya Yöneticisi",
        description: "FASTA/VCF/BAM dosyalarını yönet",
        icon: FolderKanbanIcon,
        shortcut: "P",
        keywords: ["files", "upload", "dosya"],
        action: () => router.push("/files"),
      },
      {
        id: "page-genome-browser",
        title: "Genom Tarayıcı",
        description: "IGV.js ile interaktif genom görünümü",
        icon: DnaIcon,
        shortcut: "P",
        keywords: ["genome", "igv", "browser"],
        action: () => router.push("/genome-browser"),
      },
      {
        id: "page-reports",
        title: "Raporlar",
        description: "Analiz raporları ve dışa aktarma",
        icon: FileTextIcon,
        shortcut: "P",
        keywords: ["report", "pdf", "excel"],
        action: () => router.push("/reports"),
      },
      {
        id: "page-settings",
        title: "Settings",
        description: "Tema ve platform tercihleri",
        icon: SettingsIcon,
        shortcut: "P",
        keywords: ["settings", "ayarlar", "theme"],
        action: () => router.push("/settings"),
      },
    ],
    [router]
  );

  const geneEntries = useMemo<CommandEntry[]>(
    () =>
      geneSuggestions.map((gene) => ({
        id: `gene-${gene}`,
        title: `Gen: ${gene}`,
        description: "Tablo filtresini güncelle ve IGV tarayıcıda ilgili gene odaklan",
        icon: MicroscopeIcon,
        shortcut: "G",
        keywords: [gene.toLowerCase(), "gene", "gen"],
        action: () => {
          broadcastGeneSearch(gene);
          router.push(`/genome-browser?gene=${gene}`);
        },
      })),
    [geneSuggestions, router]
  );

  const fileEntries = useMemo<CommandEntry[]>(
    () =>
      fileSuggestions.map((file) => ({
        id: `file-${file.id}`,
        title: `Dosya: ${file.name}`,
        description: "Dosya yöneticisine git",
        icon: FolderKanbanIcon,
        shortcut: "F",
        keywords: [file.name.toLowerCase(), "file", "dosya", "upload"],
        action: () => router.push(`/files?query=${encodeURIComponent(file.name)}`),
      })),
    [fileSuggestions, router]
  );

  const analysisEntries = useMemo<CommandEntry[]>(
    () =>
      analysisSuggestions.map((analysis) => ({
        id: `analysis-${analysis.analysisId}`,
        title: analysis.label,
        description: `Analiz #${analysis.analysisId}${analysis.stage ? ` • ${analysis.stage}` : ""}`,
        icon: FileTextIcon,
        shortcut: "A",
        keywords: [
          "analysis",
          "analiz",
          "report",
          "rapor",
          String(analysis.analysisId),
          analysis.label.toLowerCase(),
          String(analysis.sampleId ?? "").toLowerCase(),
        ],
        action: () => router.push(`/reports/${analysis.analysisId}`),
      })),
    [analysisSuggestions, router]
  );

  const onSelectEntry = (entry: CommandEntry) => {
    setOpen(false);
    setQuery("");
    entry.action();
  };

  const applySmartSearch = (geneOverride?: string) => {
    const nextFilters = parseSmartSearchQuery(query);
    if (geneOverride) {
      nextFilters.geneQuery = geneOverride.toUpperCase();
      if (!nextFilters.geneTerms.includes(nextFilters.geneQuery)) {
        nextFilters.geneTerms.unshift(nextFilters.geneQuery);
      }
    }

    const params = buildDifferentialExpressionSearchParams(nextFilters);
    const targetGene = nextFilters.geneQuery;
    if (targetGene) {
      broadcastGeneSearch(targetGene);
    }

    setOpen(false);
    setQuery("");
    router.push(`/differential-expression?${params.toString()}`);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setHintIndex((current) => (current + 1) % hintPlaceholders.length);
      return;
    }

    if (!nextOpen) {
      setQuery("");
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-10 w-full max-w-xl justify-between px-3 text-muted-foreground sm:max-w-2xl"
      >
        <span className="flex items-center gap-2 truncate">
          <SearchIcon className="size-4 shrink-0" />
          <span className="truncate">Gen, dosya veya sayfa ara...</span>
        </span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
          Ctrl+K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Global Arama</DialogTitle>
          <Command>
            <CommandInput
              placeholder={hintPlaceholders[hintIndex]}
              value={query}
              onValueChange={setQuery}
              onFocus={() => {
                setHintIndex((current) => (current + 1) % hintPlaceholders.length);
              }}
            />
            <CommandList>
              <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>

              {hasSmartSearchIntent ? (
                <>
                  <CommandGroup heading="Akıllı Arama">
                    <CommandItem
                      value={`Sorguyu Uygula ${query}`}
                      keywords={["smart", "query", "filter", "p", "fc", "gen"]}
                      onSelect={() => applySmartSearch()}
                    >
                      <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          Sorguyu Uygula: {query || "Akıllı filtre"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {smartFilters.pValueLt !== null ? `p < ${smartFilters.pValueLt} ` : ""}
                          {smartFilters.foldChangeGt !== null
                            ? `|log2FC| > ${smartFilters.foldChangeGt} `
                            : ""}
                          {smartFilters.geneQuery ? `gen: ${smartFilters.geneQuery}` : ""}
                        </p>
                      </div>
                      <CommandShortcut>↵</CommandShortcut>
                    </CommandItem>

                    {isSmartSearchLoading ? (
                      <CommandItem value="loading-smart-search" disabled>
                        <SearchIcon className="size-4 animate-pulse text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">Akıllı arama çalışıyor...</p>
                        </div>
                      </CommandItem>
                    ) : (
                      smartSearchResults.map((result) => (
                        <CommandItem
                          key={`smart-result-${result.analysisId}-${result.genId}-${result.pValue}`}
                          value={`Smart ${result.genId} ${result.analysisId}`}
                          keywords={[result.genId.toLowerCase(), "smart", "search", "analysis"]}
                          onSelect={() => applySmartSearch(result.genId)}
                        >
                          <MicroscopeIcon className="size-4 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {result.genId} (p={result.pValue.toExponential(2)})
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              Analiz #{result.analysisId} | log2FC: {result.log2FoldChange.toFixed(2)}
                            </p>
                          </div>
                          <CommandShortcut>S</CommandShortcut>
                        </CommandItem>
                      ))
                    )}

                    {!isSmartSearchLoading && smartSearchTotal > smartSearchResults.length ? (
                      <CommandItem value="smart-search-more" disabled>
                        <SearchIcon className="size-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-muted-foreground">
                            Toplam {smartSearchTotal} eşleşme bulundu.
                          </p>
                        </div>
                      </CommandItem>
                    ) : null}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              ) : null}

              <CommandGroup heading="Analizler">
                {analysisEntries.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`${entry.title} ${entry.description}`}
                    keywords={entry.keywords}
                    onSelect={() => onSelectEntry(entry)}
                  >
                    <entry.icon className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{entry.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.description}
                      </p>
                    </div>
                    {entry.shortcut ? <CommandShortcut>{entry.shortcut}</CommandShortcut> : null}
                  </CommandItem>
                ))}
                {!isContextLoading && analysisEntries.length === 0 ? (
                  <CommandItem value="analysis-empty" disabled>
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-muted-foreground">
                        Aranabilir tamamlanmış analiz bulunamadı.
                      </p>
                    </div>
                  </CommandItem>
                ) : null}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Sayfalar">
                {pageEntries.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`${entry.title} ${entry.description}`}
                    keywords={entry.keywords}
                    onSelect={() => onSelectEntry(entry)}
                  >
                    <entry.icon className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{entry.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.description}
                      </p>
                    </div>
                    {entry.shortcut ? <CommandShortcut>{entry.shortcut}</CommandShortcut> : null}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Genler">
                {hasCustomGeneQuery ? (
                  <CommandItem
                    value={`Gen Ara ${normalizedQueryGene}`}
                    keywords={[normalizedQueryGene.toLowerCase(), "gen", "gene", "igv", "filter"]}
                    onSelect={() =>
                      onSelectEntry({
                        id: `gene-query-${normalizedQueryGene}`,
                        title: `Gen Ara: ${normalizedQueryGene}`,
                        description: "Tablo filtresini güncelle ve IGV tarayıcıya atla",
                        icon: MicroscopeIcon,
                        keywords: [],
                        action: () => {
                          broadcastGeneSearch(normalizedQueryGene);
                          router.push(
                            `/genome-browser?gene=${encodeURIComponent(normalizedQueryGene)}`
                          );
                        },
                      })
                    }
                  >
                    <MicroscopeIcon className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">Gen Ara: {normalizedQueryGene}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Tablo filtresini güncelle ve IGV tarayıcıya atla
                      </p>
                    </div>
                    <CommandShortcut>G</CommandShortcut>
                  </CommandItem>
                ) : null}
                {geneEntries.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`${entry.title} ${entry.description}`}
                    keywords={entry.keywords}
                    onSelect={() => onSelectEntry(entry)}
                  >
                    <entry.icon className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{entry.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.description}
                      </p>
                    </div>
                    {entry.shortcut ? <CommandShortcut>{entry.shortcut}</CommandShortcut> : null}
                  </CommandItem>
                ))}
                {!hasCustomGeneQuery && !isContextLoading && geneEntries.length === 0 ? (
                  <CommandItem value="genes-empty" disabled>
                    <MicroscopeIcon className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-muted-foreground">
                        Henüz önerilecek gen verisi bulunamadı.
                      </p>
                    </div>
                  </CommandItem>
                ) : null}
                {isContextLoading ? (
                  <CommandItem value="genes-loading" disabled>
                    <MicroscopeIcon className="size-4 animate-pulse text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-muted-foreground">
                        Gen önerileri yükleniyor...
                      </p>
                    </div>
                  </CommandItem>
                ) : null}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Dosyalar">
                {fileEntries.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`${entry.title} ${entry.description}`}
                    keywords={entry.keywords}
                    onSelect={() => onSelectEntry(entry)}
                  >
                    <entry.icon className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{entry.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.description}
                      </p>
                    </div>
                    {entry.shortcut ? <CommandShortcut>{entry.shortcut}</CommandShortcut> : null}
                  </CommandItem>
                ))}
                {!isContextLoading && fileEntries.length === 0 ? (
                  <CommandItem value="files-empty" disabled>
                    <FolderKanbanIcon className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-muted-foreground">
                        Henüz önerilecek dosya bulunamadı.
                      </p>
                    </div>
                  </CommandItem>
                ) : null}
                {isContextLoading ? (
                  <CommandItem value="files-loading" disabled>
                    <FolderKanbanIcon className="size-4 animate-pulse text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-muted-foreground">
                        Dosya önerileri yükleniyor...
                      </p>
                    </div>
                  </CommandItem>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
