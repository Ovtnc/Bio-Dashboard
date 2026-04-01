"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleIcon,
  LoaderCircleIcon,
  PlayIcon,
  RotateCcwIcon,
  ServerIcon,
  SquareIcon,
} from "lucide-react";
import { toast } from "sonner";

import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import { useAnalysisRealtime } from "@/hooks/useAnalysisRealtime";
import {
  workerStatusResponseSchema,
  type WorkerStatusResponse,
} from "@/lib/schemas/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const dynamic = "force-dynamic";

type StepVisualStatus = "completed" | "running" | "pending" | "failed";

type PipelineStep = {
  key: string;
  title: string;
};

type FileOption = {
  id: number;
  name: string;
  type: string;
};

const PIPELINE_STEPS: PipelineStep[] = [
  {
    key: "QC",
    title: "Quality Control",
  },
  {
    key: "Alignment",
    title: "Sequence Alignment",
  },
  {
    key: "Quantification",
    title: "Quantification",
  },
  {
    key: "Differential",
    title: "Differential Expression",
  },
  {
    key: "Completed",
    title: "Report Generation",
  },
];

const STEP_RESOURCE_BASELINES: Record<
  string,
  { etaMinutes: number; cpuRange: [number, number]; ramRange: [number, number] }
> = {
  QC: { etaMinutes: 12, cpuRange: [24, 56], ramRange: [3.2, 5.8] },
  Alignment: { etaMinutes: 24, cpuRange: [62, 92], ramRange: [8.8, 14.2] },
  Quantification: { etaMinutes: 15, cpuRange: [38, 66], ramRange: [5.4, 9.8] },
  Differential: { etaMinutes: 11, cpuRange: [32, 58], ramRange: [4.8, 7.4] },
  Completed: { etaMinutes: 4, cpuRange: [8, 18], ramRange: [2.4, 4.2] },
};

function buildRuntimeSnapshot(
  stepKey: string,
  status: StepVisualStatus,
  stepProgress: number
) {
  const baseline = STEP_RESOURCE_BASELINES[stepKey] ?? STEP_RESOURCE_BASELINES.Completed;
  const progressRatio = Math.max(0, Math.min(1, stepProgress / 100));
  const currentCpu = Math.round(
    baseline.cpuRange[0] + (baseline.cpuRange[1] - baseline.cpuRange[0]) * progressRatio
  );
  const currentRam =
    baseline.ramRange[0] + (baseline.ramRange[1] - baseline.ramRange[0]) * progressRatio;
  const remainingEtaMinutes = Math.max(1, Math.round((1 - progressRatio) * baseline.etaMinutes));

  if (status === "completed") {
    return { eta: "Tamamlandı", cpu: "-", ram: "-" };
  }
  if (status === "failed") {
    return { eta: "Durduruldu", cpu: "%0", ram: "0.0 GB" };
  }
  if (status === "pending") {
    return {
      eta: `Tahmini ${baseline.etaMinutes} dk`,
      cpu: "-",
      ram: "-",
    };
  }

  return {
    eta: `~${remainingEtaMinutes} dk`,
    cpu: `%${currentCpu}`,
    ram: `${currentRam.toFixed(1)} GB`,
  };
}

function stageDescription(stage: string, status: "idle" | "started" | "processing" | "completed" | "failed") {
  if (status === "failed") {
    return "Analiz sırasında hata oluştu.";
  }

  if (status === "completed") {
    return "Analiz başarıyla tamamlandı.";
  }

  const stageMap: Record<string, string> = {
    Queued: "Analiz kuyruğa alındı...",
    QC: "Kalite kontrol yapılıyor...",
    Alignment: "Hizalama yapılıyor...",
    Quantification: "Kantifikasyon yapılıyor...",
    Differential: "Diferansiyel analiz yapılıyor...",
    Completed: "Rapor oluşturuluyor...",
  };

  return stageMap[stage] ?? "Analiz hazırlanıyor...";
}

