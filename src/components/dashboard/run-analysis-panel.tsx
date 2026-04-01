"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircleIcon, PlayIcon, RotateCcwIcon, SquareIcon } from "lucide-react";
import { toast } from "sonner";

import { useAnalysisRealtime } from "@/hooks/useAnalysisRealtime";
import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FileOption = {
  id: number;
  name: string;
  type: string;
};

function stageDescription(stage: string, status: "idle" | "started" | "processing" | "completed" | "failed") {
  if (status === "failed") return "Analiz sırasında hata oluştu.";
  if (status === "completed") return "Analiz başarıyla tamamlandı.";

  const stageMap: Record<string, string> = {
    Queued: "Analiz kuyruğa alındı...",
    QC: "Kalite kontrol yapılıyor...",
    Alignment: "Hizalama yapılıyor...",
    Quantification: "Kantifikasyon yapılıyor...",
    Differential: "Diferansiyel analiz yapılıyor...",
    Completed: "Analiz tamamlandı.",
  };

  return stageMap[stage] ?? "Analiz hazırlanıyor...";
}

function toSampleId(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/u, "");
  return (baseName || fileName).slice(0, 120);
}

export function RunAnalysisPanel() {
  const {
    analysisStatus,
    isSubmitting,
    isCancelling,
    isRetrying,
    startAnalysis,
    cancelAnalysis,
    retryAnalysis,
  } = useAnalysisRealtime();
  const [files, setFiles] = useState<FileOption[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [isFilesLoading, setIsFilesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadFiles = async () => {
      setIsFilesLoading(true);
      try {
        const response = await fetchApiWithAuth("/api/files", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => [])) as FileOption[];
        if (!response.ok) {
          throw new Error(`Dosya listesi alınamadı (${response.status}).`);
        }

        if (!cancelled) {
          setFiles(payload);
          if (payload.length > 0) {
            setSelectedFileId((current) => current || String(payload[0].id));
          }
        }
      } catch {
        if (!cancelled) {
          setFiles([]);
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

  const statusDescription = useMemo(
    () => stageDescription(analysisStatus.stage, analysisStatus.status),
    [analysisStatus.stage, analysisStatus.status]
  );

  const isRunning = analysisStatus.status === "processing" || analysisStatus.status === "started";
  const selectedFile = files.find((file) => String(file.id) === selectedFileId) ?? null;
  const canRetry = analysisStatus.status === "failed" && Boolean(analysisStatus.job_id);

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Analiz Kontrol Paneli</p>
            <Badge
              className={
                analysisStatus.status === "completed"
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300"
                  : analysisStatus.status === "failed"
                    ? "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/20 dark:text-red-300"
                    : isRunning
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-300"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/20 dark:text-zinc-300"
              }
            >
              {analysisStatus.stage}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{statusDescription}</p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[280px]">
          <Select
            value={selectedFileId}
            onValueChange={(value) => {
              if (value) {
                setSelectedFileId(value);
              }
            }}
            disabled={isFilesLoading || files.length === 0 || isRunning}
          >
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue placeholder={isFilesLoading ? "Dosyalar yükleniyor..." : "Analiz dosyası seç"} />
            </SelectTrigger>
            <SelectContent>
              {files.map((file) => (
                <SelectItem key={file.id} value={String(file.id)}>
                  {file.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                if (!selectedFile) {
                  toast.error("Analiz başlatmak için bir dosya seçin.");
                  return;
                }

                const result = await startAnalysis(selectedFile.id, toSampleId(selectedFile.name));
                if (result.ok) {
                  toast.success("Yeni analiz akışı başlatıldı.");
                  return;
                }

                toast.error(result.message ?? "Analiz başlatılamadı.");
              }}
              disabled={isSubmitting || isRunning || !selectedFile || isFilesLoading}
              className="h-11 px-6 text-sm md:h-12 md:px-8 md:text-base"
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
              className="h-11 px-5 text-sm md:h-12"
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
                toast.error(result.message ?? "Yeniden başlatma başarısız oldu.");
              }}
              disabled={!canRetry || isRetrying}
              className="h-11 px-5 text-sm md:h-12"
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

      {!isFilesLoading && files.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Analiz başlatmak için önce Dosya Yöneticisi sayfasından dosya yükleyin.
        </p>
      ) : null}

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>İlerleme</span>
          <span>%{analysisStatus.progress}</span>
        </div>
        <Progress
          value={analysisStatus.progress}
          trackClassName="h-2"
          indicatorClassName={
            isRunning
              ? "bg-blue-600 motion-safe:animate-pulse"
              : analysisStatus.status === "completed"
                ? "bg-emerald-600"
                : analysisStatus.status === "failed"
                  ? "bg-red-600"
                  : "bg-zinc-400"
          }
        />
        {analysisStatus.error ? (
          <p className="text-xs text-destructive">{analysisStatus.error}</p>
        ) : null}
      </div>
    </div>
  );
}
