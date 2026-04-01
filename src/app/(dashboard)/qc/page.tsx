"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ActivityIcon,
  AlertTriangleIcon,
  BarChart3Icon,
  DnaIcon,
  FlaskConicalIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useTheme } from "@/components/theme-provider";
import { useActiveAnalysis } from "@/hooks/useActiveAnalysis";
import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { qcResponseSchema, type QcResponse } from "@/lib/schemas/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TermTooltip } from "@/components/ui/term-tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlotCodeExport } from "@/components/plots/plot-code-export";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full" />,
});

const DnaHelix3D = dynamic(() => import("@/components/Bio/DnaHelix3D"), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full" />,
});

type ApiFileItem = {
  id: number;
  name: string;
  type: string;
  status: string;
  createdAt: string;
};

type CircularProgressProps = {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  trackColor?: string;
  suffix?: string;
};

type TrafficLevel = "good" | "warn" | "bad";

type TrafficMetric = {
  key: string;
  label: string;
  valueLabel: string;
  progress: number;
  level: TrafficLevel;
};

const QC_SUPPORTED_EXTENSIONS = [
  ".fastq",
  ".fq",
  ".fasta",
  ".fa",
  ".fna",
  ".fastq.gz",
  ".fq.gz",
  ".fasta.gz",
  ".fa.gz",
  ".fna.gz",
];

const SURFACE_CARD = "border-border/70 bg-card/95 shadow-sm";
const HEADER_CARD = "rounded-lg border border-border/70 bg-card/70 p-4";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function CircularProgress({
  value,
  size = 88,
  stroke = 9,
  color,
  trackColor = "rgba(113,113,122,0.22)",
  suffix = "%",
}: CircularProgressProps) {
  const safeValue = clamp(value, 0, 100);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safeValue / 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          stroke={trackColor}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          stroke={color}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 260ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold tracking-tight">
        {Math.round(safeValue)}
        {suffix}
      </div>
    </div>
  );
}