function statusBadge(status: "idle" | "started" | "processing" | "completed" | "failed", stage: string) {
  if (status === "completed") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300">
        Tamamlandı
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/20 dark:text-red-300">
        Hata
      </Badge>
    );
  }

  if (status === "started" || status === "processing") {
    return (
      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-300">
        {stage}
      </Badge>
    );
  }

  return (
    <Badge className="bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/20 dark:text-zinc-300">
      Beklemede
    </Badge>
  );
}

function stepIcon(status: StepVisualStatus) {
  if (status === "completed") {
    return <CheckCircle2Icon className="size-5 text-emerald-600" />;
  }

  if (status === "running") {
    return <LoaderCircleIcon className="size-5 animate-spin text-blue-600" />;
  }

  if (status === "failed") {
    return <AlertTriangleIcon className="size-5 text-red-600" />;
  }

  return <CircleIcon className="size-5 text-zinc-400" />;
}

function stepBadge(status: StepVisualStatus) {
  if (status === "completed") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300">
        Tamamlandı
      </Badge>
    );
  }

  if (status === "running") {
    return (
      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-300">
        Devam Ediyor
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/20 dark:text-red-300">
        Başarısız
      </Badge>
    );
  }

  return (
    <Badge className="bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/20 dark:text-zinc-300">
      Beklemede
    </Badge>
  );
}

function computeStepProgress(totalProgress: number, index: number, stepStatus: StepVisualStatus) {
  if (stepStatus === "completed") {
    return 100;
  }

  if (stepStatus === "pending") {
    return 0;
  }

  const segmentStart = index * 20;
  const segmentEnd = segmentStart + 20;
  if (totalProgress <= segmentStart) {
    return 0;
  }

  if (totalProgress >= segmentEnd) {
    return 100;
  }

  return Math.max(0, Math.min(100, Math.round(((totalProgress - segmentStart) / 20) * 100)));
}

function toSampleId(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/u, "");
  return (baseName || fileName).slice(0, 120);
}

