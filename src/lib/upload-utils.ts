"use client";

import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
import {
  uploadChunkRequestMetaSchema,
  uploadChunkResponseSchema,
  type UploadChunkResponse,
} from "@/lib/schemas/api";

export const CHUNK_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 * 1024;
const MAX_RETRY_COUNT = 3;

type UploadFileInChunksOptions = {
  chunkSizeBytes?: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

function createUploadId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function splitFileIntoChunks(file: File, chunkSizeBytes = CHUNK_SIZE_BYTES) {
  if (chunkSizeBytes <= 0) {
    throw new Error("Chunk boyutu 0'dan büyük olmalıdır.");
  }

  if (file.size <= 0) {
    throw new Error("Boş dosya yüklenemez.");
  }

  const chunks: Blob[] = [];
  for (let offset = 0; offset < file.size; offset += chunkSizeBytes) {
    const nextOffset = Math.min(offset + chunkSizeBytes, file.size);
    chunks.push(file.slice(offset, nextOffset));
  }

  return chunks;
}

async function uploadChunkWithRetry({
  chunk,
  chunkIndex,
  totalChunks,
  file,
  uploadId,
  signal,
}: {
  chunk: Blob;
  chunkIndex: number;
  totalChunks: number;
  file: File;
  uploadId: string;
  signal?: AbortSignal;
}) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRY_COUNT; attempt += 1) {
    try {
      const requestMetadata = uploadChunkRequestMetaSchema.safeParse({
        chunkIndex,
        totalChunks,
        fileName: file.name,
        fileSize: file.size,
      });
      if (!requestMetadata.success) {
        throw new Error(requestMetadata.error.issues[0]?.message ?? "Upload metadata geçersiz.");
      }

      const formData = new FormData();
      formData.append("chunk", chunk, `${file.name}.part-${chunkIndex}`);
      formData.append("chunkIndex", String(requestMetadata.data.chunkIndex));
      formData.append("totalChunks", String(requestMetadata.data.totalChunks));
      formData.append("fileName", requestMetadata.data.fileName);
      formData.append("uploadId", uploadId);
      formData.append("fileSize", String(requestMetadata.data.fileSize));
      formData.append("fileType", file.name.includes(".") ? `.${file.name.split(".").pop()?.toLowerCase() ?? ""}` : "unknown");

      const response = await fetchApiWithAuth("/api/upload-chunk", {
        method: "POST",
        body: formData,
        signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        const detail = payload?.detail ?? `HTTP ${response.status}`;
        throw new Error(detail);
      }

      const payload = await response.json();
      const parsedPayload = uploadChunkResponseSchema.safeParse(payload);
      if (!parsedPayload.success) {
        throw new Error("Upload chunk cevabı doğrulanamadı.");
      }

      return parsedPayload.data;
    } catch (error) {
      if (signal?.aborted) {
        throw new Error("Yükleme kullanıcı tarafından iptal edildi.");
      }

      lastError = error instanceof Error ? error : new Error("Chunk yükleme hatası");
      if (attempt < MAX_RETRY_COUNT) {
        await delay(300 * attempt);
      }
    }
  }

  throw lastError ?? new Error("Chunk yükleme 3 denemede başarısız oldu.");
}

export async function uploadFileInChunks(
  file: File,
  options: UploadFileInChunksOptions = {}
) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Dosya boyutu limiti aşıldı (maksimum 50GB).");
  }

  const chunkSizeBytes = options.chunkSizeBytes ?? CHUNK_SIZE_BYTES;
  const chunks = splitFileIntoChunks(file, chunkSizeBytes);
  const uploadId = createUploadId();

  let finalResponse: UploadChunkResponse | null = null;
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const response = await uploadChunkWithRetry({
      chunk: chunks[chunkIndex],
      chunkIndex,
      totalChunks: chunks.length,
      file,
      uploadId,
      signal: options.signal,
    });

    finalResponse = response;
    const progress = Math.max(
      response.progress ?? 0,
      Math.round(((chunkIndex + 1) / chunks.length) * 100)
    );
    options.onProgress?.(Math.min(progress, 100));
  }

  if (!finalResponse) {
    throw new Error("Yükleme sonucu alınamadı.");
  }

  return finalResponse;
}