function isQcSupportedFile(file: ApiFileItem) {
  const fileName = file.name.toLowerCase();
  const fileType = (file.type || "").toLowerCase();
  return QC_SUPPORTED_EXTENSIONS.some(
    (extension) => fileName.endsWith(extension) || fileType === extension
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function signalLevelForGc(gcRatio: number): TrafficLevel {
  if (gcRatio >= 0.4 && gcRatio <= 0.6) {
    return "good";
  }
  if (gcRatio >= 0.3 && gcRatio <= 0.7) {
    return "warn";
  }
  return "bad";
}

function signalLevelForDuplication(rate: number): TrafficLevel {
  if (rate <= 0.2) {
    return "good";
  }
  if (rate <= 0.4) {
    return "warn";
  }
  return "bad";
}

function signalLevelForNRate(rate: number): TrafficLevel {
  if (rate <= 0.005) {
    return "good";
  }
  if (rate <= 0.02) {
    return "warn";
  }
  return "bad";
}

function signalPalette(level: TrafficLevel) {
  if (level === "good") {
    return {
      color: "#16a34a",
      soft: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      label: "Stabil",
    };
  }
  if (level === "warn") {
    return {
      color: "#d97706",
      soft: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      label: "İzlenmeli",
    };
  }
  return {
    color: "#dc2626",
    soft: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    label: "Riskli",
  };
}

function derivePerBaseQuality(qcPayload: QcResponse | null): number[] {
  if (!qcPayload) {
    return [];
  }

  const direct = qcPayload.qc.perBaseQuality ?? [];
  if (direct.length > 0) {
    return direct.map((item) => item.meanPhred);
  }

  const matrix = qcPayload.qc.perTileSequenceQuality?.z ?? [];
  if (matrix.length === 0) {
    return [];
  }

  const maxLength = Math.max(...matrix.map((row) => row.length));
  const derived: number[] = [];
  for (let index = 0; index < maxLength; index += 1) {
    let sum = 0;
    let count = 0;
    for (const row of matrix) {
      const value = row[index];
      if (typeof value === "number" && Number.isFinite(value)) {
        sum += value;
        count += 1;
      }
    }
    derived.push(count > 0 ? sum / count : 0);
  }

  return derived;
}

function toFriendlyQcErrorMessage(rawMessage: string) {
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("lengths of sequence and quality values differs")) {
    return "FASTQ dosyası bozuk görünüyor: dizi ve kalite satırı uzunlukları uyuşmuyor. Lütfen dosyayı doğrulayıp tekrar yükleyin.";
  }
  if (normalized.includes("doğrulanamadı")) {
    return "QC servisi beklenen formatta cevap dönmedi. Sunucu loglarını kontrol edip isteği tekrar deneyin.";
  }
  if (normalized.includes("dosya bulunamadı")) {
    return "Seçilen dosya bulunamadı. Dosyanın silinmediğini veya taşınmadığını doğrulayın.";
  }
  if (normalized.includes("api error: 401") || normalized.includes("unauthorized")) {
    return "QC verisine erişim yetkisi doğrulanamadı. Oturumu yenileyip tekrar deneyin.";
  }

  return rawMessage;
}

export default function QcPage() {
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { activeAnalysisId } = useActiveAnalysis();

  const [mode, setMode] = useState<"single" | "compare">("single");
  const [files, setFiles] = useState<ApiFileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [compareFileId, setCompareFileId] = useState<string>("");

  const [qcPayload, setQcPayload] = useState<QcResponse | null>(null);
  const [comparePayload, setComparePayload] = useState<QcResponse | null>(null);

  const [filesLoading, setFilesLoading] = useState(true);
  const [qcLoading, setQcLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);

  const [filesError, setFilesError] = useState<string | null>(null);
  const [qcError, setQcError] = useState<string | null>(null);

  const plotThemeStyle = useMemo(
    () => ({
      fontColor: isDark ? "#f4f4f5" : "#27272a",
      gridColor: isDark ? "#3f3f46" : "#e4e4e7",
      zeroLineColor: isDark ? "#52525b" : "#d4d4d8",
      heatmapScale: isDark ? "Portland" : "RdYlGn",
      adapterColors: isDark
        ? ["#34d399", "#38bdf8", "#f472b6", "#f59e0b"]
        : ["#059669", "#0284c7", "#be185d", "#d97706"],
      bubbleColor: isDark ? "#60a5fa" : "#2563eb",
      comparePrimary: isDark ? "#22c55e" : "#16a34a",
      compareSecondary: isDark ? "#38bdf8" : "#0284c7",
    }),
    [isDark]
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadFiles = async () => {
      setFilesLoading(true);
      setFilesError(null);
      try {
        const response = isAuthenticated
          ? await fetchApiWithAuth("/api/files", {
              method: "GET",
              signal: controller.signal,
              cache: "no-store",
            })
          : await fetch(`${getApiBaseUrl()}/api/files/public-qc?limit=120`, {
              method: "GET",
              signal: controller.signal,
              cache: "no-store",
            });

        const payload = (await response.json().catch(() => [])) as ApiFileItem[];

        if (!response.ok && isAuthenticated && (response.status === 401 || response.status === 403)) {
          const publicResponse = await fetch(`${getApiBaseUrl()}/api/files/public-qc?limit=120`, {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
          });
          const publicPayload = (await publicResponse.json().catch(() => [])) as ApiFileItem[];
          if (!publicResponse.ok) {
            throw new Error("Dosya listesi alınamadı.");
          }

          const filteredPublic = publicPayload.filter(isQcSupportedFile);
          setFiles(filteredPublic);
          if (filteredPublic.length > 0) {
            const first = String(filteredPublic[0].id);
            const second = filteredPublic[1] ? String(filteredPublic[1].id) : first;
            setSelectedFileId((current) => current || first);
            setCompareFileId((current) => current || second);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(
            isAuthenticated
              ? "Dosya listesi alınamadı."
              : "Kamuya açık QC dosya listesi alınamadı."
          );
        }

        const filtered = payload.filter(isQcSupportedFile);
        setFiles(filtered);

        if (filtered.length > 0) {
          const first = String(filtered[0].id);
          const second = filtered[1] ? String(filtered[1].id) : first;
          setSelectedFileId((current) => current || first);
          setCompareFileId((current) => current || second);
        }
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          loadError instanceof Error ? loadError.message : "Dosya listesi yüklenemedi.";
        setFilesError(message);
        toast.error(message);
      } finally {
        if (!controller.signal.aborted) {
          setFilesLoading(false);
        }
      }
    };

    void loadFiles();
    return () => controller.abort();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!selectedFileId) {
      setQcPayload(null);
      return;
    }

    const controller = new AbortController();
    const loadQc = async () => {
      setQcLoading(true);
      setQcError(null);
      try {
        const response = await fetchApiWithAuth(`/api/qc/${selectedFileId}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const detail =
            payload && typeof payload === "object" && "detail" in payload
              ? String(payload.detail)
              : "QC verisi alınamadı.";
          throw new Error(detail);
        }

        const parsed = qcResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("QC cevap formatı doğrulanamadı.");
        }

        setQcPayload(parsed.data);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          loadError instanceof Error ? loadError.message : "QC analizi yüklenemedi.";
        const friendlyMessage = toFriendlyQcErrorMessage(message);
        setQcError(friendlyMessage);
        setQcPayload(null);
        toast.error(friendlyMessage);
      } finally {
        if (!controller.signal.aborted) {
          setQcLoading(false);
        }
      }
    };

    void loadQc();
    return () => controller.abort();
  }, [selectedFileId]);

  useEffect(() => {
    if (!compareFileId) {
      setComparePayload(null);
      return;
    }

    if (compareFileId === selectedFileId) {
      setComparePayload(qcPayload);
      return;
    }

    const controller = new AbortController();
    const loadCompare = async () => {
      setCompareLoading(true);
      try {
        const response = await fetchApiWithAuth(`/api/qc/${compareFileId}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const detail =
            payload && typeof payload === "object" && "detail" in payload
              ? String(payload.detail)
              : "Karşılaştırmalı QC verisi alınamadı.";
          throw new Error(detail);
        }

        const parsed = qcResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("Karşılaştırmalı QC formatı doğrulanamadı.");
        }

        setComparePayload(parsed.data);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setComparePayload(null);
        const message = error instanceof Error ? error.message : "Karşılaştırmalı QC yüklenemedi.";
        toast.error(toFriendlyQcErrorMessage(message));
      } finally {
        if (!controller.signal.aborted) {
          setCompareLoading(false);
        }
      }
    };

    void loadCompare();
    return () => controller.abort();
  }, [compareFileId, selectedFileId, qcPayload]);

  useEffect(() => {
    if (!isAuthenticated || !activeAnalysisId || files.length === 0) {
      return;
    }

    let cancelled = false;
    const syncFileSelectionFromAnalysis = async () => {
      try {
        const response = await fetchApiWithAuth(`/api/job/${activeAnalysisId}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || typeof payload !== "object") {
          return;
        }

        const fileIdRaw = (payload as { file_id?: unknown }).file_id;
        const parsedFileId = Number(fileIdRaw);
        if (!Number.isInteger(parsedFileId) || parsedFileId <= 0) {
          return;
        }

        const matchedFile = files.find((file) => file.id === parsedFileId);
        if (!matchedFile || !isQcSupportedFile(matchedFile)) {
          return;
        }

        if (!cancelled) {
          setSelectedFileId(String(parsedFileId));
        }
      } catch {
        // Sessiz geç: kullanıcı manuel seçim yapabilir.
      }
    };

    void syncFileSelectionFromAnalysis();
    return () => {
      cancelled = true;
    };
  }, [activeAnalysisId, files, isAuthenticated]);

  useEffect(() => {
    if (!files.length || !selectedFileId) {
      return;
    }

    if (!compareFileId || compareFileId === selectedFileId) {
      const fallback = files.find((file) => String(file.id) !== selectedFileId);
      setCompareFileId(fallback ? String(fallback.id) : selectedFileId);
    }
  }, [files, selectedFileId, compareFileId]);

  const selectedFile = files.find((file) => String(file.id) === selectedFileId) ?? null;
  const selectedCompareFile = files.find((file) => String(file.id) === compareFileId) ?? null;

  const gcDistribution = useMemo(() => qcPayload?.qc.gcDistribution ?? [], [qcPayload]);
  const baseComposition = useMemo(() => qcPayload?.qc.baseComposition ?? [], [qcPayload]);
  const lengthDistribution = useMemo(() => qcPayload?.qc.lengthDistribution ?? [], [qcPayload]);
  const perTileQuality = useMemo(
    () => qcPayload?.qc.perTileSequenceQuality ?? { x: [], y: [], z: [] },
    [qcPayload]
  );
  const kmerProfile = useMemo(() => qcPayload?.qc.kmerProfile ?? [], [qcPayload]);
  const perBaseQuality = useMemo(() => derivePerBaseQuality(qcPayload), [qcPayload]);

  const compareGcDistribution = useMemo(
    () => comparePayload?.qc.gcDistribution ?? [],
    [comparePayload]
  );
  const comparePerBaseQuality = useMemo(
    () => derivePerBaseQuality(comparePayload),
    [comparePayload]
  );

  const qualityScore = qcPayload?.qc.summary.overallQualityScore ?? 0;

  const diagnosticMetrics = useMemo<TrafficMetric[]>(() => {
    if (!qcPayload) {
      return [];
    }

    const gcRatio = qcPayload.qc.summary.gcRatio;
    const dupRate = qcPayload.qc.summary.duplicationRate;
    const nRate = qcPayload.qc.summary.nRatio;

    return [
      {
        key: "gc",
        label: "GC Content",
        valueLabel: formatPercent(gcRatio),
        progress: gcRatio * 100,
        level: signalLevelForGc(gcRatio),
      },
      {
        key: "dup",
        label: "PCR Duplication",
        valueLabel: formatPercent(dupRate),
        progress: 100 - dupRate * 100,
        level: signalLevelForDuplication(dupRate),
      },
      {
        key: "n",
        label: "N Oranı",
        valueLabel: formatPercent(nRate),
        progress: 100 - nRate * 100,
        level: signalLevelForNRate(nRate),
      },
    ];
  }, [qcPayload]);

  const showLoadingState = filesLoading || qcLoading || !qcPayload;

  const compareReady = Boolean(comparePayload) && !compareLoading;

  return (
    <main className="flex-1 p-4 md:p-6">
      <section className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
              <div className={HEADER_CARD}>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  Veri Kalite Kontrolü
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Elite Bioinformatics Dashboard: tek örnek veya karşılaştırmalı QC analizi,
                  3D kalite sarmalı ve ileri düzey görselleştirmeler.
                </p>
                {!isAuthenticated ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Salt-okunur görünüm: Kamuya açık QC dosyaları gösteriliyor.
                  </p>
                ) : null}

                <div className="mt-4 w-full max-w-xl">
                  <Select
                    value={selectedFileId}
                    onValueChange={(value) => {
                      if (value) {
                        setSelectedFileId(value);
                      }
                    }}
                    disabled={filesLoading || files.length === 0}
                  >
                    <SelectTrigger aria-label="Tek örnek seçimi">
                      <SelectValue placeholder="Örnek seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {files.map((file) => (
                        <SelectItem key={file.id} value={String(file.id)}>
                          <span className="block max-w-[24rem] truncate" title={file.name}>
                            {file.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Card className={SURFACE_CARD}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                    <ShieldAlertIcon className="size-4" />
                    Analiz Teşhis Paneli
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3">
                  {(showLoadingState
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <div key={`diag-skeleton-${index}`} className="space-y-2">
                          <Skeleton className="mx-auto size-20 rounded-full" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      ))
                    : diagnosticMetrics.map((metric) => {
                        const palette = signalPalette(metric.level);
                        return (
                          <div key={metric.key} className="space-y-2 text-center">
                            <CircularProgress
                              value={metric.progress}
                              size={76}
                              color={palette.color}
                              suffix=""
                            />
                            <p
                              className="truncate text-xs font-medium text-foreground"
                              title={metric.label}
                            >
                              {metric.label}
                            </p>
                            <Badge className={palette.soft}>{palette.label}</Badge>
                            <p className="text-xs text-muted-foreground">{metric.valueLabel}</p>
                          </div>
                        );
                      }))}
                </CardContent>
              </Card>
            </div>

            {filesError ? (
              <div className="rounded-md border border-red-200/70 bg-red-50/70 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {filesError}
              </div>
            ) : null}

            {!filesLoading && files.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
                QC için uygun FASTA/FASTQ dosyası bulunamadı. Önce Dosya Yöneticisi sayfasından
                `.fasta`, `.fa`, `.fna`, `.fastq` veya `.fq` uzantılı dosya yükleyin.
              </div>
            ) : null}

            {qcError ? (
              <div className="rounded-md border border-red-200/70 bg-red-50/70 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangleIcon className="size-4" />
                  <span>{qcError}</span>
                </div>
              </div>
            ) : null}

            <Tabs value={mode} onValueChange={(value) => setMode(value as "single" | "compare")}> 
              <TabsList className="w-fit" variant="default">
                <TabsTrigger value="single">Tek Örnek QC</TabsTrigger>
                <TabsTrigger value="compare">Karşılaştırmalı QC</TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
                  <div className="grid gap-4 md:grid-cols-3">
                    {showLoadingState
                      ? Array.from({ length: 3 }).map((_, index) => (
                          <Card key={`summary-skeleton-${index}`} className={SURFACE_CARD}>
                            <CardHeader className="pb-2">
                              <Skeleton className="h-4 w-24" />
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <Skeleton className="h-7 w-20" />
                              <Skeleton className="h-3 w-full" />
                            </CardContent>
                          </Card>
                        ))
                      : [
                          {
                            label: "Read Count",
                            value: qcPayload.qc.summary.readCount.toLocaleString("tr-TR"),
                            detail: "Toplam okunabilir sekans",
                            icon: BarChart3Icon,
                          },
                          {
                            label: "Toplam Baz",
                            value: qcPayload.qc.summary.totalBases.toLocaleString("tr-TR"),
                            detail: `Ortalama uzunluk: ${qcPayload.qc.summary.avgReadLength.toFixed(1)} bp`,
                            icon: ActivityIcon,
                          },
                          {
                            label: "Quality Score",
                            value: String(qualityScore),
                            detail: "0-100 normalize genel kalite skoru",
                            icon: FlaskConicalIcon,
                          },
                        ].map((item) => {
                          const Icon = item.icon;
                          return (
                            <Card key={item.label} className={SURFACE_CARD}>
                              <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                  <Icon className="size-4" />
                                  {item.label}
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-2xl font-semibold tracking-tight">{item.value}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                              </CardContent>
                            </Card>
                          );
                        })}
                  </div>

                  <Card className={SURFACE_CARD}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                        <DnaIcon className="size-4" />
                        Gerçek Zamanlı 3D DNA Kalite Sarmalı
                      </CardTitle>
                      <Badge variant="secondary" className="max-w-[170px] truncate" title={selectedFile?.name}>
                        {selectedFile?.name ?? "Örnek"}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      {showLoadingState ? (
                        <Skeleton className="h-[420px] w-full" />
                      ) : (
                        <DnaHelix3D
                          qualityScore={qualityScore}
                          perBaseQuality={perBaseQuality}
                          isDark={isDark}
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className={SURFACE_CARD}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-1 text-base font-semibold tracking-tight">
                        <span>Per Tile Sequence Quality (Heatmap)</span>
                        <TermTooltip
                          label="Phred Score"
                          iconOnly
                          description="Phred skoru, baz çağrımının doğruluk olasılığını logaritmik ölçekte ifade eder. Skor yükseldikçe hata olasılığı düşer."
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {showLoadingState ? (
                        <Skeleton className="h-[360px] w-full" />
                      ) : (
                        <>
                        <Plot
                          data={[
                            {
                              x: perTileQuality.x,
                              y: perTileQuality.y,
                              z: perTileQuality.z,
                              type: "heatmap",
                              colorscale: plotThemeStyle.heatmapScale,
                              zmin: 0,
                              zmax: 42,
                              colorbar: {
                                title: { text: "Phred" },
                                tickcolor: plotThemeStyle.fontColor,
                                tickfont: { color: plotThemeStyle.fontColor },
                              },
                              hovertemplate:
                                "Tile: %{y}<br>Pozisyon: %{x:.0f}<br>Kalite: %{z:.2f}<extra></extra>",
                            },
                          ]}
                          layout={{
                            autosize: true,
                            height: 360,
                            margin: { l: 65, r: 25, t: 15, b: 50 },
                            paper_bgcolor: "transparent",
                            plot_bgcolor: "transparent",
                            font: { color: plotThemeStyle.fontColor },
                            xaxis: {
                              title: { text: "Read Position" },
                              gridcolor: plotThemeStyle.gridColor,
                            },
                            yaxis: {
                              title: { text: "Tile" },
                              gridcolor: plotThemeStyle.gridColor,
                            },
                          }}
                          config={{ responsive: true, displaylogo: false }}
                          useResizeHandler
                          style={{ width: "100%", height: "360px" }}
                        />
                        <PlotCodeExport
                          spec={{
                            title: "Per Tile Sequence Quality",
                            xLabel: "Read Position",
                            yLabel: "Tile Quality (Phred)",
                            datasets: [
                              {
                                name: "Tile Mean Quality",
                                x: perTileQuality.x,
                                y: perTileQuality.z.map((row) => {
                                  if (!row.length) {
                                    return 0;
                                  }
                                  return row.reduce((sum, value) => sum + value, 0) / row.length;
                                }),
                                mode: "lines+markers",
                                type: "scatter",
                              },
                            ],
                          }}
                        />
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card className={SURFACE_CARD}>
                    <CardHeader>
                      <CardTitle className="text-base font-semibold tracking-tight">
                        K-mer Profile (Bubble)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {showLoadingState ? (
                        <Skeleton className="h-[360px] w-full" />
                      ) : kmerProfile.length === 0 ? (
                        <div className="flex h-[360px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                          K-mer profili üretilemedi. Dosyada yeterli uzunlukta veya net baz dizisi olmayabilir.
                        </div>
                      ) : (
                        <>
                        <Plot
                          data={[
                            {
                              x: kmerProfile.map((item) => item.kmer),
                              y: kmerProfile.map((item) => item.ratio * 100),
                              mode: "text+markers",
                              type: "scatter",
                              text: kmerProfile.map((item) => `${item.count.toLocaleString("tr-TR")}`),
                              textposition: "top center",
                              marker: {
                                color: plotThemeStyle.bubbleColor,
                                size: kmerProfile.map((item) => 20 + Math.sqrt(item.count) * 2.4),
                                opacity: 0.72,
                                line: { color: isDark ? "#d4d4d8" : "#1f2937", width: 1 },
                              },
                              hovertemplate:
                                "K-mer: %{x}<br>Oran: %{y:.4f}%<br>Tekrar: %{text}<extra></extra>",
                            },
                          ]}
                          layout={{
                            autosize: true,
                            height: 360,
                            margin: { l: 55, r: 20, t: 20, b: 55 },
                            paper_bgcolor: "transparent",
                            plot_bgcolor: "transparent",
                            font: { color: plotThemeStyle.fontColor },
                            xaxis: {
                              title: { text: "5-mer" },
                              gridcolor: plotThemeStyle.gridColor,
                            },
                            yaxis: {
                              title: { text: "Oran (%)" },
                              gridcolor: plotThemeStyle.gridColor,
                            },
                          }}
                          config={{ responsive: true, displaylogo: false }}
                          useResizeHandler
                          style={{ width: "100%", height: "360px" }}
                        />
                        <PlotCodeExport
                          spec={{
                            title: "K-mer Profile",
                            xLabel: "5-mer",
                            yLabel: "Oran (%)",
                            datasets: [
                              {
                                name: "K-mer Ratio",
                                x: kmerProfile.map((item) => item.kmer),
                                y: kmerProfile.map((item) => item.ratio * 100),
                                mode: "markers",
                                type: "scatter",
                              },
                            ],
                          }}
                        />
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className={SURFACE_CARD}>
                    <CardHeader>
                      <CardTitle className="text-base font-semibold tracking-tight">GC İçeriği Dağılımı</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {showLoadingState ? (
                        <Skeleton className="h-[320px] w-full" />
                      ) : (
                        <>
                        <Plot
                          data={[
                            {
                              x: gcDistribution.map((item) => item.gcPercent),
                              y: gcDistribution.map((item) => item.frequency),
                              type: "scatter",
                              mode: "lines+markers",
                              name: "GC Frekansı",
                              line: { color: "#10b981", width: 2.4 },
                              marker: { color: "#10b981", size: 5 },
                              hovertemplate: "GC: %{x:.1f}%<br>Frekans: %{y}<extra></extra>",
                            },
                          ]}
                          layout={{
                            autosize: true,
                            height: 320,
                            margin: { l: 50, r: 20, t: 20, b: 50 },
                            paper_bgcolor: "transparent",
                            plot_bgcolor: "transparent",
                            font: { color: plotThemeStyle.fontColor },
                            xaxis: {
                              title: { text: "GC (%)" },
                              gridcolor: plotThemeStyle.gridColor,
                              zerolinecolor: plotThemeStyle.zeroLineColor,
                            },
                            yaxis: {
                              title: { text: "Frekans" },
                              gridcolor: plotThemeStyle.gridColor,
                            },
                          }}
                          config={{ responsive: true, displaylogo: false }}
                          useResizeHandler
                          style={{ width: "100%", height: "320px" }}
                        />
                        <PlotCodeExport
                          spec={{
                            title: "GC Content Distribution",
                            xLabel: "GC (%)",
                            yLabel: "Frekans",
                            datasets: [
                              {
                                name: "GC Frekansı",
                                x: gcDistribution.map((item) => item.gcPercent),
                                y: gcDistribution.map((item) => item.frequency),
                                mode: "lines+markers",
                                type: "scatter",
                              },
                            ],
                          }}
                        />
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card className={SURFACE_CARD}>
                    <CardHeader>
                      <CardTitle className="text-base font-semibold tracking-tight">Baz Kompozisyonu</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {showLoadingState ? (
                        <Skeleton className="h-[320px] w-full" />
                      ) : (
                        <>
                        <Plot
                          data={[
                            {
                              x: baseComposition.map((item) => item.base),
                              y: baseComposition.map((item) => item.ratio * 100),
                              type: "bar",
                              marker: {
                                color: ["#2563eb", "#14b8a6", "#22c55e", "#f59e0b", "#a855f7"],
                              },
                              hovertemplate: "Baz: %{x}<br>Oran: %{y:.2f}%<extra></extra>",
                            },
                          ]}
                          layout={{
                            autosize: true,
                            height: 320,
                            margin: { l: 50, r: 20, t: 20, b: 50 },
                            paper_bgcolor: "transparent",
                            plot_bgcolor: "transparent",
                            font: { color: plotThemeStyle.fontColor },
                            xaxis: {
                              title: { text: "Baz" },
                              gridcolor: plotThemeStyle.gridColor,
                            },
                            yaxis: {
                              title: { text: "Oran (%)" },
                              gridcolor: plotThemeStyle.gridColor,
                            },
                          }}
                          config={{ responsive: true, displaylogo: false }}
                          useResizeHandler
                          style={{ width: "100%", height: "320px" }}
                        />
                        <PlotCodeExport
                          spec={{
                            title: "Base Composition",
                            xLabel: "Baz",
                            yLabel: "Oran (%)",
                            datasets: [
                              {
                                name: "Base Ratio",
                                x: baseComposition.map((item) => item.base),
                                y: baseComposition.map((item) => item.ratio * 100),
                                type: "bar",
                              },
                            ],
                          }}
                        />
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className={SURFACE_CARD}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-semibold tracking-tight">Okuma Uzunluğu Dağılımı</CardTitle>
                    {qcPayload ? (
                      <Badge variant="secondary" className="gap-1">
                        <DnaIcon className="size-3.5" />
                        {qcPayload.qc.format.toUpperCase()}
                      </Badge>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    {showLoadingState ? (
                      <Skeleton className="h-[360px] w-full" />
                    ) : (
                      <>
                      <Plot
                        data={[
                          {
                            x: lengthDistribution.map((item) => item.length),
                            y: lengthDistribution.map((item) => item.frequency),
                            type: "bar",
                            marker: { color: "#3b82f6" },
                            hovertemplate: "Read Length: %{x} bp<br>Frekans: %{y}<extra></extra>",
                          },
                        ]}
                        layout={{
                          autosize: true,
                          height: 360,
                          margin: { l: 55, r: 20, t: 20, b: 55 },
                          paper_bgcolor: "transparent",
                          plot_bgcolor: "transparent",
                          font: { color: plotThemeStyle.fontColor },
                          xaxis: {
                            title: { text: "Read Length (bp)" },
                            gridcolor: plotThemeStyle.gridColor,
                          },
                          yaxis: {
                            title: { text: "Frekans" },
                            gridcolor: plotThemeStyle.gridColor,
                          },
                        }}
                        config={{ responsive: true, displaylogo: false }}
                        useResizeHandler
                        style={{ width: "100%", height: "360px" }}
                      />
                      <PlotCodeExport
                        spec={{
                          title: "Read Length Distribution",
                          xLabel: "Read Length (bp)",
                          yLabel: "Frekans",
                          datasets: [
                            {
                              name: "Read Length",
                              x: lengthDistribution.map((item) => item.length),
                              y: lengthDistribution.map((item) => item.frequency),
                              type: "bar",
                            },
                          ],
                        }}
                      />
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="compare" className="space-y-6">
                <Card className={SURFACE_CARD}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold tracking-tight">
                      Karşılaştırmalı Örnek Seçimi
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Örnek A</p>
                      <Select
                        value={selectedFileId}
                        onValueChange={(value) => {
                          if (value) {
                            setSelectedFileId(value);
                          }
                        }}
                      >
                        <SelectTrigger aria-label="Karşılaştırma örnek A">
                          <SelectValue placeholder="Örnek A seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {files.map((file) => (
                            <SelectItem key={`cmp-a-${file.id}`} value={String(file.id)}>
                              <span className="block max-w-[24rem] truncate" title={file.name}>
                                {file.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Örnek B</p>
                      <Select
                        value={compareFileId}
                        onValueChange={(value) => {
                          if (value) {
                            setCompareFileId(value);
                          }
                        }}
                      >
                        <SelectTrigger aria-label="Karşılaştırma örnek B">
                          <SelectValue placeholder="Örnek B seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {files.map((file) => (
                            <SelectItem key={`cmp-b-${file.id}`} value={String(file.id)}>
                              <span className="block max-w-[24rem] truncate" title={file.name}>
                                {file.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card className={SURFACE_CARD}>
                    <CardHeader className="pb-2">
                      <CardTitle className="truncate text-sm font-semibold" title={selectedFile?.name}>
                        Örnek A: {selectedFile?.name ?? "-"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">GC</p>
                        <p className="font-semibold">{formatPercent(qcPayload?.qc.summary.gcRatio ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Duplication</p>
                        <p className="font-semibold">{formatPercent(qcPayload?.qc.summary.duplicationRate ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Read Count</p>
                        <p className="font-semibold">{(qcPayload?.qc.summary.readCount ?? 0).toLocaleString("tr-TR")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">N Oranı</p>
                        <p className="font-semibold">{formatPercent(qcPayload?.qc.summary.nRatio ?? 0)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={SURFACE_CARD}>
                    <CardHeader className="pb-2">
                      <CardTitle className="truncate text-sm font-semibold" title={selectedCompareFile?.name}>
                        Örnek B: {selectedCompareFile?.name ?? "-"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">GC</p>
                        <p className="font-semibold">{formatPercent(comparePayload?.qc.summary.gcRatio ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Duplication</p>
                        <p className="font-semibold">{formatPercent(comparePayload?.qc.summary.duplicationRate ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Read Count</p>
                        <p className="font-semibold">{(comparePayload?.qc.summary.readCount ?? 0).toLocaleString("tr-TR")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">N Oranı</p>
                        <p className="font-semibold">{formatPercent(comparePayload?.qc.summary.nRatio ?? 0)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className={SURFACE_CARD}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-1 text-base font-semibold tracking-tight">
                        <span>Per Base Quality Karşılaştırması</span>
                        <TermTooltip
                          label="Mean Phred"
                          iconOnly
                          description="Mean Phred, her pozisyondaki bazların ortalama kalite skorudur. Düşen çizgiler veri güvenilirliğinin azaldığını gösterir."
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {showLoadingState || !compareReady ? (
                        <Skeleton className="h-[340px] w-full" />
                      ) : (
                        <>
                        <Plot
                          data={[
                            {
                              x: perBaseQuality.map((_, index) => index + 1),
                              y: perBaseQuality,
                              type: "scatter",
                              mode: "lines",
                              name: "Örnek A",
                              line: { color: plotThemeStyle.comparePrimary, width: 2.2 },
                            },
                            {
                              x: comparePerBaseQuality.map((_, index) => index + 1),
                              y: comparePerBaseQuality,
                              type: "scatter",
                              mode: "lines",
                              name: "Örnek B",
                              line: { color: plotThemeStyle.compareSecondary, width: 2.2 },
                            },
                          ]}
                          layout={{
                            autosize: true,
                            height: 340,
                            margin: { l: 55, r: 20, t: 15, b: 50 },
                            paper_bgcolor: "transparent",
                            plot_bgcolor: "transparent",
                            font: { color: plotThemeStyle.fontColor },
                            xaxis: {
                              title: { text: "Pozisyon" },
                              gridcolor: plotThemeStyle.gridColor,
                            },
                            yaxis: {
                              title: { text: "Mean Phred" },
                              gridcolor: plotThemeStyle.gridColor,
                            },
                            legend: { orientation: "h", y: 1.14, x: 0 },
                          }}
                          config={{ responsive: true, displaylogo: false }}
                          useResizeHandler
                          style={{ width: "100%", height: "340px" }}
                        />
                        <PlotCodeExport
                          spec={{
                            title: "Per Base Quality Comparison",
                            xLabel: "Pozisyon",
                            yLabel: "Mean Phred",
                            datasets: [
                              {
                                name: "Örnek A",
                                x: perBaseQuality.map((_, index) => index + 1),
                                y: perBaseQuality,
                                mode: "lines",
                                type: "scatter",
                              },
                              {
                                name: "Örnek B",
                                x: comparePerBaseQuality.map((_, index) => index + 1),
                                y: comparePerBaseQuality,
                                mode: "lines",
                                type: "scatter",
                              },
                            ],
                          }}
                        />
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card className={SURFACE_CARD}>
                    <CardHeader>
                      <CardTitle className="text-base font-semibold tracking-tight">
                        GC Distribution Karşılaştırması
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {showLoadingState || !compareReady ? (
                        <Skeleton className="h-[340px] w-full" />
                      ) : (
                        <>
                        <Plot
                          data={[
                            {
                              x: gcDistribution.map((item) => item.gcPercent),
                              y: gcDistribution.map((item) => item.frequency),
                              type: "scatter",
                              mode: "lines+markers",
                              name: "Örnek A",
                              line: { color: plotThemeStyle.comparePrimary, width: 2.2 },
                              marker: { size: 5 },
                            },
                            {
                              x: compareGcDistribution.map((item) => item.gcPercent),
                              y: compareGcDistribution.map((item) => item.frequency),
                              type: "scatter",
                              mode: "lines+markers",
                              name: "Örnek B",
                              line: { color: plotThemeStyle.compareSecondary, width: 2.2 },
                              marker: { size: 5 },
                            },
                          ]}
                          layout={{
                            autosize: true,
                            height: 340,
                            margin: { l: 55, r: 20, t: 15, b: 50 },
                            paper_bgcolor: "transparent",
                            plot_bgcolor: "transparent",
                            font: { color: plotThemeStyle.fontColor },
                            xaxis: {
                              title: { text: "GC (%)" },
                              gridcolor: plotThemeStyle.gridColor,
                            },
                            yaxis: {
                              title: { text: "Frekans" },
                              gridcolor: plotThemeStyle.gridColor,
                            },
                            legend: { orientation: "h", y: 1.14, x: 0 },
                          }}
                          config={{ responsive: true, displaylogo: false }}
                          useResizeHandler
                          style={{ width: "100%", height: "340px" }}
                        />
                        <PlotCodeExport
                          spec={{
                            title: "GC Distribution Comparison",
                            xLabel: "GC (%)",
                            yLabel: "Frekans",
                            datasets: [
                              {
                                name: "Örnek A",
                                x: gcDistribution.map((item) => item.gcPercent),
                                y: gcDistribution.map((item) => item.frequency),
                                mode: "lines+markers",
                                type: "scatter",
                              },
                              {
                                name: "Örnek B",
                                x: compareGcDistribution.map((item) => item.gcPercent),
                                y: compareGcDistribution.map((item) => item.frequency),
                                mode: "lines+markers",
                                type: "scatter",
                              },
                            ],
                          }}
                        />
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
      </section>
    </main>
  );
}