function AnalysisStatusPageContent() {
  const {
    analysisStatus,
    isLoading,
    isSubmitting,
    isCancelling,
    isRetrying,
    startAnalysis,
    cancelAnalysis,
    retryAnalysis,
  } = useAnalysisRealtime();
  const previousStatusRef = useRef(analysisStatus.status);
  const [files, setFiles] = useState<FileOption[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [isFilesLoading, setIsFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatusResponse | null>(null);
  const [isWorkerLoading, setIsWorkerLoading] = useState(false);

  useEffect(() => {
    if (analysisStatus.status === "failed" && previousStatusRef.current !== "failed") {
      toast.error(analysisStatus.error ?? "Analiz başarısız oldu.");
    }

    previousStatusRef.current = analysisStatus.status;
  }, [analysisStatus.error, analysisStatus.status]);

  useEffect(() => {
    let cancelled = false;

    const loadFiles = async () => {
      setIsFilesLoading(true);
      setFilesError(null);
      try {
        const response = await fetchApiWithAuth("/api/files", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const detail =
            payload && typeof payload === "object" && "detail" in payload
              ? String(payload.detail)
              : `Dosya listesi alınamadı (${response.status}).`;
          throw new Error(detail);
        }

        if (!cancelled) {
          const normalizedFiles = Array.isArray(payload) ? (payload as FileOption[]) : [];
          setFiles(normalizedFiles);
          if (normalizedFiles.length > 0) {
            setSelectedFileId((current) => current || String(normalizedFiles[0].id));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setFiles([]);
          setSelectedFileId("");
          setFilesError(error instanceof Error ? error.message : "Dosyalar yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setIsFilesLoading(false);
        }
      }
    };

    void loadFiles();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const loadWorkerStatus = async () => {
      if (!cancelled) {
        setIsWorkerLoading(true);
      }
      try {
        const response = await fetchApiWithAuth("/api/admin/worker-status", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          return;
        }
        const parsed = workerStatusResponseSchema.safeParse(payload);
        if (parsed.success && !cancelled) {
          setWorkerStatus(parsed.data);
        }
      } finally {
        if (!cancelled) {
          setIsWorkerLoading(false);
        }
      }
    };

    void loadWorkerStatus();
    intervalId = setInterval(() => {
      void loadWorkerStatus();
    }, 20000);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const currentStepIndex = useMemo(() => {
    const index = PIPELINE_STEPS.findIndex((step) => step.key === analysisStatus.stage);
    if (index >= 0) {
      return index;
    }

    if (analysisStatus.status === "completed") {
      return PIPELINE_STEPS.length - 1;
    }

    if (analysisStatus.status === "idle") {
      return -1;
    }

    return 0;
  }, [analysisStatus.stage, analysisStatus.status]);

  const visualSteps = useMemo(
    () =>
      PIPELINE_STEPS.map((step, index) => {
        let visualStatus: StepVisualStatus = "pending";

        if (analysisStatus.status === "completed") {
          visualStatus = "completed";
        } else if (analysisStatus.status === "failed" && index === currentStepIndex) {
          visualStatus = "failed";
        } else if (currentStepIndex >= 0 && index < currentStepIndex) {
          visualStatus = "completed";
        } else if (
          currentStepIndex >= 0
          && index === currentStepIndex
          && (analysisStatus.status === "started" || analysisStatus.status === "processing")
        ) {
          visualStatus = "running";
        }

        return {
          ...step,
          visualStatus,
          progress: computeStepProgress(analysisStatus.progress, index, visualStatus),
        };
      }),
    [analysisStatus.progress, analysisStatus.status, currentStepIndex]
  );

  const isRunning = analysisStatus.status === "started" || analysisStatus.status === "processing";
  const canRetry = analysisStatus.status === "failed" && Boolean(analysisStatus.job_id);
  const selectedFile = files.find((file) => String(file.id) === selectedFileId) ?? null;

  return (
    <main className="flex-1 p-4 md:p-6">
      <section className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  Aktif Analiz İş Akışı
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pipeline adımlarını veritabanından canlı durumla takip edin.
                </p>
              </div>
              {statusBadge(analysisStatus.status, analysisStatus.stage)}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>RNA-Seq Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium">Analiz Başlat</p>
                    {!isFilesLoading && files.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {filesError ?? "Dosya bulunamadı. Önce Dosya Yöneticisi&apos;nden dosya yükleyin."}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                    <Select
                      value={selectedFileId}
                      onValueChange={(value) => {
                        if (value) {
                          setSelectedFileId(value);
                        }
                      }}
                      disabled={isFilesLoading || files.length === 0 || isRunning}
                    >
                      <SelectTrigger className="w-full lg:w-[320px]">
                        <SelectValue
                          placeholder={isFilesLoading ? "Dosyalar yükleniyor..." : "Analiz dosyası seç"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {files.map((file) => (
                          <SelectItem key={file.id} value={String(file.id)}>
                            {file.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={async () => {
                          if (!selectedFile) {
                            toast.error("Analiz başlatmak için bir dosya seçin.");
                            return;
                          }

                          const result = await startAnalysis(
                            selectedFile.id,
                            toSampleId(selectedFile.name)
                          );
                          if (result.ok) {
                            toast.success("Yeni analiz akışı başlatıldı.");
                            return;
                          }

                          toast.error(result.message ?? "Analiz başlatılamadı.");
                        }}
                        disabled={isSubmitting || isRunning || !selectedFile || isFilesLoading}
                      >
                        {isSubmitting || isRunning ? (
                          <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
                        ) : (
                          <PlayIcon className="mr-2 size-4" />
                        )}
                        Yeni Analiz Başlat
                      </Button>

                      <Button
                        variant="outline"
                        onClick={async () => {
                          const result = await cancelAnalysis();
                          if (result.ok) {
                            toast.success(result.message ?? "Analiz durduruldu.");
                            return;
                          }
                          toast.error(result.message ?? "Analiz durdurulamadı.");
                        }}
                        disabled={!isRunning || !analysisStatus.job_id || isCancelling}
                      >
                        {isCancelling ? (
                          <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
                        ) : (
                          <SquareIcon className="mr-2 size-4" />
                        )}
                        Durdur
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={async () => {
                          const result = await retryAnalysis();
                          if (result.ok) {
                            toast.success(result.message ?? "Analiz yeniden başlatıldı.");
                            return;
                          }
                          toast.error(result.message ?? "Yeniden başlatılamadı.");
                        }}
                        disabled={!canRetry || isRetrying}
                      >
                        {isRetrying ? (
                          <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
                        ) : (
                          <RotateCcwIcon className="mr-2 size-4" />
                        )}
                        Yeniden Dene
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Genel Durum</span>
                    <span className="text-muted-foreground">
                      {isLoading ? "Yükleniyor..." : `%${analysisStatus.progress}`}
                    </span>
                  </div>
                  <Progress
                    value={analysisStatus.progress}
                    trackClassName="h-2"
                    indicatorClassName={
                      analysisStatus.status === "failed"
                        ? "bg-red-600"
                        : analysisStatus.status === "completed"
                          ? "bg-emerald-600"
                          : "bg-blue-600 motion-safe:animate-pulse"
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {stageDescription(analysisStatus.stage, analysisStatus.status)}
                  </p>
                  {analysisStatus.error ? (
                    <p className="text-xs text-destructive">Hata: {analysisStatus.error}</p>
                  ) : null}
                </div>

                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">Worker Health</p>
                    <Badge
                      className={
                        workerStatus && workerStatus.workersOnline > 0
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/20 dark:text-red-300"
                      }
                    >
                      <ServerIcon className="mr-1 size-3.5" />
                      {workerStatus?.workersOnline ?? 0}/{workerStatus?.workersTotal ?? 0} online
                    </Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-md border bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Aktif İş</p>
                      <p className="text-lg font-semibold">
                        {workerStatus?.queue.activeTasks ?? 0}
                      </p>
                    </div>
                    <div className="rounded-md border bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Kuyruk</p>
                      <p className="text-lg font-semibold">{workerStatus?.queue.queued ?? 0}</p>
                    </div>
                    <div className="rounded-md border bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Hata Oranı</p>
                      <p className="text-lg font-semibold">
                        %{workerStatus?.errorRatePercent.toFixed(2) ?? "0.00"}
                      </p>
                    </div>
                    <div className="rounded-md border bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Durum</p>
                      <p className="text-sm font-medium text-muted-foreground">
                        {isWorkerLoading ? "Güncelleniyor..." : "Canlı izleme aktif"}
                      </p>
                    </div>
                  </div>
                  {workerStatus?.brokerError ? (
                    <p className="mt-3 text-xs text-destructive">
                      Broker uyarısı: {workerStatus.brokerError}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-6">
                  {visualSteps.map((step, index) => {
                    const isLast = index === visualSteps.length - 1;
                    const runtimeSnapshot = buildRuntimeSnapshot(
                      step.key,
                      step.visualStatus,
                      step.progress
                    );

                    return (
                      <div key={step.key} className="relative flex gap-4">
                        {!isLast && (
                          <span className="absolute top-7 left-[9px] h-[calc(100%+12px)] w-px bg-border" />
                        )}

                        <div className="mt-0.5">{stepIcon(step.visualStatus)}</div>

                        <div className="w-full space-y-2 pb-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <h3 className="font-medium tracking-tight">{step.title}</h3>
                            {stepBadge(step.visualStatus)}
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Kalan süre: {runtimeSnapshot.eta} | CPU: {runtimeSnapshot.cpu} | RAM:{" "}
                            {runtimeSnapshot.ram}
                          </p>

                          <Progress
                            value={step.progress}
                            trackClassName="h-2"
                            indicatorClassName={
                              step.visualStatus === "failed"
                                ? "bg-red-600"
                                : step.visualStatus === "completed"
                                  ? "bg-emerald-600"
                                  : step.visualStatus === "running"
                                    ? "bg-blue-600 motion-safe:animate-pulse"
                                    : "bg-zinc-300"
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
      </section>
    </main>
  );
}

function AnalysisStatusPageFallback() {
  return (
    <main className="flex-1 p-4 md:p-6">
      <section className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Aktif Analiz İş Akışı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-11/12" />
            <Skeleton className="h-2.5 w-10/12" />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export default function AnalysisStatusPage() {
  return (
    <Suspense fallback={<AnalysisStatusPageFallback />}>
      <AnalysisStatusPageContent />
    </Suspense>
  );
}
