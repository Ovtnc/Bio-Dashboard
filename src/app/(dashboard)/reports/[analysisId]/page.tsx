"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  BookTextIcon,
  ExternalLinkIcon,
  FilePlus2Icon,
  FileTextIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { useGeneBasket } from "@/components/providers/gene-basket-provider";
import { useBioData, type DifferentialExpressionRow } from "@/hooks/useBioData";
import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import {
  buildInteractionNetwork,
  computeFunctionalEnrichment,
  topTermsByCategory,
} from "@/lib/functional-enrichment";
import {
  analysisInsightResponseSchema,
  analysisMethodsResponseSchema,
  analysisNotebookResponseSchema,
  analysisSurvivalResponseSchema,
  analysisNotebookUpdateRequestSchema,
  clinicalSummaryResponseSchema,
  drugMatchingResponseSchema,
  type AnalysisMethodsResponse,
  type AnalysisSurvivalResponse,
  type ClinicalSummaryResponse,
  type DrugMatchingResponse,
} from "@/lib/schemas/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FunctionalEnrichmentChart } from "@/components/reports/functional-enrichment-chart";
import { InteractionNetworkGraph } from "@/components/reports/interaction-network-graph";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ClinicalMutationModel = dynamic(
  () =>
    import("@/components/reports/clinical-mutation-model").then(
      (module) => module.ClinicalMutationModel
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full min-h-[420px] w-full rounded-xl" />,
  }
);

const ReportVolcanoPlot = dynamic(
  () =>
    import("@/components/reports/report-volcano-plot").then(
      (module) => module.ReportVolcanoPlot
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[320px] w-full rounded-xl" />,
  }
);

const PathwaySimulationCard = dynamic(
  () =>
    import("@/components/reports/pathway-simulation-card").then(
      (module) => module.PathwaySimulationCard
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[260px] w-full rounded-xl" />,
  }
);

const ProteinStructureCard = dynamic(
  () =>
    import("@/components/reports/protein-structure-card").then(
      (module) => module.ProteinStructureCard
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[520px] w-full rounded-xl" />,
  }
);

const KaplanMeierSurvivalChart = dynamic(
  () =>
    import("@/components/reports/kaplan-meier-survival-chart").then(
      (module) => module.KaplanMeierSurvivalChart
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[460px] w-full rounded-xl" />,
  }
);

type DrugRow = DrugMatchingResponse["rows"][number];
type AnalysisParameterRow = {
  key: string;
  value: string;
};

type PathwayNode = {
  id: string;
  label: string;
  gene?: string;
};

const PATHWAY_NODES: PathwayNode[] = [
  { id: "receptor", label: "Membran Reseptörü", gene: "EGFR" },
  { id: "transducer", label: "PI3K / AKT", gene: "PIK3CA" },
  { id: "checkpoint", label: "p53 Kontrolü", gene: "TP53" },
  { id: "effector", label: "mTOR / Hücre Büyümesi", gene: "PTEN" },
  { id: "outcome", label: "Apoptoz / Proliferasyon" },
];

const MAIN_REPORT_SECTIONS = [
  { key: "clinical-summary", title: "Klinik Ozet" },
  { key: "variants", title: "Varyantlar" },
  { key: "models", title: "3D Modeller" },
  { key: "survival", title: "Sagkalim Analizi" },
  { key: "methods", title: "Metotlar" },
] as const;

const LIBRARY_PURPOSES: Record<string, string> = {
  python: "Runtime Engine",
  fastapi: "API Engine",
  uvicorn: "ASGI Server",
  pandas: "Data Processing",
  numpy: "Numerical Computing",
  scipy: "Scientific Computing",
  biopython: "Bioinformatics Toolkit",
  sqlalchemy: "ORM / DB Layer",
  psycopg2_binary: "PostgreSQL Driver",
  python_jose: "JWT Security",
  celery: "Background Jobs",
  redis: "Task Queue / Cache",
  lifelines: "Survival Analysis",
  python_multipart: "File Upload Parsing",
  websockets: "Realtime Messaging",
};

