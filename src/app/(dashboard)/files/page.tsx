"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import { useDropzone } from "react-dropzone";
import type { FileRejection } from "react-dropzone";
import {
  BeakerIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  UploadCloudIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { isIgvSupportedFile, IGV_SUPPORTED_EXTENSIONS } from "@/lib/igv-track-utils";
import { MAX_FILE_SIZE_BYTES, uploadFileInChunks } from "@/lib/upload-utils";

type ManagedFile = {
  id: string;
  fileId?: number;
  name: string;
  type: string;
  path?: string;
  sizeBytes: number;
  createdAt: string;
  analyzed: boolean;
  analysisStatus?: string | null;
  uploadStatus: "UPLOADED" | "FAILED";
};

type ApiFileRecord = {
  id: number;
  name: string;
  size: number;
  type: string;
  path: string;
  status: "UPLOADED" | "FAILED";
  createdAt: string;
  analyzed?: boolean;
  analysisStatus?: string | null;
};

type CompletedAnalysisItem = {
  analysisId: number;
  fileId: number | null;
};

type UploadTask = {
  id: string;
  fileName: string;
  progress: number;
  status: "uploading" | "completed" | "error";
  errorMessage?: string;
};

const allowedExtensions = [
  ".fasta",
  ".fa",
  ".fna",
  ".fastq",
  ".vcf",
  ".bam",
  ".bed",
  ".gff",
  ".gff3",
  ".gtf",
  ".bigwig",
  ".wig",
  ".bedgraph",
  ".csv",
] as const;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractExtension(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext ? `.${ext}` : "unknown";
}

function mapApiFileRecord(record: ApiFileRecord): ManagedFile {
  return {
    id: `db-${record.id}`,
    fileId: record.id,
    name: record.name,
    type: record.type,
    path: record.path,
    sizeBytes: Number(record.size),
    createdAt: record.createdAt,
    analyzed: Boolean(record.analyzed),
    analysisStatus: record.analysisStatus ?? null,
    uploadStatus: record.status,
  };
}

function buildLatestAnalysisByFileId(
  rows: CompletedAnalysisItem[]
): Record<number, number> {
  const output: Record<number, number> = {};
  for (const row of rows) {
    if (
      typeof row.fileId === "number" &&
      row.fileId > 0 &&
      typeof row.analysisId === "number" &&
      row.analysisId > 0 &&
      output[row.fileId] === undefined
    ) {
      output[row.fileId] = row.analysisId;
    }
  }
  return output;
}

export default function FilesPage() {
  const router = useRouter();
  const [files, setFiles] = useState<ManagedFile[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [isFileListLoading, setIsFileListLoading] = useState(true);
  const [fileListError, setFileListError] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [latestAnalysisByFileId, setLatestAnalysisByFileId] = useState<Record<number, number>>({});

  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);

  const loadFiles = useCallback(async () => {
    setIsFileListLoading(true);
    setFileListError(null);
    try {
      const response = await fetchApiWithAuth("/api/files", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (response.status === 401 || response.status === 403) {
          throw new Error("UNAUTHORIZED");
        }

        const detail =
          payload && typeof payload === "object" && "detail" in payload
            ? String(payload.detail)
            : `API error: ${response.status}`;
        throw new Error(detail);
      }

      const payload = (await response.json()) as ApiFileRecord[];
      setFiles(payload.map(mapApiFileRecord));

      const completedResponse = await fetchApiWithAuth("/api/analysis/completed?limit=300", {
        method: "GET",
        cache: "no-store",
      });

      if (completedResponse.ok) {
        const completedRows = (await completedResponse.json().catch(() => [])) as CompletedAnalysisItem[];
        setLatestAnalysisByFileId(buildLatestAnalysisByFileId(completedRows));
      } else {
        setLatestAnalysisByFileId({});
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Dosya listesi alınamadı.";
      const message =
        rawMessage === "UNAUTHORIZED"
          ? "Oturum doğrulaması başarısız. Lütfen tekrar giriş yapın."
          : rawMessage;
      setFileListError(message);
      setFiles([]);
      setLatestAnalysisByFileId({});
      toast.error(message);
      if (rawMessage === "UNAUTHORIZED") {
        router.replace("/login?callbackUrl=/files");
      }
    } finally {
      setIsFileListLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    setSelectedFileIds((prev) => {
      const validIds = new Set(
        files
          .filter((file) => typeof file.fileId === "number")
          .map((file) => Number(file.fileId))
      );
      return prev.filter((fileId) => validIds.has(fileId));
    });
  }, [files]);

  const selectableFiles = useMemo(
    () => files.filter((file): file is ManagedFile & { fileId: number } => typeof file.fileId === "number"),
    [files]
  );

  const selectedFiles = useMemo(
    () => selectableFiles.filter((file) => selectedFileIds.includes(file.fileId)),
    [selectableFiles, selectedFileIds]
  );

  const selectedViewableFileIds = useMemo(
    () => selectedFiles.filter((file) => isIgvSupportedFile(file.name, file.type)).map((file) => file.fileId),
    [selectedFiles]
  );

  const allSelected = selectableFiles.length > 0 && selectedFileIds.length === selectableFiles.length;
  const partiallySelected = selectedFileIds.length > 0 && !allSelected;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  const startChunkedUpload = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`${file.name} 50GB limitini aşıyor.`);
        return;
      }

      const taskId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setUploadTasks((prev) => [
        {
          id: taskId,
          fileName: file.name,
          progress: 0,
          status: "uploading",
        },
        ...prev,
      ]);

      try {
        await uploadFileInChunks(file, {
          onProgress: (progress) => {
            setUploadTasks((prev) =>
              prev.map((task) =>
                task.id === taskId ? { ...task, progress } : task
              )
            );
          },
        });

        setUploadTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, progress: 100, status: "completed" }
              : task
          )
        );

        await loadFiles();
        toast.success(`${file.name} chunked upload ile başarıyla yüklendi.`);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Dosya yüklenirken beklenmeyen bir hata oluştu.";

        setUploadTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, status: "error", errorMessage: message }
              : task
          )
        );
        toast.error(`${file.name} yüklenemedi: ${message}`);
      }
    },
    [loadFiles]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      acceptedFiles.forEach((file) => {
        void startChunkedUpload(file);
      });

      rejectedFiles.forEach(({ file }) => {
        toast.error(
          `${file.name} desteklenmeyen dosya türü. İzin verilen: ${allowedExtensions.join(", ")}`
        );
      });
    },
    [startChunkedUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    validator: (file) => {
      const extension = extractExtension(file.name);
      if (!allowedExtensions.includes(extension as (typeof allowedExtensions)[number])) {
        return {
          code: "file-invalid-type",
          message: "Dosya uzantısı desteklenmiyor.",
        };
      }
      return null;
    },
  });

  const requestAnalyze = useCallback(async (file: ManagedFile) => {
    if (!file.fileId) {
      return { ok: false as const, message: "Bu dosya henüz sunucuda kayıtlı değil." };
    }

    const response = await fetchApiWithAuth("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_id: file.fileId,
        sample_id: file.name.replace(/\.[^.]+$/u, "").slice(0, 120),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? String(payload.detail)
          : `Analiz başlatılamadı (HTTP ${response.status}).`;
      return { ok: false as const, message: detail };
    }

    return { ok: true as const };
  }, []);

  const analyzeFile = async (file: ManagedFile) => {
    try {
      const result = await requestAnalyze(file);
      if (!result.ok) {
        throw new Error(result.message);
      }

      await loadFiles();
      toast.success("Dosya analiz kuyruğuna alındı.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Analiz başlatılamadı.";
      toast.error(message);
    }
  };

  const analyzeSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Analiz için önce dosya seçin.");
      return;
    }

    setIsBulkAnalyzing(true);
    let successCount = 0;
    const failedMessages: string[] = [];

    for (const file of selectedFiles) {
      try {
        const result = await requestAnalyze(file);
        if (result.ok) {
          successCount += 1;
        } else {
          failedMessages.push(`${file.name}: ${result.message}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bilinmeyen hata";
        failedMessages.push(`${file.name}: ${message}`);
      }
    }

    await loadFiles();

    if (successCount > 0) {
      toast.success(`${successCount} dosya analiz kuyruğuna eklendi.`);
    }
    if (failedMessages.length > 0) {
      toast.error(`${failedMessages.length} dosyada hata oluştu. İlk hata: ${failedMessages[0]}`);
    }

    setIsBulkAnalyzing(false);
  };

  const downloadFile = async (file: ManagedFile) => {
    if (!file.fileId) {
      toast.error("Bu dosya indirilebilir durumda değil.");
      return;
    }

    const session = await getSession();
    const accessToken = session?.accessToken;
    if (!accessToken) {
      toast.error("Dosya indirmek için oturum doğrulaması gerekli.");
      router.push("/login?callbackUrl=/files");
      return;
    }

    const streamUrl = new URL(`${getApiBaseUrl()}/api/files/${file.fileId}/stream`);
    streamUrl.searchParams.set("token", accessToken);
    window.open(streamUrl.toString(), "_blank", "noopener,noreferrer");
    toast.success(`${file.name} indiriliyor...`);
  };

  const isGenomeBrowserViewable = (file: ManagedFile) =>
    isIgvSupportedFile(file.name, file.type);

  const toggleSelectedFile = (file: ManagedFile, checked: boolean) => {
    if (!file.fileId) {
      return;
    }

    const fileId = file.fileId;
    setSelectedFileIds((prev) => {
      const exists = prev.includes(fileId);
      if (checked && !exists) {
        return [...prev, fileId];
      }

      if (!checked && exists) {
        return prev.filter((id) => id !== fileId);
      }

      return prev;
    });
  };

  const toggleSelectAllFiles = (checked: boolean) => {
    if (!checked) {
      setSelectedFileIds([]);
      return;
    }

    setSelectedFileIds(selectableFiles.map((file) => file.fileId));
  };

  const openSelectedInGenomeBrowser = () => {
    if (selectedFileIds.length === 0) {
      toast.error("Önce en az bir dosya seçin.");
      return;
    }

    if (selectedViewableFileIds.length === 0) {
      toast.error(`Seçilen dosyalar IGV tarafından desteklenmiyor. Desteklenen uzantılar: ${IGV_SUPPORTED_EXTENSIONS.join(", ")}`);
      return;
    }

    if (selectedViewableFileIds.length < selectedFileIds.length) {
      toast.warning("Desteklenmeyen dosyalar atlandı, sadece IGV uyumlu dosyalar açıldı.");
    }

    const params = new URLSearchParams({
      fileIds: selectedViewableFileIds.join(","),
    });
    router.push(`/genome-browser?${params.toString()}`);
  };

  const viewInGenomeBrowser = (file: ManagedFile) => {
    if (!file.fileId) {
      toast.error("Bu dosya henüz sunucuda kayıtlı değil.");
      return;
    }

    if (!isGenomeBrowserViewable(file)) {
      toast.error(
        `IGV desteği yok. Desteklenen uzantılar: ${IGV_SUPPORTED_EXTENSIONS.join(", ")}`
      );
      return;
    }

    const params = new URLSearchParams({
      fileId: String(file.fileId),
      fileType: file.type.toLowerCase(),
      fileName: file.name,
    });

    if (file.path) {
      params.set("path", file.path);
    }

    router.push(`/genome-browser?${params.toString()}`);
  };

  const openAnalysisReport = (file: ManagedFile) => {
    if (!file.fileId) {
      toast.error("Bu dosya için analiz bilgisi bulunamadı.");
      return;
    }

    const analysisId = latestAnalysisByFileId[file.fileId];
    if (!analysisId) {
      toast.error("Bu dosya için tamamlanmış analiz raporu bulunamadı.");
      return;
    }

    router.push(`/reports/${analysisId}`);
  };

  const requestDelete = useCallback(async (file: ManagedFile) => {
    if (!file.fileId) {
      return { ok: false as const, message: "Bu dosya sunucuda kayıtlı olmadığı için silinemiyor." };
    }

    const response = await fetchApiWithAuth(`/api/files/${file.fileId}`, {
      method: "DELETE",
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? String(payload.detail)
          : `Dosya silinemedi (HTTP ${response.status}).`;
      return { ok: false as const, message: detail };
    }

    return { ok: true as const };
  }, []);

  const deleteFile = async (file: ManagedFile) => {
    try {
      const result = await requestDelete(file);
      if (!result.ok) {
        throw new Error(result.message);
      }

      await loadFiles();
      if (file.fileId) {
        setSelectedFileIds((prev) => prev.filter((id) => id !== file.fileId));
      }
      toast.success(`${file.name} silindi.`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Dosya silinirken beklenmeyen bir hata oluştu.";
      toast.error(message);
    }
  };

  const deleteSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Silmek için önce dosya seçin.");
      return;
    }

    const confirmDelete = window.confirm(
      `${selectedFiles.length} dosyayı kalıcı olarak silmek istediğinize emin misiniz?`
    );
    if (!confirmDelete) {
      return;
    }

    setIsBulkDeleting(true);
    let successCount = 0;
    const failedMessages: string[] = [];

    for (const file of selectedFiles) {
      try {
        const result = await requestDelete(file);
        if (result.ok) {
          successCount += 1;
        } else {
          failedMessages.push(`${file.name}: ${result.message}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bilinmeyen hata";
        failedMessages.push(`${file.name}: ${message}`);
      }
    }

    setSelectedFileIds([]);
    await loadFiles();

    if (successCount > 0) {
      toast.success(`${successCount} dosya silindi.`);
    }
    if (failedMessages.length > 0) {
      toast.error(`${failedMessages.length} dosya silinemedi. İlk hata: ${failedMessages[0]}`);
    }

    setIsBulkDeleting(false);
  };

  return (
    <main className="flex-1 p-4 md:p-6">
      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Dosya Yönetim Paneli
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Büyük biyoinformatik dosyalar için chunked upload ve işlem yönetimi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-11 px-4 text-sm md:h-12 md:px-6 md:text-base"
              disabled={selectedViewableFileIds.length === 0}
              onClick={openSelectedInGenomeBrowser}
            >
              <EyeIcon className="mr-2 size-4" />
              Tarayıcıda Aç ({selectedViewableFileIds.length})
            </Button>

            <Button
              variant="outline"
              className="h-11 px-4 text-sm md:h-12 md:px-6 md:text-base"
              disabled={selectedFiles.length === 0 || isBulkAnalyzing}
              onClick={() => void analyzeSelectedFiles()}
            >
              <BeakerIcon className="mr-2 size-4" />
              Seçili Analiz Et ({selectedFiles.length})
            </Button>

            <Button
              variant="destructive"
              className="h-11 px-4 text-sm md:h-12 md:px-6 md:text-base"
              disabled={selectedFiles.length === 0 || isBulkDeleting}
              onClick={() => void deleteSelectedFiles()}
            >
              <Trash2Icon className="mr-2 size-4" />
              Seçili Sil ({selectedFiles.length})
            </Button>

            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger
                render={
                  <Button
                    className="h-11 px-6 text-sm md:h-12 md:px-8 md:text-base"
                  />
                }
              >
                <UploadCloudIcon className="mr-2 size-4" />
                Dosya Yükle
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Chunked Dosya Yükleme</DialogTitle>
                  <DialogDescription>
                    Dosyalar 5MB parçalara ayrılarak yüklenir. Her chunk başarısız olursa 3 kez yeniden denenir.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div
                    {...getRootProps()}
                    className={[
                      "cursor-pointer rounded-lg border border-dashed p-8 text-center transition-colors",
                      isDragActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/60 hover:bg-muted/30",
                    ].join(" ")}
                  >
                    <input {...getInputProps()} />
                    <UploadCloudIcon className="mx-auto size-10 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">
                      {isDragActive
                        ? "Dosyaları bırakın, yükleme başlıyor..."
                        : "Dosyaları sürükleyin veya seçmek için tıklayın"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Desteklenen formatlar: .fasta, .fa, .fna, .fastq, .vcf, .bam, .bed, .gff, .gff3, .gtf, .bigwig, .wig, .bedgraph, .csv
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Maksimum tek dosya boyutu: 50GB
                    </p>
                  </div>

                  {uploadTasks.length > 0 ? (
                    <div className="space-y-3 rounded-lg border p-4">
                      {uploadTasks.map((task) => (
                        <div key={task.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="truncate pr-3">{task.fileName}</span>
                            <span>
                              {task.status === "completed"
                                ? "Tamamlandı"
                                : task.status === "error"
                                  ? "Hata"
                                  : `%${task.progress}`}
                            </span>
                          </div>
                          <Progress
                            value={task.progress}
                            trackClassName="h-2"
                            indicatorClassName={
                              task.status === "error"
                                ? "bg-red-600"
                                : task.status === "completed"
                                  ? "bg-emerald-600"
                                  : "bg-blue-600 motion-safe:animate-pulse"
                            }
                          />
                          {task.errorMessage ? (
                            <p className="text-xs text-destructive">{task.errorMessage}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dosya Envanteri</CardTitle>
            {isFileListLoading ? (
              <p className="text-xs text-muted-foreground">Dosya listesi yükleniyor...</p>
            ) : null}
            {fileListError ? (
              <p className="text-xs text-destructive">{fileListError}</p>
            ) : null}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        className="size-4 cursor-pointer accent-primary"
                        aria-label="Tüm dosyaları seç"
                        disabled={selectableFiles.length === 0}
                        checked={allSelected}
                        onChange={(event) => toggleSelectAllFiles(event.target.checked)}
                      />
                    </TableHead>
                    <TableHead>Dosya Adı</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Boyut</TableHead>
                    <TableHead>Oluşturulma Tarihi</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">Aksiyonlar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFileListLoading
                    ? Array.from({ length: 6 }).map((_, index) => (
                        <TableRow key={`files-table-skeleton-${index}`}>
                          <TableCell><Skeleton className="size-4" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-56" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto size-8 rounded-md" />
                          </TableCell>
                        </TableRow>
                      ))
                    : null}

                  {files.length === 0 && !isFileListLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                        Henüz dosya bulunmuyor. Üstteki &quot;Dosya Yükle&quot; butonunu kullanarak ilk dosyanızı ekleyin.
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {files.map((file) => {
                    return (
                      <TableRow key={file.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
                            disabled={!file.fileId}
                            checked={
                              typeof file.fileId === "number" &&
                              selectedFileIds.includes(file.fileId)
                            }
                            onChange={(event) => toggleSelectedFile(file, event.target.checked)}
                            aria-label={`${file.name} seç`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{file.name}</TableCell>
                        <TableCell>{file.type}</TableCell>
                        <TableCell>{formatSize(file.sizeBytes)}</TableCell>
                        <TableCell>{formatDate(file.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              className={
                                file.analyzed
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300"
                                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/20 dark:text-zinc-300"
                              }
                            >
                              {file.analyzed ? "Analiz Edildi" : "Analiz Edilmedi"}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={
                                file.uploadStatus === "UPLOADED"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                              }
                            >
                              {file.uploadStatus}
                            </Badge>
                            {file.analysisStatus ? (
                              <Badge variant="outline">{file.analysisStatus}</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon-sm" />}
                            >
                              <MoreHorizontalIcon className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                onClick={() => viewInGenomeBrowser(file)}
                              >
                                <EyeIcon className="mr-2 size-4" />
                                Tarayıcıda Görüntüle
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openAnalysisReport(file)}
                              >
                                <FileTextIcon className="mr-2 size-4" />
                                Analiz Raporunu Aç
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void analyzeFile(file)}>
                                <BeakerIcon className="mr-2 size-4" />
                                Analiz Et
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadFile(file)}>
                                <DownloadIcon className="mr-2 size-4" />
                                İndir
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void deleteFile(file)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2Icon className="mr-2 size-4" />
                                Sil
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