function parseSentences(markdown: string) {
  const plain = markdown
    .replace(/[#>*`_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const segments = plain
    .split(/[.!?]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments.slice(0, 3);
}

function normalizePdfText(value: string) {
  const charMap: Record<string, string> = {
    "İ": "I",
    "I": "I",
    "ı": "i",
    "Ş": "S",
    "ş": "s",
    "Ğ": "G",
    "ğ": "g",
    "Ü": "U",
    "ü": "u",
    "Ö": "O",
    "ö": "o",
    "Ç": "C",
    "ç": "c",
  };

  return value
    .replace(/[İIıŞşĞğÜüÖöÇç]/g, (char) => charMap[char] ?? char)
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHelixSnapshotDataUrl(
  hotspots: Array<{ gene: string; intensity: number; index: number }>
) {
  const width = 1280;
  const height = 640;
  const padding = 56;
  const steps = 84;
  const centerX = width / 2;
  const amplitude = 230;
  const topY = padding;
  const bottomY = height - padding;
  const strandDots: string[] = [];
  const rungLines: string[] = [];

  for (let i = 0; i < steps; i += 1) {
    const progress = i / (steps - 1);
    const y = topY + progress * (bottomY - topY);
    const angle = i * 0.34;
    const xLeft = centerX + Math.cos(angle + Math.PI) * amplitude;
    const xRight = centerX + Math.cos(angle) * amplitude;
    const dotOpacity = 0.48 + Math.sin(progress * Math.PI) * 0.28;
    const dotRadius = 8 + Math.sin(progress * Math.PI) * 2;

    strandDots.push(
      `<circle cx="${xLeft.toFixed(2)}" cy="${y.toFixed(2)}" r="${dotRadius.toFixed(2)}" fill="#0f172a" fill-opacity="${dotOpacity.toFixed(2)}" />`
    );
    strandDots.push(
      `<circle cx="${xRight.toFixed(2)}" cy="${y.toFixed(2)}" r="${dotRadius.toFixed(2)}" fill="#0f172a" fill-opacity="${dotOpacity.toFixed(2)}" />`
    );

    if (i % 6 === 0) {
      rungLines.push(
        `<line x1="${xLeft.toFixed(2)}" y1="${y.toFixed(2)}" x2="${xRight.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#64748b" stroke-opacity="0.25" stroke-width="2" />`
      );
    }
  }

  const hotspotNodes = hotspots
    .slice(0, 8)
    .map((hotspot) => {
      const normalizedIndex = hotspots.length > 1 ? hotspot.index / (hotspots.length - 1) : 0.5;
      const y = topY + normalizedIndex * (bottomY - topY);
      const angle = hotspot.index * 1.7;
      const x = centerX + Math.cos(angle) * (amplitude * 0.9);
      const radius = 15 + hotspot.intensity * 16;
      const safeGene = hotspot.gene.replace(/[<>&'"]/g, "");
      return [
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}" fill="#f43f5e" fill-opacity="0.94" />`,
        `<circle cx="${(x - radius * 0.22).toFixed(2)}" cy="${(y - radius * 0.22).toFixed(2)}" r="${Math.max(3, radius * 0.2).toFixed(2)}" fill="#ffffff" fill-opacity="0.85" />`,
        `<text x="${(x + radius + 8).toFixed(2)}" y="${(y + 4).toFixed(2)}" font-size="18" font-family="Arial, sans-serif" fill="#0f172a">${safeGene}</text>`,
      ].join("");
    })
    .join("");

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#eef2ff" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  ${rungLines.join("")}
  ${strandDots.join("")}
  ${hotspotNodes}
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function toEvidenceClass(level: string) {
  const normalized = level.toUpperCase();
  if (normalized.includes("FDA")) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  }
  if (normalized.includes("EMA")) {
    return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
  }
  return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
}

function toRiskTone(score: number) {
  if (score >= 75) {
    return {
      label: "Yüksek Risk",
      className: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    };
  }
  if (score >= 45) {
    return {
      label: "Orta Risk",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    };
  }
  return {
    label: "Düşük Risk",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  };
}

function formatPValue(value: number) {
  if (value < 0.001) {
    return value.toExponential(2);
  }

  return value.toFixed(4);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function cloneLayoutSnapshot(layout: unknown): Record<string, unknown> | null {
  const record = toRecord(layout);
  if (!record) {
    return null;
  }

  try {
    if (typeof structuredClone === "function") {
      return structuredClone(record) as Record<string, unknown>;
    }
  } catch {
    // fallback below
  }

  try {
    return JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildPrintAxisStyle(axisValue: unknown): Record<string, unknown> {
  const axis = toRecord(axisValue) ?? {};
  const tickFont = toRecord(axis.tickfont) ?? {};
  const title = toRecord(axis.title) ?? {};
  const titleFont = toRecord(title.font) ?? {};

  return {
    ...axis,
    color: "#0f172a",
    gridcolor: "#cbd5e1",
    linecolor: "#94a3b8",
    zerolinecolor: "#94a3b8",
    tickfont: {
      ...tickFont,
      color: "#0f172a",
    },
    title: {
      ...title,
      font: {
        ...titleFont,
        color: "#0f172a",
      },
    },
  };
}

function buildExecutiveFallback(
  analysisId: number,
  variants: DifferentialExpressionRow[],
  drugRows: DrugRow[]
) {
  const topGene = variants[0]?.genId ?? "belirgin bir gen";
  const significant = variants.length;
  const therapyCount = drugRows.length;
  return [
    `Analiz #${analysisId} için öne çıkan varyant sinyali ${topGene} geninde yoğunlaşıyor.`,
    `${significant} anlamlı varyant bulundu ve ${therapyCount} ilaç/gen eşleşmesi raporlandı.`,
    "Öne çıkan genler 3D model ve yolak kartı üzerinden teknik olarak tekrar doğrulanmalıdır.",
  ];
}

export default function ClinicalDecisionReportPage() {
  const params = useParams<{ analysisId: string }>();
  const router = useRouter();
  const { items: basketItems, toggleGene, removeGene, clear: clearBasket } = useGeneBasket();
  const parsedAnalysisId = Number(params?.analysisId ?? "");
  const analysisId = Number.isInteger(parsedAnalysisId) && parsedAnalysisId > 0 ? parsedAnalysisId : null;

  const { data, error, isLoading } = useBioData(Boolean(analysisId), analysisId);
  const [clinicalSummary, setClinicalSummary] = useState<ClinicalSummaryResponse | null>(null);
  const [drugRows, setDrugRows] = useState<DrugRow[]>([]);
  const [isLoadingDrugs, setIsLoadingDrugs] = useState(false);
  const [executiveSummary, setExecutiveSummary] = useState<string[]>([]);
  const [isLoadingExecutive, setIsLoadingExecutive] = useState(false);
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [survivalPayload, setSurvivalPayload] = useState<AnalysisSurvivalResponse | null>(null);
  const [isLoadingSurvival, setIsLoadingSurvival] = useState(false);
  const [openTechnical, setOpenTechnical] = useState(false);
  const [activeTab, setActiveTab] = useState<"clinical" | "functional" | "notebook">("clinical");
  const [showBasketOnly, setShowBasketOnly] = useState(false);
  const [notebookMarkdown, setNotebookMarkdown] = useState("");
  const [isNotebookLoading, setIsNotebookLoading] = useState(false);
  const [isNotebookSaving, setIsNotebookSaving] = useState(false);
  const [methodsPayload, setMethodsPayload] = useState<AnalysisMethodsResponse | null>(null);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [pValueThreshold, setPValueThreshold] = useState(0.05);
  const [log2FcThreshold, setLog2FcThreshold] = useState(1);
  const [fileName, setFileName] = useState<string>("-");
  const [fileType, setFileType] = useState<string>("-");
  const reportSectionRef = useRef<HTMLElement | null>(null);
  const plotlyPrintSnapshotsRef = useRef<
    Array<{
      graph: HTMLElement;
      autosize: boolean;
      width: number | null;
      height: number | null;
      glTraceIndexes: number[];
      layoutSnapshot: Record<string, unknown> | null;
    }>
  >([]);
  const isPrintPreparedRef = useRef(false);
  const notebookSaveTimerRef = useRef<number | null>(null);
  const notebookDraftStorageKey = useMemo(
    () => (analysisId ? `bio-dash.quick-lab-notes.analysis.${analysisId}` : null),
    [analysisId]
  );

  useEffect(() => {
    if (!analysisId) {
      toast.error("Geçersiz analiz kimliği.");
      router.replace("/reports");
    }
  }, [analysisId, router]);

  useEffect(() => {
    if (!analysisId) {
      return;
    }

    let cancelled = false;
    const loadClinical = async () => {
      try {
        const response = await fetchApiWithAuth(`/api/analysis/${analysisId}/clinical-summary`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error("Klinik özet alınamadı.");
        }
        const parsed = clinicalSummaryResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("Klinik özet formatı doğrulanamadı.");
        }
        if (!cancelled) {
          setClinicalSummary(parsed.data);
        }
      } catch {
        if (!cancelled) {
          setClinicalSummary(null);
        }
      }
    };

    void loadClinical();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  useEffect(() => {
    if (!analysisId) {
      return;
    }

    let cancelled = false;
    const loadSurvival = async () => {
      setIsLoadingSurvival(true);
      try {
        const query = selectedGene ? `?gene=${encodeURIComponent(selectedGene)}` : "";
        const response = await fetchApiWithAuth(`/api/analysis/${analysisId}/survival${query}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error("Sağkalım analizi alınamadı.");
        }

        const parsed = analysisSurvivalResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("Sağkalım analiz formatı doğrulanamadı.");
        }

        if (!cancelled) {
          setSurvivalPayload(parsed.data);
        }
      } catch {
        if (!cancelled) {
          setSurvivalPayload(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSurvival(false);
        }
      }
    };

    void loadSurvival();
    return () => {
      cancelled = true;
    };
  }, [analysisId, selectedGene]);

  useEffect(() => {
    if (!analysisId) {
      return;
    }

    let cancelled = false;
    const loadDrugMatching = async () => {
      setIsLoadingDrugs(true);
      try {
        const response = await fetchApiWithAuth(`/api/analysis/${analysisId}/drug-matching`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error("Tedavi önerileri alınamadı.");
        }
        const parsed = drugMatchingResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("Tedavi önerileri formatı doğrulanamadı.");
        }
        if (!cancelled) {
          setDrugRows(parsed.data.rows);
        }
      } catch {
        if (!cancelled) {
          setDrugRows([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDrugs(false);
        }
      }
    };

    void loadDrugMatching();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  useEffect(() => {
    if (!analysisId) {
      return;
    }

    let cancelled = false;
    const loadExecutive = async () => {
      setIsLoadingExecutive(true);
      try {
        const response = await fetchApiWithAuth(`/api/analysis/${analysisId}/insight`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error("Yönetici özeti üretilemedi.");
        }
        const parsed = analysisInsightResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("Özet formatı doğrulanamadı.");
        }
        const sentences = parseSentences(parsed.data.markdown);
        if (!cancelled) {
          setExecutiveSummary(sentences);
        }
      } catch {
        if (!cancelled) {
          setExecutiveSummary([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingExecutive(false);
        }
      }
    };

    void loadExecutive();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  useEffect(() => {
    if (error) {
      toast.error("Analiz verisi alınamadı.");
    }
  }, [error]);

  useEffect(() => {
    if (!analysisId) {
      return;
    }

    if (typeof window !== "undefined" && notebookDraftStorageKey) {
      const draft = window.localStorage.getItem(notebookDraftStorageKey) ?? "";
      setNotebookMarkdown(draft);
    }
  }, [analysisId, notebookDraftStorageKey]);

  useEffect(() => {
    if (!analysisId) {
      return;
    }

    let cancelled = false;
    const loadNotebook = async () => {
      setIsNotebookLoading(true);
      try {
        const response = await fetchApiWithAuth(`/api/analysis/${analysisId}/notebook`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (response.status === 404) {
          return;
        }
        if (!response.ok) {
          const detail =
            payload && typeof payload === "object" && "detail" in payload
              ? String(payload.detail)
              : "Notebook verisi alınamadı.";
          throw new Error(detail);
        }
        const parsed = analysisNotebookResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("Notebook formatı doğrulanamadı.");
        }
        if (!cancelled) {
          setNotebookMarkdown(parsed.data.notebookMarkdown);
          if (typeof window !== "undefined" && notebookDraftStorageKey) {
            window.localStorage.setItem(
              notebookDraftStorageKey,
              parsed.data.notebookMarkdown
            );
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "Notebook yüklenemedi.";
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setIsNotebookLoading(false);
        }
      }
    };

    void loadNotebook();
    return () => {
      cancelled = true;
    };
  }, [analysisId, notebookDraftStorageKey]);

  useEffect(() => {
    return () => {
      if (notebookSaveTimerRef.current !== null) {
        window.clearTimeout(notebookSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!analysisId) {
      return;
    }

    let cancelled = false;
    const loadAnalysisMeta = async () => {
      try {
        const response = await fetchApiWithAuth(`/api/job/${analysisId}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || typeof payload !== "object") {
          return;
        }

        const rawFileName = String((payload as { file_name?: unknown }).file_name ?? "-");
        const extension = rawFileName.includes(".")
          ? rawFileName.slice(rawFileName.lastIndexOf(".")).toLowerCase()
          : "-";

        if (!cancelled) {
          setFileName(rawFileName || "-");
          setFileType(extension);
        }
      } catch {
        // sessiz: tablo default değerlerle çalışır
      }
    };

    void loadAnalysisMeta();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  useEffect(() => {
    if (!analysisId) {
      return;
    }

    let cancelled = false;
    const loadMethods = async () => {
      setIsLoadingMethods(true);
      try {
        const response = await fetchApiWithAuth(`/api/analysis/${analysisId}/methods`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error("Methods verisi alınamadı.");
        }
        const parsed = analysisMethodsResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("Methods verisi doğrulanamadı.");
        }
        if (!cancelled) {
          setMethodsPayload(parsed.data);
        }
      } catch {
        if (!cancelled) {
          setMethodsPayload(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMethods(false);
        }
      }
    };

    void loadMethods();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  const saveNotebook = async (value: string, options?: { silent?: boolean }) => {
    if (!analysisId) {
      return;
    }

    const parsedRequest = analysisNotebookUpdateRequestSchema.safeParse({ markdown: value });
    if (!parsedRequest.success) {
      if (!options?.silent) {
        toast.error("Notebook içeriği geçersiz.");
      }
      return;
    }

    setIsNotebookSaving(true);
    try {
      const response = await fetchApiWithAuth(`/api/analysis/${analysisId}/notebook`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedRequest.data),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 404) {
        if (!options?.silent) {
          toast.info("Notebook endpoint'i bulunamadı. Notlar local olarak saklanıyor.");
        }
        return;
      }
      if (!response.ok) {
        const detail =
          payload && typeof payload === "object" && "detail" in payload
            ? String(payload.detail)
            : "Notebook kaydedilemedi.";
        throw new Error(detail);
      }
      const parsed = analysisNotebookResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Notebook yanıtı doğrulanamadı.");
      }
      if (!options?.silent) {
        toast.success("Notebook kaydedildi.");
      }
    } catch (saveError) {
      if (!options?.silent) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "Notebook kaydedilemedi.";
        toast.error(message);
      }
    } finally {
      setIsNotebookSaving(false);
    }
  };

  const scheduleNotebookSave = (value: string) => {
    if (notebookSaveTimerRef.current !== null) {
      window.clearTimeout(notebookSaveTimerRef.current);
    }
    notebookSaveTimerRef.current = window.setTimeout(() => {
      void saveNotebook(value, { silent: true });
    }, 1200);
  };

  const significantVariants = useMemo(() => {
    return data
      .filter(
        (row) =>
          row.pValue <= pValueThreshold &&
          Math.abs(row.log2FoldChange) >= log2FcThreshold
      )
      .sort((a, b) => {
        if (a.pValue !== b.pValue) {
          return a.pValue - b.pValue;
        }
        return Math.abs(b.log2FoldChange) - Math.abs(a.log2FoldChange);
      })
      .slice(0, 120);
  }, [data, log2FcThreshold, pValueThreshold]);

  const basketGeneSet = useMemo(
    () => new Set(basketItems.map((item) => item.geneId.toUpperCase())),
    [basketItems]
  );

  const basketVariantRows = useMemo(
    () =>
      significantVariants.filter((row) =>
        basketGeneSet.has(row.genId.toUpperCase())
      ),
    [basketGeneSet, significantVariants]
  );

  const hasBasketGenes = basketItems.length > 0;
  const thresholdGeneSet = useMemo(
    () => new Set(significantVariants.map((row) => row.genId.toUpperCase())),
    [significantVariants]
  );

  const displayVariants = useMemo(() => {
    if (!showBasketOnly || !hasBasketGenes) {
      return significantVariants;
    }
    return basketVariantRows;
  }, [basketVariantRows, hasBasketGenes, showBasketOnly, significantVariants]);

  const displayDrugRows = useMemo(() => {
    const thresholdScoped = drugRows.filter((row) =>
      thresholdGeneSet.has(row.gene.toUpperCase())
    );
    if (!showBasketOnly || !hasBasketGenes) {
      return thresholdScoped;
    }
    return thresholdScoped.filter((row) =>
      basketGeneSet.has(row.gene.toUpperCase())
    );
  }, [basketGeneSet, drugRows, hasBasketGenes, showBasketOnly, thresholdGeneSet]);

  const enrichmentRows = useMemo(
    () => computeFunctionalEnrichment(displayVariants),
    [displayVariants]
  );
  const enrichmentByCategory = useMemo(
    () => topTermsByCategory(enrichmentRows, 6),
    [enrichmentRows]
  );
  const interactionNetwork = useMemo(
    () => buildInteractionNetwork(displayVariants, 20),
    [displayVariants]
  );

  const analysisParameters = useMemo<AnalysisParameterRow[]>(
    () => [
      { key: "Reference Genome", value: "hg38" },
      { key: "Input File", value: fileName },
      { key: "File Type", value: fileType },
      { key: "P-Value Threshold", value: pValueThreshold.toFixed(3) },
      { key: "Log2FC Threshold (|x|)", value: log2FcThreshold.toFixed(2) },
      { key: "Filtered Gene Count", value: String(significantVariants.length) },
      {
        key: "Enrichment Candidate Genes (adj p < 0.05)",
        value: String(significantVariants.filter((row) => row.adjustedPValue < 0.05).length),
      },
    ],
    [fileName, fileType, log2FcThreshold, pValueThreshold, significantVariants]
  );

  const methodologyRows = useMemo<AnalysisParameterRow[]>(() => {
    if (methodsPayload?.methodology && Object.keys(methodsPayload.methodology).length > 0) {
      return Object.entries(methodsPayload.methodology).map(([key, value]) => ({
        key: key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        value,
      }));
    }

    return [
      { key: "Normalization", value: "CPM/RPKM-benzeri proxy yaklaşım" },
      { key: "Statistical Test", value: "Wald-benzeri proxy test" },
      { key: "Multiple Testing", value: "Benjamini-Hochberg FDR" },
      { key: "Significance Rule", value: "p < 0.05 ve |log2FC| > 1.5" },
    ];
  }, [methodsPayload?.methodology]);

  const reportParameters = useMemo<AnalysisParameterRow[]>(
    () =>
      methodsPayload?.parameters && methodsPayload.parameters.length > 0
        ? methodsPayload.parameters
        : analysisParameters,
    [analysisParameters, methodsPayload?.parameters]
  );

  const pythonLibraries = useMemo(
    () => methodsPayload?.python_libraries ?? [],
    [methodsPayload?.python_libraries]
  );

  const criticalMutations = useMemo(() => {
    return displayVariants.slice(0, 12).map((row, index) => ({
      gene: row.genId,
      intensity: Math.min(1, Math.abs(row.log2FoldChange) / 4.5),
      index,
    }));
  }, [displayVariants]);

  const dnaPdfSnapshotUrl = useMemo(
    () => buildHelixSnapshotDataUrl(criticalMutations),
    [criticalMutations]
  );

  useEffect(() => {
    if (!criticalMutations.length) {
      setSelectedGene(null);
      return;
    }

    const available = new Set(criticalMutations.map((item) => item.gene.toUpperCase()));
    if (!selectedGene || !available.has(selectedGene.toUpperCase())) {
      setSelectedGene(criticalMutations[0].gene);
    }
  }, [criticalMutations, selectedGene]);

  const selectedVariant = useMemo(() => {
    if (!selectedGene) {
      return null;
    }
    return displayVariants.find((row) => row.genId.toUpperCase() === selectedGene.toUpperCase()) ?? null;
  }, [displayVariants, selectedGene]);

  const selectedDrugRows = useMemo(() => {
    if (!selectedGene) {
      return displayDrugRows;
    }
    const filtered = displayDrugRows.filter(
      (row) => row.gene.toUpperCase() === selectedGene.toUpperCase()
    );
    return filtered.length ? filtered : displayDrugRows;
  }, [displayDrugRows, selectedGene]);

  const selectedGeneMutationHints = useMemo(() => {
    if (!selectedGene) {
      return [];
    }
    return drugRows
      .filter((row) => row.gene.toUpperCase() === selectedGene.toUpperCase())
      .map((row) => row.mutation)
      .filter((mutation) => mutation.trim().length > 0);
  }, [drugRows, selectedGene]);

  const pathwayImpactedGenes = useMemo(() => {
    const genes = new Set<string>();
    criticalMutations.forEach((row) => genes.add(row.gene.toUpperCase()));
    selectedDrugRows.forEach((row) => genes.add(row.gene.toUpperCase()));
    return Array.from(genes);
  }, [criticalMutations, selectedDrugRows]);

  const clinicalScore = useMemo(() => {
    const significantCount = significantVariants.length;
    const criticalCount = (clinicalSummary?.geneInteractions ?? []).filter(
      (row) => row.riskLevel === "critical"
    ).length;
    const therapyCoverage = drugRows.length;
    const score = Math.round(
      Math.min(100, significantCount * 0.6 + criticalCount * 14 + Math.max(0, 40 - therapyCoverage * 2))
    );
    return Math.max(0, score);
  }, [clinicalSummary?.geneInteractions, significantVariants.length, drugRows.length]);

  const scoreTone = toRiskTone(clinicalScore);
  const mutationBurden = useMemo(() => {
    const significantCount = significantVariants.length;
    if (significantCount >= 100) return "Yüksek";
    if (significantCount >= 35) return "Orta";
    return "Düşük";
  }, [significantVariants.length]);
  const therapyBadge = drugRows.length > 0 ? "Mevcut" : "Sınırlı";

  const fallbackExecutive = useMemo(
    () => (analysisId ? buildExecutiveFallback(analysisId, significantVariants, drugRows) : []),
    [analysisId, significantVariants, drugRows]
  );

  const reportGeneratedAt = useMemo(
    () => methodsPayload?.generated_at ?? clinicalSummary?.generatedAt ?? "-",
    [clinicalSummary?.generatedAt, methodsPayload?.generated_at]
  );

  const handleExcelExport = async () => {
    if (!analysisId) {
      toast.error("Geçersiz analiz kimliği.");
      return;
    }

    setIsExcelExporting(true);
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Bio Dash";
      workbook.lastModifiedBy = "Bio Dash";
      workbook.created = new Date();
      workbook.modified = new Date();

      const headerFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FF111827" },
      };
      const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      const headerBorder = {
        top: { style: "thin" as const, color: { argb: "FF374151" } },
        left: { style: "thin" as const, color: { argb: "FF374151" } },
        bottom: { style: "thin" as const, color: { argb: "FF374151" } },
        right: { style: "thin" as const, color: { argb: "FF374151" } },
      };
      const bodyBorder = {
        top: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
        left: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
        right: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
      };

      const variantsSheet = workbook.addWorksheet("Significant Variants", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      variantsSheet.columns = [
        { header: "Gene ID", key: "genId", width: 18 },
        { header: "Log2 Fold Change", key: "log2FoldChange", width: 18 },
        { header: "P-Value", key: "pValue", width: 14 },
        { header: "Adjusted P-Value", key: "adjustedPValue", width: 18 },
        { header: "Expression Level", key: "expressionLevel", width: 16 },
      ];
      displayVariants.forEach((row) => {
        variantsSheet.addRow({
          genId: row.genId,
          log2FoldChange: row.log2FoldChange,
          pValue: row.pValue,
          adjustedPValue: row.adjustedPValue,
          expressionLevel: row.expressionLevel,
        });
      });
      if (!displayVariants.length) {
        variantsSheet.addRow({
          genId: "No data",
          log2FoldChange: 0,
          pValue: 1,
          adjustedPValue: 1,
          expressionLevel: 0,
        });
      }
      variantsSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 5 },
      };
      const variantsHeaderRow = variantsSheet.getRow(1);
      variantsHeaderRow.font = headerFont;
      variantsHeaderRow.fill = headerFill;
      variantsHeaderRow.height = 24;
      variantsHeaderRow.alignment = { vertical: "middle", horizontal: "left" };
      variantsHeaderRow.eachCell((cell) => {
        cell.border = headerBorder;
      });
      variantsSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }
        row.eachCell((cell) => {
          cell.border = bodyBorder;
        });
        const log2FoldValue = Number(row.getCell(2).value ?? 0);
        const pValue = Number(row.getCell(3).value ?? 1);
        row.getCell(2).font = {
          color: { argb: log2FoldValue >= 0 ? "FFDC2626" : "FF2563EB" },
        };
        if (pValue < 0.05) {
          row.getCell(3).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD1FAE5" },
          };
        }
      });

      const treatmentSheet = workbook.addWorksheet("Treatment Suggestions", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      treatmentSheet.columns = [
        { header: "Gene", key: "gene", width: 16 },
        { header: "Mutation", key: "mutation", width: 28 },
        { header: "Recommended Therapy", key: "recommendedTherapy", width: 30 },
        { header: "Drug", key: "drug", width: 22 },
        { header: "Evidence Level", key: "evidenceLevel", width: 18 },
        { header: "Reference URL", key: "referenceUrl", width: 34 },
      ];
      selectedDrugRows.forEach((row) => {
        treatmentSheet.addRow({
          gene: row.gene,
          mutation: row.mutation,
          recommendedTherapy: row.recommendedTherapy,
          drug: row.drug,
          evidenceLevel: row.evidenceLevel,
          referenceUrl: row.referenceUrl,
        });
      });
      if (!selectedDrugRows.length) {
        treatmentSheet.addRow({
          gene: "No match",
          mutation: "-",
          recommendedTherapy: "-",
          drug: "-",
          evidenceLevel: "-",
          referenceUrl: "-",
        });
      }
      treatmentSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 6 },
      };
      const treatmentHeaderRow = treatmentSheet.getRow(1);
      treatmentHeaderRow.font = headerFont;
      treatmentHeaderRow.fill = headerFill;
      treatmentHeaderRow.height = 24;
      treatmentHeaderRow.alignment = { vertical: "middle", horizontal: "left" };
      treatmentHeaderRow.eachCell((cell) => {
        cell.border = headerBorder;
      });
      treatmentSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }
        row.eachCell((cell) => {
          cell.border = bodyBorder;
          cell.alignment = { wrapText: true, vertical: "top" };
        });
      });

      const methodsSheet = workbook.addWorksheet("Methods", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      methodsSheet.columns = [
        { header: "Parameter", key: "parameter", width: 34 },
        { header: "Value", key: "value", width: 80 },
      ];
      reportParameters.forEach((row) => {
        methodsSheet.addRow({ parameter: row.key, value: row.value });
      });
      methodsSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 2 },
      };
      const methodsHeaderRow = methodsSheet.getRow(1);
      methodsHeaderRow.font = headerFont;
      methodsHeaderRow.fill = headerFill;
      methodsHeaderRow.height = 24;
      methodsHeaderRow.alignment = { vertical: "middle", horizontal: "left" };
      methodsHeaderRow.eachCell((cell) => {
        cell.border = headerBorder;
      });
      methodsSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }
        row.eachCell((cell) => {
          cell.border = bodyBorder;
          cell.alignment = { wrapText: true, vertical: "top" };
        });
      });

      methodsSheet.addRow({});
      const methodologyTitleRow = methodsSheet.addRow({
        parameter: "Methodology",
        value: "",
      });
      methodologyTitleRow.font = { bold: true, color: { argb: "FF0F172A" } };
      methodologyRows.forEach((row) => {
        methodsSheet.addRow({ parameter: row.key, value: row.value });
      });
      methodsSheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) {
          return;
        }
        row.eachCell((cell) => {
          if (!cell.border) {
            cell.border = bodyBorder;
          }
        });
      });

      const librariesSheet = workbook.addWorksheet("Python Libraries", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      librariesSheet.columns = [
        { header: "Library", key: "name", width: 30 },
        { header: "Version", key: "version", width: 24 },
      ];
      pythonLibraries.forEach((library) => {
        librariesSheet.addRow({ name: library.name, version: library.version });
      });
      if (!pythonLibraries.length) {
        librariesSheet.addRow({ name: "No data", version: "-" });
      }
      librariesSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 2 },
      };
      const librariesHeaderRow = librariesSheet.getRow(1);
      librariesHeaderRow.font = headerFont;
      librariesHeaderRow.fill = headerFill;
      librariesHeaderRow.height = 24;
      librariesHeaderRow.alignment = { vertical: "middle", horizontal: "left" };
      librariesHeaderRow.eachCell((cell) => {
        cell.border = headerBorder;
      });
      librariesSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }
        row.eachCell((cell) => {
          cell.border = bodyBorder;
        });
      });

      const excelBuffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bio-dash-analysis-${analysisId}-report.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Excel raporu indirildi.");
    } catch {
      toast.error("Excel raporu oluşturulamadı.");
    } finally {
      setIsExcelExporting(false);
    }
  };

  const preparePlotlyForPrint = useCallback(async () => {
    if (isPrintPreparedRef.current) {
      return;
    }
    const reportSection = reportSectionRef.current;
    if (!reportSection) {
      return;
    }

    try {
      const plotlyModule = await import("plotly.js-dist-min");
      const Plotly = (plotlyModule.default ?? plotlyModule) as unknown as {
        relayout: (graphDiv: unknown, layout: Record<string, unknown>) => Promise<unknown>;
        restyle: (
          graphDiv: unknown,
          update: Record<string, unknown>,
          traces?: number[] | number
        ) => Promise<unknown>;
      };

      const graphDivs = Array.from(
        reportSection.querySelectorAll<HTMLElement>(".js-plotly-plot")
      );
      plotlyPrintSnapshotsRef.current = [];

      for (const graph of graphDivs) {
        const anyGraph = graph as unknown as {
          layout?: { autosize?: boolean; width?: number; height?: number };
          data?: Array<{ type?: string }>;
        };

        const originalLayout = anyGraph.layout ?? {};
        const layoutRecord = toRecord(anyGraph.layout);
        const layoutSnapshot = cloneLayoutSnapshot(layoutRecord);
        const traces = Array.isArray(anyGraph.data) ? anyGraph.data : [];
        const glTraceIndexes = traces
          .map((trace, index) =>
            String(trace?.type ?? "")
              .toLowerCase()
              .includes("gl")
              ? index
              : -1
          )
          .filter((index) => index >= 0);

        plotlyPrintSnapshotsRef.current.push({
          graph,
          autosize: originalLayout.autosize ?? true,
          width:
            typeof originalLayout.width === "number" ? originalLayout.width : null,
          height:
            typeof originalLayout.height === "number" ? originalLayout.height : null,
          glTraceIndexes,
          layoutSnapshot,
        });

        if (glTraceIndexes.length > 0) {
          await Plotly.restyle(graph, { type: "scatter" }, glTraceIndexes);
        }

        const currentRect = graph.getBoundingClientRect();
        const targetWidth = 800;
        const aspectRatio = currentRect.width > 0 ? currentRect.height / currentRect.width : 0.56;
        const targetHeight = Math.max(360, Math.round(targetWidth * aspectRatio));

        const relayoutPayload: Record<string, unknown> = {
          autosize: false,
          width: targetWidth,
          height: targetHeight,
          paper_bgcolor: "#ffffff",
          plot_bgcolor: "#ffffff",
          font: {
            color: "#0f172a",
            family: "Times New Roman, Georgia, serif",
            size: 11,
          },
          legend: {
            bgcolor: "rgba(255,255,255,0.98)",
            bordercolor: "#cbd5e1",
            borderwidth: 1,
            font: {
              color: "#0f172a",
            },
          },
        };

        if (layoutRecord) {
          for (const [key, value] of Object.entries(layoutRecord)) {
            if (/^[xy]axis\d*$/u.test(key)) {
              relayoutPayload[key] = buildPrintAxisStyle(value);
            }
          }
        }

        await Plotly.relayout(graph, relayoutPayload);
      }

      document.documentElement.classList.add("print-layout-active");
      isPrintPreparedRef.current = true;
    } catch {
      // Plotly import/relayout başarısız olsa bile tarayıcı native print devam edebilir.
    }
  }, []);

  const restorePlotlyAfterPrint = useCallback(async () => {
    if (!isPrintPreparedRef.current) {
      setIsPdfExporting(false);
      return;
    }

    try {
      const plotlyModule = await import("plotly.js-dist-min");
      const Plotly = (plotlyModule.default ?? plotlyModule) as unknown as {
        relayout: (graphDiv: unknown, layout: Record<string, unknown>) => Promise<unknown>;
        restyle: (
          graphDiv: unknown,
          update: Record<string, unknown>,
          traces?: number[] | number
        ) => Promise<unknown>;
      };

      for (const snapshot of plotlyPrintSnapshotsRef.current) {
        const {
          graph,
          autosize,
          width,
          height,
          glTraceIndexes,
          layoutSnapshot,
        } = snapshot;
        if (glTraceIndexes.length > 0) {
          await Plotly.restyle(graph, { type: "scattergl" }, glTraceIndexes);
        }

        if (layoutSnapshot) {
          await Plotly.relayout(graph, layoutSnapshot);
        } else {
          await Plotly.relayout(graph, {
            autosize,
            width,
            height,
          });
        }
      }
    } catch {
      // restore aşamasında hata olsa da ekran kullanılabilir kalır.
    } finally {
      plotlyPrintSnapshotsRef.current = [];
      isPrintPreparedRef.current = false;
      document.documentElement.classList.remove("print-layout-active");
      setIsPdfExporting(false);
    }
  }, []);

  useEffect(() => {
    const handleBeforePrint = () => {
      void preparePlotlyForPrint();
    };
    const handleAfterPrint = () => {
      void restorePlotlyAfterPrint();
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [preparePlotlyForPrint, restorePlotlyAfterPrint]);

  const handleScientificPdfExport = async () => {
    if (!analysisId) {
      toast.error("Geçersiz analiz kimliği.");
      return;
    }

    const reportSection = reportSectionRef.current;
    if (!reportSection) {
      toast.error("Rapor alanı bulunamadı.");
      return;
    }

    setIsPdfExporting(true);

    const restoreInlineStyles: Array<() => void> = [];
    const wasTechnicalOpen = openTechnical;

    try {
      if (!openTechnical) {
        setOpenTechnical(true);
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }

      await preparePlotlyForPrint();
      document.documentElement.classList.add("pdf-export-active", "print-mode");

      // 3D/WebGL alanlar PDF'e stabil düşsün diye export sırasında fallback görünümünü zorla.
      const live3dNodes = Array.from(
        reportSection.querySelectorAll<HTMLElement>("[data-pdf-3d-live]")
      );
      const fallback3dNodes = Array.from(
        reportSection.querySelectorAll<HTMLElement>("[data-pdf-fallback]")
      );
      const snapshotImages = Array.from(
        reportSection.querySelectorAll<HTMLImageElement>("img[data-pdf-snapshot-img]")
      );

      for (const imageNode of snapshotImages) {
        const previousSrc = imageNode.getAttribute("src");
        restoreInlineStyles.push(() => {
          if (previousSrc === null) {
            imageNode.removeAttribute("src");
          } else {
            imageNode.setAttribute("src", previousSrc);
          }
        });
      }

      const captureCanvasToPng = (sourceCanvas: HTMLCanvasElement, scale = 3) => {
        const targetCanvas = document.createElement("canvas");
        targetCanvas.width = Math.max(1, Math.floor(sourceCanvas.width * scale));
        targetCanvas.height = Math.max(1, Math.floor(sourceCanvas.height * scale));
        const context = targetCanvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas context oluşturulamadı.");
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
        context.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
        return targetCanvas.toDataURL("image/png");
      };

      const viewerContainers = Array.from(
        reportSection.querySelectorAll<HTMLElement>("[data-pdf-3d]")
      );
      for (const container of viewerContainers) {
        const sourceCanvas = container.querySelector<HTMLCanvasElement>("[data-pdf-3d-live] canvas");
        const snapshotImage = container.querySelector<HTMLImageElement>(
          "img[data-pdf-snapshot-img][data-pdf-capture-source=\"canvas\"]"
        );
        if (!snapshotImage || !sourceCanvas) {
          continue;
        }

        try {
          const snapshotUrl = captureCanvasToPng(sourceCanvas, 3);
          if (snapshotUrl.length > 64) {
            snapshotImage.src = snapshotUrl;
          }
        } catch {
          // 3D canvas capture başarısız olursa mevcut fallback (SVG/metin) kullanılmaya devam eder.
        }
      }

      for (const node of live3dNodes) {
        const previousStyle = node.getAttribute("style");
        restoreInlineStyles.push(() => {
          if (previousStyle === null) {
            node.removeAttribute("style");
          } else {
            node.setAttribute("style", previousStyle);
          }
        });
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
      }

      for (const node of fallback3dNodes) {
        const previousStyle = node.getAttribute("style");
        restoreInlineStyles.push(() => {
          if (previousStyle === null) {
            node.removeAttribute("style");
          } else {
            node.setAttribute("style", previousStyle);
          }
        });
        node.style.setProperty("display", "block", "important");
        node.style.setProperty("visibility", "visible", "important");
        node.style.setProperty("opacity", "1", "important");
      }

      await new Promise((resolve) => window.setTimeout(resolve, 180));

      if (typeof document !== "undefined" && "fonts" in document) {
        const fontSet = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
        if (fontSet?.ready) {
          await fontSet.ready;
        }
      }

      const imageElements = Array.from(reportSection.querySelectorAll<HTMLImageElement>("img"));
      await Promise.all(
        imageElements.map((imageElement) => {
          if (imageElement.complete) {
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            imageElement.onload = () => resolve();
            imageElement.onerror = () => resolve();
          });
        })
      );

      const allBlocks = Array.from(
        reportSection.querySelectorAll<HTMLElement>("[data-pdf-block]")
      ).filter((node) => {
        const style = window.getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden";
      });

      if (allBlocks.length === 0) {
        throw new Error("PDF için yakalanacak rapor bloğu bulunamadı.");
      }

      const unsortedBlocks = allBlocks.filter(
        (node) => normalizePdfText(node.dataset.pdfSection?.trim() || "misc") !== "clinical-summary"
      );
      const sectionOrder = new Map<string, number>([
        ["models", 1],
        ["variants", 2],
        ["survival", 3],
        ["methods", 4],
      ]);
      const blockDomIndex = new Map<HTMLElement, number>();
      unsortedBlocks.forEach((block, index) => {
        blockDomIndex.set(block, index);
      });
      const blocks = [...unsortedBlocks].sort((a, b) => {
        const aSection = normalizePdfText(a.dataset.pdfSection?.trim() || "misc");
        const bSection = normalizePdfText(b.dataset.pdfSection?.trim() || "misc");
        const sectionDelta = (sectionOrder.get(aSection) ?? 99) - (sectionOrder.get(bSection) ?? 99);
        if (sectionDelta !== 0) {
          return sectionDelta;
        }

        const aOrder = Number.parseInt(a.dataset.pdfOrder ?? "0", 10) || 0;
        const bOrder = Number.parseInt(b.dataset.pdfOrder ?? "0", 10) || 0;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        return (blockDomIndex.get(a) ?? 0) - (blockDomIndex.get(b) ?? 0);
      });

      const [{ jsPDF: JsPdfCtor }, htmlToImageModule] = await Promise.all([
        import("jspdf"),
        import("html-to-image"),
      ]);
      const toPng = (
        htmlToImageModule as unknown as {
          toPng?: (
            node: HTMLElement,
            options?: Record<string, unknown>
          ) => Promise<string>;
          default?: {
            toPng?: (
              node: HTMLElement,
              options?: Record<string, unknown>
            ) => Promise<string>;
          };
        }
      ).toPng ??
        (
          htmlToImageModule as unknown as {
            default?: {
              toPng?: (
                node: HTMLElement,
                options?: Record<string, unknown>
              ) => Promise<string>;
            };
          }
        ).default?.toPng;

      if (!toPng) {
        throw new Error("html-to-image toPng fonksiyonu yüklenemedi.");
      }

      const renderNodeAsCanvas = async (node: HTMLElement): Promise<HTMLCanvasElement> => {
        const dataUrl = await toPng(node, {
          backgroundColor: "#ffffff",
          cacheBust: true,
          pixelRatio: 3,
          skipAutoScale: true,
        });

        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const htmlImage = new Image();
          htmlImage.onload = () => resolve(htmlImage);
          htmlImage.onerror = () => reject(new Error("PDF görseli hazırlanamadı."));
          htmlImage.src = dataUrl;
        });

        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas context oluşturulamadı.");
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        return canvas;
      };

      const pdf = new JsPdfCtor({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
        putOnlyUsedFonts: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 15;
      const marginTop = 15;
      const marginBottom = 15;
      const headerHeight = 8;
      const footerHeight = 8;
      const sectionTitleHeight = 8;
      const blockGap = 6;
      const contentTop = marginTop + headerHeight;
      const contentBottom = pageHeight - marginBottom - footerHeight;
      const contentWidth = pageWidth - marginX * 2;
      const pageSections: string[] = [];
      const sectionStartPages = new Map<string, { title: string; page: number }>();
      let tocPageNumber: number | null = null;

      const setPageSection = (page: number, label: string) => {
        pageSections[page] = normalizePdfText(label);
      };

      // Kapak sayfası
      setPageSection(1, "Kapak");
      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.5);
      pdf.rect(marginX, marginTop, pageWidth - marginX * 2, pageHeight - marginTop - marginBottom);

      pdf.setTextColor(15, 23, 42);
      pdf.setFont("times", "bold");
      pdf.setFontSize(16);
      pdf.text(normalizePdfText("Bio-Dash Klinik Analiz Raporu"), pageWidth / 2, 42, { align: "center" });

      pdf.setFont("times", "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(71, 85, 105);
      pdf.text(normalizePdfText("Klinik Karar Destek Ciktisi"), pageWidth / 2, 51, { align: "center" });

      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.25);
      pdf.line(marginX + 8, 58, pageWidth - marginX - 8, 58);

      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(11);
      pdf.text(normalizePdfText(`Analiz ID: ${analysisId}`), marginX + 10, 72);
      pdf.text(normalizePdfText(`Uretim Zamani: ${reportGeneratedAt}`), marginX + 10, 79);
      pdf.text(normalizePdfText(`Klinik Skor: ${clinicalScore}`), marginX + 10, 86);
      pdf.text(
        normalizePdfText(`Anlamli Varyant: ${significantVariants.length.toLocaleString("tr-TR")}`),
        marginX + 10,
        93
      );
      pdf.text(
        normalizePdfText(`Tedavi Eslesmesi: ${displayDrugRows.length.toLocaleString("tr-TR")}`),
        marginX + 10,
        100
      );

      const drawSummaryBadge = (
        x: number,
        y: number,
        title: string,
        value: string
      ) => {
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(203, 213, 225);
        pdf.roundedRect(x, y, 56, 18, 2, 2, "FD");
        pdf.setFont("times", "normal");
        pdf.setTextColor(71, 85, 105);
        pdf.setFontSize(8);
        pdf.text(normalizePdfText(title), x + 3, y + 6);
        pdf.setFont("times", "bold");
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(11);
        pdf.text(normalizePdfText(value), x + 3, y + 13);
      };

      drawSummaryBadge(marginX + 10, 116, "Mutasyon Yuku", mutationBurden);
      drawSummaryBadge(marginX + 70, 116, "Tedavi Uyumu", therapyBadge);
      drawSummaryBadge(marginX + 130, 116, "Risk Sinifi", scoreTone.label);

      const coverExecutiveLines = (executiveSummary.length ? executiveSummary : fallbackExecutive).slice(0, 3);
      let coverY = 144;
      pdf.setFont("times", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.text("Klinik Ozet ve Executive Summary", marginX + 10, coverY);
      coverY += 6;
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.25);
      pdf.line(marginX + 10, coverY, pageWidth - marginX - 10, coverY);
      coverY += 4;

      pdf.setFont("times", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(26, 26, 26);
      for (const line of coverExecutiveLines) {
        const normalized = normalizePdfText(line.endsWith(".") ? line : `${line}.`);
        const wrapped = pdf.splitTextToSize(normalized, pageWidth - marginX * 2 - 22);
        pdf.text(wrapped, marginX + 12, coverY);
        coverY += wrapped.length * 5 + 3;
      }

      pdf.setFont("times", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        normalizePdfText("Bu rapor klinik karar destegi amaciyla olusturulmustur; nihai karar icin uzman dogrulamasi gereklidir."),
        marginX + 10,
        pageHeight - 26,
        { maxWidth: pageWidth - marginX * 2 - 20 }
      );

      let currentPage = 1;
      let currentY = contentTop;
      sectionStartPages.set("clinical-summary", { title: "Klinik Ozet", page: 1 });
      const addContentPage = (sectionLabel: string) => {
        pdf.addPage();
        currentPage += 1;
        currentY = contentTop;
        setPageSection(currentPage, sectionLabel);
      };

      const drawSectionHeader = (title: string) => {
        pdf.setFont("times", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text(title, marginX, currentY + 4.5);
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.25);
        pdf.line(marginX, currentY + 6.3, pageWidth - marginX, currentY + 6.3);
        currentY += sectionTitleHeight;
      };

      if (blocks.length > 0) {
        addContentPage("Icindekiler");
        tocPageNumber = currentPage;
        addContentPage("Rapor Icerigi");
      }

      let hasStartedMainSection = false;
      let previousSectionKey: string | null = null;
      for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];
        const blockTitle = normalizePdfText(block.dataset.pdfTitle?.trim() || `Bolum ${index + 1}`);
        const sectionKey = normalizePdfText(block.dataset.pdfSection?.trim() || "misc");
        const sectionTitle = normalizePdfText(
          block.dataset.pdfSectionTitle?.trim() || blockTitle
        );
        const singlePageBlock = block.dataset.pdfSinglePage === "true";
        const repeatHeaderOnContinuation =
          block.dataset.pdfTableRepeatHeader === "true";
        const allowSplit = block.dataset.pdfAllowSplit === "true";
        const tableHeaderPx = Math.max(
          0,
          Number.parseInt(block.dataset.pdfTableHeaderPx ?? "0", 10) || 0
        );
        const tableRowPx = Math.max(
          0,
          Number.parseInt(block.dataset.pdfTableRowPx ?? "0", 10) || 0
        );
        const canvas = await renderNodeAsCanvas(block);

        if (!hasStartedMainSection) {
          hasStartedMainSection = true;
          currentY = contentTop;
          setPageSection(currentPage, sectionTitle);
        } else if (previousSectionKey !== sectionKey) {
          addContentPage(sectionTitle);
        } else if (currentY + sectionTitleHeight + 18 > contentBottom) {
          addContentPage(sectionTitle);
        }

        if (!sectionStartPages.has(sectionKey)) {
          sectionStartPages.set(sectionKey, { title: sectionTitle, page: currentPage });
        }
        previousSectionKey = sectionKey;

        let sourceYpx = 0;
        let remainingPx = canvas.height;

        const renderedHeightMm = (canvas.height * contentWidth) / canvas.width;
        const pxPerMm = canvas.height / renderedHeightMm;

        if (singlePageBlock) {
          drawSectionHeader(blockTitle);

          const availableMm = Math.max(20, contentBottom - currentY);
          const targetHeightMm = Math.min(availableMm, renderedHeightMm);
          const targetWidthMm = (targetHeightMm * canvas.width) / canvas.height;
          const drawX = marginX + Math.max(0, (contentWidth - targetWidthMm) / 2);
          const imageData = canvas.toDataURL("image/jpeg", 0.96);

          pdf.addImage(
            imageData,
            "JPEG",
            drawX,
            currentY,
            targetWidthMm,
            targetHeightMm,
            undefined,
            "FAST"
          );

          currentY += targetHeightMm + blockGap;
          continue;
        }

        if (!allowSplit) {
          if (currentY + sectionTitleHeight + renderedHeightMm > contentBottom) {
            addContentPage(sectionTitle);
          }
          drawSectionHeader(blockTitle);

          const availableMm = Math.max(20, contentBottom - currentY);
          const targetHeightMm = Math.min(availableMm, renderedHeightMm);
          const targetWidthMm =
            targetHeightMm < renderedHeightMm
              ? (targetHeightMm * canvas.width) / canvas.height
              : contentWidth;
          const drawX = marginX + Math.max(0, (contentWidth - targetWidthMm) / 2);
          const imageData = canvas.toDataURL("image/jpeg", 0.96);
          pdf.addImage(
            imageData,
            "JPEG",
            drawX,
            currentY,
            targetWidthMm,
            targetHeightMm,
            undefined,
            "FAST"
          );

          currentY += targetHeightMm + blockGap;
          continue;
        }

        let isContinuation = false;
        while (remainingPx > 0) {
          if (currentY + sectionTitleHeight + 16 > contentBottom) {
            addContentPage(isContinuation ? `${blockTitle} (Devam)` : blockTitle);
          }

          drawSectionHeader(isContinuation ? `${blockTitle} (Devam)` : blockTitle);

          if (isContinuation && repeatHeaderOnContinuation && tableHeaderPx > 0) {
            const repeatPx = Math.min(tableHeaderPx, canvas.height);
            const repeatMm = repeatPx / pxPerMm;
            if (currentY + repeatMm + 10 > contentBottom) {
              addContentPage(`${blockTitle} (Devam)`);
              drawSectionHeader(`${blockTitle} (Devam)`);
            }

            const repeatCanvas = document.createElement("canvas");
            repeatCanvas.width = canvas.width;
            repeatCanvas.height = repeatPx;
            const repeatCtx = repeatCanvas.getContext("2d");
            if (!repeatCtx) {
              throw new Error("Canvas context oluşturulamadı.");
            }
            repeatCtx.fillStyle = "#ffffff";
            repeatCtx.fillRect(0, 0, repeatCanvas.width, repeatCanvas.height);
            repeatCtx.drawImage(
              canvas,
              0,
              0,
              canvas.width,
              repeatPx,
              0,
              0,
              repeatCanvas.width,
              repeatCanvas.height
            );

            const repeatImageData = repeatCanvas.toDataURL("image/jpeg", 0.96);
            pdf.addImage(
              repeatImageData,
              "JPEG",
              marginX,
              currentY,
              contentWidth,
              repeatMm,
              undefined,
              "FAST"
            );
            currentY += repeatMm + 2;
          }

          const availableMm = Math.max(10, contentBottom - currentY);
          const availablePx = Math.max(1, Math.floor(availableMm * pxPerMm));
          let slicePx = Math.min(remainingPx, availablePx);
          if (tableRowPx > 0 && remainingPx > slicePx && slicePx > tableRowPx * 2) {
            const snapped = Math.floor(slicePx / tableRowPx) * tableRowPx;
            if (snapped >= tableRowPx) {
              slicePx = snapped;
            }
          }
          const sliceMm = slicePx / pxPerMm;

          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = slicePx;
          const context = sliceCanvas.getContext("2d");
          if (!context) {
            throw new Error("Canvas context oluşturulamadı.");
          }
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          context.drawImage(
            canvas,
            0,
            sourceYpx,
            canvas.width,
            slicePx,
            0,
            0,
            sliceCanvas.width,
            sliceCanvas.height
          );

          const imageData = sliceCanvas.toDataURL("image/jpeg", 0.96);
          pdf.addImage(
            imageData,
            "JPEG",
            marginX,
            currentY,
            contentWidth,
            sliceMm,
            undefined,
            "FAST"
          );

          currentY += sliceMm + blockGap;
          sourceYpx += slicePx;
          remainingPx -= slicePx;
          isContinuation = true;

          if (remainingPx > 0) {
            addContentPage(`${blockTitle} (Devam)`);
          }
        }
      }

      if (tocPageNumber) {
        pdf.setPage(tocPageNumber);
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");

        pdf.setFont("times", "bold");
        pdf.setFontSize(18);
        pdf.setTextColor(15, 23, 42);
        pdf.text("Icindekiler", marginX, marginTop + 10);

        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.25);
        pdf.line(marginX, marginTop + 13, pageWidth - marginX, marginTop + 13);

        pdf.setFont("times", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(51, 65, 85);
        let tocY = marginTop + 22;

        const tocEntries = MAIN_REPORT_SECTIONS
          .map((section) => {
            const entry = sectionStartPages.get(section.key);
            if (!entry) {
              return null;
            }
            return {
              title: `${section.title}`,
              page: entry.page,
            };
          })
          .filter((entry): entry is { title: string; page: number } => Boolean(entry));

        for (const [entryIndex, entry] of tocEntries.entries()) {
          if (tocY > pageHeight - marginBottom - 14) {
            break;
          }

          const label = normalizePdfText(`${entryIndex + 1}. ${entry.title}`);
          pdf.text(label, marginX, tocY, { maxWidth: contentWidth - 16 });
          pdf.text(String(entry.page), pageWidth - marginX, tocY, { align: "right" });
          tocY += 7;
        }
      }

      const approvalBlockHeight = 98;
      if (currentY + approvalBlockHeight > contentBottom) {
        addContentPage("Metotlar ve Onay");
      }

      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.25);
      pdf.line(marginX, currentY + 1, pageWidth - marginX, currentY + 1);

      pdf.setFont("times", "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(14);
      pdf.text(normalizePdfText("Rapor Onayi ve Klinik Imza Alani"), marginX + 4, currentY + 10);
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.25);
      pdf.line(marginX + 4, currentY + 13, pageWidth - marginX - 4, currentY + 13);

      pdf.setFont("times", "normal");
      pdf.setTextColor(26, 26, 26);
      pdf.setFontSize(11);
      const approvalDate = new Date().toLocaleString("tr-TR");
      pdf.text(
        normalizePdfText(
          `Analiz bu tarihte Bio-Dash sistemi tarafindan onaylanmistir: ${approvalDate}`
        ),
        marginX + 4,
        currentY + 24,
        { maxWidth: pageWidth - marginX * 2 - 16 }
      );

      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.25);
      pdf.roundedRect(marginX + 4, currentY + 32, pageWidth - marginX * 2 - 8, 44, 2, 2, "S");
      pdf.setFont("times", "bold");
      pdf.setFontSize(10);
      pdf.text(normalizePdfText("Klinik Onay Notu"), marginX + 8, currentY + 39);
      pdf.setFont("times", "normal");
      pdf.setFontSize(10);
      pdf.text(
        normalizePdfText(
          "Bu rapor arastirma/klinik karar destek amaciyla uretilmistir. Nihai tibbi karar sorumlu uzman tarafindan verilmelidir."
        ),
        marginX + 8,
        currentY + 47,
        { maxWidth: pageWidth - marginX * 2 - 24 }
      );

      pdf.roundedRect(marginX + 4, currentY + 80, pageWidth - marginX * 2 - 8, 24, 2, 2, "S");
      pdf.setFont("times", "bold");
      pdf.setFontSize(10);
      pdf.text(normalizePdfText("Sorumlu Uzman Imza / Kurum Muhru"), marginX + 8, currentY + 89);
      pdf.setFont("times", "normal");
      pdf.setFontSize(9);
      pdf.text(normalizePdfText(`Report ID: ANALYSIS-${analysisId}`), marginX + 8, currentY + 98);

      const totalPages = pdf.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        pdf.setPage(pageNumber);

        if (pageNumber > 1) {
          pdf.setDrawColor(203, 213, 225);
          pdf.setLineWidth(0.25);
          pdf.line(marginX, marginTop + headerHeight - 1.3, pageWidth - marginX, marginTop + headerHeight - 1.3);
          pdf.line(
            marginX,
            pageHeight - marginBottom - footerHeight + 1.3,
            pageWidth - marginX,
            pageHeight - marginBottom - footerHeight + 1.3
          );

          pdf.setTextColor(15, 23, 42);
          pdf.setFont("times", "bold");
          pdf.setFontSize(10);
          pdf.text(normalizePdfText("Bio-Dash Klinik Analiz Raporu"), marginX, marginTop + 2.8);

          pdf.setFont("times", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(120, 127, 140);
          pdf.text(normalizePdfText("OFFICIAL REPORT"), pageWidth - marginX, marginTop + 2.8, {
            align: "right",
          });
          pdf.setDrawColor(203, 213, 225);
          pdf.line(pageWidth - marginX - 33, marginTop + 3.6, pageWidth - marginX, marginTop + 3.6);

          pdf.setFont("times", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(71, 85, 105);
          pdf.text(
            normalizePdfText(pageSections[pageNumber] || "Rapor Icerigi"),
            marginX,
            marginTop + 6
          );
        }

        pdf.setFont("times", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(
          normalizePdfText(
            `Bio-Dash Clinical Intelligence System | Analiz #${analysisId} | Sayfa ${pageNumber} / ${totalPages}`
          ),
          pageWidth / 2,
          pageHeight - marginBottom - 2.4,
          { align: "center" }
        );
      }

      const safeDate = new Date().toISOString().slice(0, 10);
      pdf.save(`bio-dash-clinical-report-${analysisId}-${safeDate}.pdf`);
      toast.success("Klinik PDF raporu başarıyla indirildi.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Klinik PDF raporu oluşturulamadı.";
      toast.error(message);
    } finally {
      for (const restore of restoreInlineStyles.reverse()) {
        restore();
      }
      if (!wasTechnicalOpen) {
        setOpenTechnical(false);
      }
      document.documentElement.classList.remove("pdf-export-active", "print-mode");
      await restorePlotlyAfterPrint();
    }
  };

  const handlePrintReport = async () => {
    if (!analysisId) {
      toast.error("Geçersiz analiz kimliği.");
      return;
    }

    setIsPdfExporting(true);
    await preparePlotlyForPrint();
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    window.print();
    await restorePlotlyAfterPrint();
  };

  return (
    <main
      className="flex-1 overflow-x-hidden p-4 md:p-6 print:p-0"
      data-report-page
    >
      <section
        ref={reportSectionRef}
        className="space-y-8 print:space-y-4 [&_[data-slot=card-content]]:px-6 [&_[data-slot=card-header]]:px-6"
        data-report-section
      >
            <div className="hidden border-b border-slate-300 pb-4 print:block" data-pdf-block data-pdf-title="Report Header">
              <h1 className="text-2xl font-semibold text-slate-900">
                Bio-Dash Klinik Analiz Raporu
              </h1>
              <p className="mt-1 text-sm text-slate-700">
                Analysis ID: {analysisId ?? "-"} | Generated At: {reportGeneratedAt}
              </p>
            </div>
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "clinical" | "functional" | "notebook")}
            >
              <TabsList className="w-fit print:hidden">
                <TabsTrigger value="clinical">Klinik Görünüm</TabsTrigger>
                <TabsTrigger value="functional">Functional Enrichment</TabsTrigger>
                <TabsTrigger value="notebook">Notebook</TabsTrigger>
              </TabsList>

              <TabsContent value="clinical" className="space-y-8">
            <Card className="print:hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Dynamic Filtering</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2 md:place-items-center">
                <div className="w-full max-w-md space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">P-Value Eşiği</p>
                    <Badge variant="secondary">≤ {pValueThreshold.toFixed(3)}</Badge>
                  </div>
                  <input
                    type="range"
                    min={0.001}
                    max={0.1}
                    step={0.001}
                    value={pValueThreshold}
                    onChange={(event) => setPValueThreshold(Number(event.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="w-full max-w-md space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">|Log2FC| Eşiği</p>
                    <Badge variant="secondary">≥ {log2FcThreshold.toFixed(2)}</Badge>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={4}
                    step={0.1}
                    value={log2FcThreshold}
                    onChange={(event) => setLog2FcThreshold(Number(event.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </CardContent>
            </Card>

            <Card
              className="border-zinc-300/70 bg-background/80"
              data-pdf-block
              data-pdf-title="Klinik Skor Ozeti"
              data-pdf-section="clinical-summary"
              data-pdf-section-title="Klinik Ozet"
            >
              <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className="relative grid size-28 place-items-center rounded-full border"
                    style={{
                      backgroundImage: `conic-gradient(${ 
                        clinicalScore >= 75
                          ? "#ef4444"
                          : clinicalScore >= 45
                            ? "#f59e0b"
                            : "#22c55e"
                      } ${Math.max(8, Math.round(clinicalScore * 3.6))}deg, rgba(113,113,122,0.22) 0deg)`,
                    }}
                  >
                    <div className="grid size-20 place-items-center rounded-full border bg-background text-center">
                      <p className="text-[10px] text-muted-foreground">Klinik Skor</p>
                      <p className="text-xl font-semibold">{clinicalScore}</p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                      Klinik Karar Destek Merkezi
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Analiz #{analysisId ?? "-"} için klinik yorum, anlamlı varyantlar ve tedavi önerileri.
                    </p>
                    <Badge className={`mt-2 ${scoreTone.className}`}>{scoreTone.label}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                    Veri Kalitesi: Yüksek
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    Mutasyon Yükü: {mutationBurden}
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                    Tedavi Uyumu: {therapyBadge}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="print:hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FilePlus2Icon className="size-4" />
                  Sepetteki Genler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-6">
                <div className="flex flex-wrap gap-2">
                  {basketItems.length > 0 ? (
                    basketItems.map((item) => (
                      <Badge key={`basket-${item.geneId}`} variant="secondary" className="gap-2">
                        <button
                          type="button"
                          className="font-medium"
                          onClick={() => setSelectedGene(item.geneId)}
                        >
                          {item.geneId}
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => removeGene(item.geneId)}
                          aria-label={`${item.geneId} sepetten kaldır`}
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Henüz sepete gen eklenmedi.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={showBasketOnly ? "default" : "outline"}
                    disabled={basketItems.length === 0}
                    onClick={() => setShowBasketOnly((prev) => !prev)}
                  >
                    {showBasketOnly ? "Tüm Genleri Göster" : "Sadece Sepettekiler"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={basketItems.length === 0}
                    onClick={() => clearBasket()}
                  >
                    Sepeti Temizle
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card
              data-pdf-block
              data-pdf-title="Executive Summary"
              data-pdf-section="clinical-summary"
              data-pdf-section-title="Klinik Ozet"
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheckIcon className="size-5 text-emerald-500" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-6">
                {isLoadingExecutive ? (
                  <>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[92%]" />
                    <Skeleton className="h-4 w-[80%]" />
                  </>
                ) : (executiveSummary.length ? executiveSummary : fallbackExecutive).map((line, idx) => (
                  <div
                    key={`summary-${idx}`}
                    className="rounded-md border bg-muted/20 p-4 text-sm leading-relaxed break-words"
                  >
                    {line}
                    {line.endsWith(".") ? "" : "."}
                  </div>
                ))}
              </CardContent>
            </Card>

            <div
              className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-stretch"
              data-report-paired-grid
            >
              <Card
                className="h-full overflow-hidden print:h-auto"
                data-pdf-block
                data-pdf-title="3D Klinik Model"
                data-pdf-single-page="true"
                data-pdf-section="models"
                data-pdf-section-title="3D Modeller"
                data-pdf-order="1"
              >
                <CardHeader className="pb-2">
                  <CardTitle>3D DNA Clinical Helix</CardTitle>
                </CardHeader>
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <div
                    className="aspect-[4/3] min-h-[420px] w-full flex-1 overflow-hidden rounded-xl"
                    data-pdf-3d
                  >
                    <div data-pdf-3d-live className="h-full w-full">
                      <ClinicalMutationModel
                        hotspots={criticalMutations}
                        selectedGene={selectedGene}
                        onSelectGene={setSelectedGene}
                      />
                    </div>
                    <div
                      data-pdf-fallback
                      className="hidden h-full w-full rounded-xl border border-slate-300 bg-white p-4 text-slate-800"
                    >
                      <h4 className="text-sm font-semibold">DNA Mutation Snapshot</h4>
                      <img
                        data-pdf-snapshot-img
                        data-pdf-capture-source="static"
                        alt="3D DNA Snapshot"
                        className="mt-3 h-52 w-full max-w-[500px] rounded-md border border-slate-300 bg-slate-100 object-contain mx-auto"
                        src={dnaPdfSnapshotUrl}
                      />
                      <p className="mt-2 text-center text-[11px] text-slate-500">
                        Figure 1. Kritik mutasyon odaklarını gösteren DNA snapshot.
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Kritik mutasyon noktaları (ilk 6):{" "}
                        {criticalMutations.slice(0, 6).map((item) => item.gene).join(", ") || "Yok"}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        {criticalMutations.slice(0, 6).map((item) => (
                          <div
                            key={`pdf-hotspot-${item.gene}`}
                            className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs"
                          >
                            <p className="font-semibold text-slate-800">{item.gene}</p>
                            <p className="text-slate-600">Yoğunluk: {item.intensity.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sağdaki Significant Variants tablosunda bir gene tıkladığınızda bu model üzerinde ilgili nokta parlayarak vurgulanır.
                  </p>
                  {selectedVariant ? (
                    <div className="rounded-md border bg-muted/20 p-2 text-xs">
                      Seçili gen: <span className="font-semibold">{selectedVariant.genId}</span> |
                      log2FC: <span className="font-medium"> {selectedVariant.log2FoldChange.toFixed(2)}</span> |
                      p: <span className="font-medium"> {formatPValue(selectedVariant.pValue)}</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

                <Card
                  className="h-full overflow-hidden"
                  data-pdf-block
                  data-pdf-title="Significant Variants"
                  data-pdf-section="variants"
                  data-pdf-section-title="Varyantlar"
                  data-pdf-order="1"
                  data-pdf-table-repeat-header="true"
                  data-pdf-table-header-px="160"
                  data-pdf-table-row-px="48"
                  data-pdf-table-avoid="true"
                  data-pdf-allow-split="true"
                  data-pdf-table-standard="true"
                >
                  <CardHeader className="pb-2">
                    <CardTitle>Significant Variants</CardTitle>
                  </CardHeader>
                  <CardContent className="flex h-full flex-col p-6">
                    <div className="min-h-0 flex-1 rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[56px]">Sepet</TableHead>
                            <TableHead>Gen</TableHead>
                            <TableHead>
                              <TermTooltip
                                label="Log2FC"
                                description="Log2FC, gen ifadesindeki değişimin log2 ölçekli büyüklüğünü gösterir. Pozitif değer artış, negatif değer azalış anlamına gelir."
                              />
                            </TableHead>
                            <TableHead>
                              <TermTooltip
                                label="P-Value"
                                description="P-Value, gözlenen farkın tesadüfen ortaya çıkma olasılığıdır. Genellikle 0.05 altı değerler anlamlı kabul edilir."
                              />
                            </TableHead>
                            <TableHead>
                              <TermTooltip
                                label="Adj. P-Value"
                                description="Adjusted P-Value, çoklu test düzeltmesi uygulanmış p-değeridir. Yanlış pozitifleri azaltmak için kullanılır."
                              />
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            Array.from({ length: 6 }).map((_, idx) => (
                              <TableRow key={`variant-load-${idx}`}>
                                <TableCell className="align-middle"><Skeleton className="h-6 w-6 rounded-full" /></TableCell>
                                <TableCell className="align-middle"><Skeleton className="h-4 w-14" /></TableCell>
                                <TableCell className="align-middle"><Skeleton className="h-4 w-20" /></TableCell>
                                <TableCell className="align-middle"><Skeleton className="h-4 w-20" /></TableCell>
                                <TableCell className="align-middle"><Skeleton className="h-4 w-20" /></TableCell>
                              </TableRow>
                            ))
                          ) : displayVariants.length ? (
                            displayVariants.slice(0, 24).map((row) => (
                              <TableRow
                                key={`${row.genId}-${row.pValue}`}
                                className={
                                  selectedGene?.toUpperCase() === row.genId.toUpperCase()
                                    ? "bg-amber-50/70 dark:bg-amber-900/10"
                                    : ""
                                }
                              >
                                <TableCell className="align-middle">
                                  <Button
                                    type="button"
                                    variant={basketGeneSet.has(row.genId.toUpperCase()) ? "default" : "ghost"}
                                    size="icon-sm"
                                    onClick={() =>
                                      toggleGene({
                                        geneId: row.genId,
                                        analysisId,
                                        source: "reports-significant-variants",
                                      })
                                    }
                                    aria-label={`${row.genId} genini sepete ekle`}
                                  >
                                    <FilePlus2Icon className="size-3.5" />
                                  </Button>
                                </TableCell>
                                <TableCell className="align-middle">
                                  <button
                                    type="button"
                                    className="font-medium hover:underline"
                                    onClick={() => setSelectedGene(row.genId)}
                                  >
                                    {row.genId}
                                  </button>
                                </TableCell>
                                <TableCell className="align-middle">{row.log2FoldChange.toFixed(2)}</TableCell>
                                <TableCell className="align-middle">{formatPValue(row.pValue)}</TableCell>
                                <TableCell className="align-middle">{formatPValue(row.adjustedPValue)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="h-20 align-middle text-center text-muted-foreground">
                                Anlamlı varyant bulunamadı.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
            </div>

            <div className="space-y-8">
                <Card
                  className="overflow-hidden"
                  data-pdf-block
                  data-pdf-title="Protein 3D Structure"
                  data-pdf-section="models"
                  data-pdf-section-title="3D Modeller"
                  data-pdf-order="2"
                >
                  <CardHeader className="pb-2">
                    <CardTitle>Protein 3D Structure</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div data-pdf-3d>
                      <div data-pdf-3d-live>
                        <ProteinStructureCard
                          gene={selectedGene}
                          mutationHints={selectedGeneMutationHints}
                        />
                      </div>
                      <div
                        data-pdf-fallback
                        className="hidden rounded-xl border border-slate-300 bg-white p-4 text-slate-800"
                      >
                        <h4 className="text-sm font-semibold">Protein Structure Snapshot</h4>
                        <img
                          data-pdf-snapshot-img
                          data-pdf-capture-source="canvas"
                          alt="Protein Structure Snapshot"
                          className="mt-3 h-52 w-full max-w-[500px] rounded-md border border-slate-300 bg-slate-100 object-contain mx-auto"
                        />
                        <p className="mt-2 text-center text-[11px] text-slate-500">
                          Figure 2. Seçili gene ait protein yapı snapshot görünümü.
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Seçili gen: {selectedGene ?? "Belirlenmedi"}
                        </p>
                        <div className="mt-3 rounded-md border border-slate-300 bg-slate-50 p-3 text-xs">
                          <p className="font-medium text-slate-700">Mutasyon İpuçları</p>
                          <p className="mt-1 text-slate-600">
                            {selectedGeneMutationHints.slice(0, 8).join(", ") || "Mutasyon verisi bulunamadı."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="overflow-hidden"
                  data-pdf-block
                  data-pdf-title="Kaplan-Meier Survival Analysis"
                  data-pdf-section="survival"
                  data-pdf-section-title="Sagkalim Analizi"
                  data-pdf-order="1"
                >
                  <CardHeader className="pb-2">
                    <CardTitle>Kaplan-Meier Survival Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {isLoadingSurvival ? (
                      <Skeleton className="h-[460px] w-full rounded-xl" />
                    ) : survivalPayload ? (
                      <KaplanMeierSurvivalChart payload={survivalPayload} />
                    ) : (
                      <div className="grid h-[200px] place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
                        Sağkalım analizi verisi alınamadı.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className="overflow-hidden"
                  data-pdf-block
                  data-pdf-title="Treatment Suggestions"
                  data-pdf-section="variants"
                  data-pdf-section-title="Varyantlar"
                  data-pdf-order="2"
                  data-pdf-table-standard="true"
                >
                  <CardHeader className="pb-2">
                    <CardTitle>Treatment Suggestions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[56px]">Sepet</TableHead>
                            <TableHead>İlgili Gen</TableHead>
                            <TableHead>Mutasyon</TableHead>
                            <TableHead>Önerilen İlaç/Terapi</TableHead>
                            <TableHead>Klinik Kanıt Düzeyi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoadingDrugs ? (
                            Array.from({ length: 6 }).map((_, idx) => (
                              <TableRow key={`drug-load-${idx}`}>
                                <TableCell className="align-middle"><Skeleton className="h-6 w-6 rounded-full" /></TableCell>
                                <TableCell className="align-middle"><Skeleton className="h-4 w-16" /></TableCell>
                                <TableCell className="align-middle"><Skeleton className="h-4 w-48" /></TableCell>
                                <TableCell className="align-middle"><Skeleton className="h-4 w-36" /></TableCell>
                                <TableCell className="align-middle"><Skeleton className="h-4 w-20" /></TableCell>
                              </TableRow>
                            ))
                          ) : selectedDrugRows.length ? (
                            selectedDrugRows.slice(0, 24).map((row, idx) => (
                              <TableRow
                                key={`${row.gene}-${idx}`}
                                className={
                                  selectedGene?.toUpperCase() === row.gene.toUpperCase()
                                    ? "bg-amber-50/70 dark:bg-amber-900/10"
                                    : ""
                                }
                              >
                                <TableCell className="align-middle">
                                  <Button
                                    type="button"
                                    variant={basketGeneSet.has(row.gene.toUpperCase()) ? "default" : "ghost"}
                                    size="icon-sm"
                                    onClick={() =>
                                      toggleGene({
                                        geneId: row.gene,
                                        analysisId,
                                        source: "reports-treatment-suggestions",
                                      })
                                    }
                                    aria-label={`${row.gene} genini sepete ekle`}
                                  >
                                    <FilePlus2Icon className="size-3.5" />
                                  </Button>
                                </TableCell>
                                <TableCell className="align-middle">
                                  <button
                                    type="button"
                                    className="font-medium hover:underline"
                                    onClick={() => setSelectedGene(row.gene)}
                                  >
                                    {row.gene}
                                  </button>
                                </TableCell>
                                <TableCell className="align-middle max-w-[260px] whitespace-normal leading-5">
                                  {row.mutation}
                                </TableCell>
                                <TableCell className="align-middle">
                                  <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span>{row.drug}</span>
                                    {row.referenceUrl ? (
                                      <a
                                        href={row.referenceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-muted-foreground hover:text-foreground"
                                      >
                                        <ExternalLinkIcon className="size-3.5" />
                                      </a>
                                    ) : null}
                                  </div>
                                  <p className="max-w-[260px] text-xs leading-5 text-muted-foreground">
                                    {row.recommendedTherapy}
                                  </p>
                                </TableCell>
                                <TableCell className="align-middle">
                                  <Badge className={toEvidenceClass(row.evidenceLevel)}>{row.evidenceLevel}</Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="h-20 align-middle text-center text-muted-foreground">
                                Bilinen bir tedavi eşleşmesi bulunamadı.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  data-pdf-block
                  data-pdf-title="Volcano Plot"
                  data-pdf-section="survival"
                  data-pdf-section-title="Sagkalim Analizi"
                  data-pdf-order="2"
                >
                  <CardHeader className="pb-2">
                    <CardTitle>Volcano Plot</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ReportVolcanoPlot
                      rows={displayVariants}
                      selectedGene={selectedGene}
                      onSelectGene={setSelectedGene}
                    />
                    <div className="no-print">
                      <PlotCodeExport
                        spec={{
                          title: "Volcano Plot",
                          xLabel: "Log2 Fold Change",
                          yLabel: "-log10(P-Value)",
                          datasets: [
                            {
                              name: "Genes",
                              x: displayVariants.map((row) => row.log2FoldChange),
                              y: displayVariants.map((row) => -Math.log10(Math.max(row.pValue, 1e-12))),
                              mode: "markers",
                              type: "scatter",
                            },
                          ],
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card
                  data-pdf-block
                  data-pdf-title="Pathway Simulation"
                  data-pdf-section="models"
                  data-pdf-section-title="3D Modeller"
                  data-pdf-order="3"
                >
                  <CardHeader className="pb-2">
                    <CardTitle>Pathway Simulation</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <PathwaySimulationCard nodes={PATHWAY_NODES} impactedGenes={pathwayImpactedGenes} />
                  </CardContent>
                </Card>

                <Card
                  data-pdf-block
                  data-pdf-title="Technical Details"
                  data-pdf-section="methods"
                  data-pdf-section-title="Metotlar"
                  data-pdf-order="1"
                  data-pdf-table-standard="true"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <span>Technical Details</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="no-print"
                        onClick={() => setOpenTechnical((prev) => !prev)}
                      >
                        {openTechnical ? "Gizle" : "Göster"}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  {openTechnical ? (
                    <CardContent className="space-y-2 p-6 text-sm">
                      <p>
                        <span className="font-medium">Toplam Gen:</span>{" "}
                        <span className="text-muted-foreground">{data.length.toLocaleString("tr-TR")}</span>
                      </p>
                      <p>
                        <span className="font-medium">Anlamlı Varyant:</span>{" "}
                        <span className="text-muted-foreground">
                          {significantVariants.length.toLocaleString("tr-TR")}
                        </span>
                      </p>
                      <p>
                        <span className="font-medium">Görünen Varyant:</span>{" "}
                        <span className="text-muted-foreground">
                          {displayVariants.length.toLocaleString("tr-TR")}
                        </span>
                      </p>
                      <p>
                        <span className="font-medium">Tedavi Eşleşmesi:</span>{" "}
                        <span className="text-muted-foreground">{drugRows.length}</span>
                      </p>
                    </CardContent>
                  ) : null}
                </Card>

                <Card
                  data-pdf-block
                  data-pdf-title="Methods"
                  data-pdf-section="methods"
                  data-pdf-section-title="Metotlar"
                  data-pdf-order="2"
                  data-pdf-table-repeat-header="true"
                  data-pdf-table-header-px="178"
                  data-pdf-table-row-px="38"
                  data-pdf-table-avoid="true"
                  data-pdf-allow-split="true"
                  data-pdf-table-standard="true"
                >
                  <CardHeader className="pb-2">
                    <CardTitle>Methods</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 p-6">
                    {isLoadingMethods ? (
                      <div className="space-y-3">
                        <Skeleton className="h-5 w-52" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3" data-methods-grid>
                          <h3 className="text-base font-semibold">Analysis Parameters</h3>
                          <div className="rounded-lg border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Parameter</TableHead>
                                  <TableHead>Value</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {reportParameters.map((row) => (
                                  <TableRow key={`method-parameter-${row.key}`}>
                                    <TableCell className="align-middle font-medium">{row.key}</TableCell>
                                    <TableCell className="align-middle text-muted-foreground">
                                      {row.value}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {reportParameters.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={2} className="h-16 text-center text-muted-foreground">
                                      Teknik özet verisi bulunamadı.
                                    </TableCell>
                                  </TableRow>
                                ) : null}
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-base font-semibold">Library Versions</h3>
                          <div className="rounded-lg border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Library</TableHead>
                                  <TableHead>Version</TableHead>
                                  <TableHead>Purpose</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {pythonLibraries.length > 0 ? (
                                  pythonLibraries.map((library) => (
                                    <TableRow key={`method-lib-${library.name}`}>
                                      <TableCell className="align-middle font-medium">
                                        {library.name}
                                      </TableCell>
                                      <TableCell className="align-middle text-muted-foreground">
                                        {library.version}
                                      </TableCell>
                                      <TableCell className="align-middle text-muted-foreground">
                                        {LIBRARY_PURPOSES[library.name.replaceAll("-", "_").toLowerCase()] ?? "Core Utility"}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">
                                      Kütüphane sürüm bilgisi bulunamadı.
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-base font-semibold">Methodology Notes</h3>
                          <div className="rounded-lg border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Method</TableHead>
                                  <TableHead>Details</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {methodologyRows.map((row) => (
                                  <TableRow key={`methodology-${row.key}`}>
                                    <TableCell className="align-middle font-medium">{row.key}</TableCell>
                                    <TableCell className="align-middle text-muted-foreground">
                                      {row.value}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
            </div>

            <div className="print:hidden flex flex-wrap justify-end gap-2" data-print-hide>
              <Button variant="outline" nativeButton={false} render={<Link href="/reports" />}>
                Rapor Listesine Dön
              </Button>
              <Button variant="outline" onClick={() => void handleExcelExport()} disabled={isExcelExporting}>
                {isExcelExporting ? "Excel hazırlanıyor..." : "Excel Olarak İndir"}
              </Button>
              <Button variant="outline" onClick={() => void handleScientificPdfExport()} disabled={isPdfExporting}>
                {isPdfExporting ? "PDF hazırlanıyor..." : "Klinik PDF İndir"}
              </Button>
              <Button onClick={() => void handlePrintReport()} disabled={isPdfExporting}>
                <FileTextIcon className="mr-2 size-4" />
                {isPdfExporting ? "Yazdır hazırlanıyor..." : "A4 Olarak Yazdır"}
              </Button>
            </div>
              </TabsContent>

              <TabsContent value="functional" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Functional Enrichment Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Aşağıdaki grafikler yalnızca `adjusted p-value &lt; 0.05` olan terimleri gösterir.
                      Enrichment skoru `-log10(p-adj)` olarak hesaplanır.
                    </p>
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-3">
                  <FunctionalEnrichmentChart
                    title="Biological Process"
                    rows={enrichmentByCategory["Biological Process"]}
                  />
                  <FunctionalEnrichmentChart
                    title="Molecular Function"
                    rows={enrichmentByCategory["Molecular Function"]}
                  />
                  <FunctionalEnrichmentChart
                    title="Cellular Component"
                    rows={enrichmentByCategory["Cellular Component"]}
                  />
                </div>

                <InteractionNetworkGraph
                  nodes={interactionNetwork.nodes}
                  links={interactionNetwork.links}
                />
              </TabsContent>

              <TabsContent value="notebook">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Analysis Parameters</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Parametre</TableHead>
                            <TableHead>Değer</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportParameters.map((row) => (
                            <TableRow key={row.key}>
                              <TableCell className="font-medium">{row.key}</TableCell>
                              <TableCell className="text-muted-foreground">{row.value}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <BookTextIcon className="size-5" />
                      Integrated Lab Notebook
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <textarea
                      value={notebookMarkdown}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setNotebookMarkdown(nextValue);
                        if (typeof window !== "undefined" && notebookDraftStorageKey) {
                          window.localStorage.setItem(notebookDraftStorageKey, nextValue);
                        }
                        scheduleNotebookSave(nextValue);
                      }}
                      placeholder="Analiz notlarını Markdown formatında yazın..."
                      className="min-h-[300px] w-full rounded-md border bg-background p-3 font-mono text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {isNotebookLoading ? "Notebook yükleniyor..." : "Notlar otomatik kaydedilir."}
                      </p>
                      <Button
                        type="button"
                        onClick={() => void saveNotebook(notebookMarkdown)}
                        disabled={isNotebookSaving}
                      >
                        {isNotebookSaving ? "Kaydediliyor..." : "Notları Kaydet"}
                      </Button>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="mb-3 text-sm font-medium">Markdown Önizleme</p>
                      <div className="max-h-[380px] overflow-auto prose prose-sm dark:prose-invert">
                        {notebookMarkdown.trim().length > 0 ? (
                          <ReactMarkdown>{notebookMarkdown}</ReactMarkdown>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Henüz not eklenmedi.
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
      </section>
    </main>
  );
}
