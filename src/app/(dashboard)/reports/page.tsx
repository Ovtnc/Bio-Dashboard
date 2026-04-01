"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileTextIcon, FlaskConicalIcon } from "lucide-react";
import { toast } from "sonner";

import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
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

type CompletedAnalysisItem = {
  analysisId: number;
  jobId: string;
  label: string;
  sampleId: string | null;
  fileId: number | null;
  fileName: string | null;
  analysisType: string | null;
  stage: string | null;
  updatedAt: string | null;
};

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toTypeLabel(value: string | null) {
  if (!value) {
    return "-";
  }
  return value.toUpperCase().startsWith("RNA") ? "RNA-Seq" : "DNA-Seq";
}

export default function ReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CompletedAnalysisItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRows = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchApiWithAuth("/api/analysis/completed?limit=150", {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => [])) as CompletedAnalysisItem[];
        if (!response.ok) {
          throw new Error("Rapor listesi alınamadı.");
        }

        if (!cancelled) {
          setRows(payload);
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const message =
          loadError instanceof Error ? loadError.message : "Rapor listesi alınamadı.";
        setRows([]);
        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadRows();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    const rna = rows.filter((row) => toTypeLabel(row.analysisType) === "RNA-Seq").length;
    const dna = total - rna;

    return { total, rna, dna };
  }, [rows]);

  return (
    <main className="flex-1 space-y-5 p-4 md:p-6">
          <Card className="border-zinc-300/70 bg-background/80">
            <CardHeader>
              <CardTitle className="text-2xl tracking-tight">Rapor Merkezi</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Toplam Tamamlanan Analiz</p>
                <p className="mt-1 text-lg font-semibold">{summary.total}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">RNA-Seq</p>
                <p className="mt-1 text-lg font-semibold">{summary.rna}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">DNA-Seq</p>
                <p className="mt-1 text-lg font-semibold">{summary.dna}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConicalIcon className="size-5" />
                Klinik Karar Destek Raporları
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Analiz ID</TableHead>
                      <TableHead>Örnek / Etiket</TableHead>
                      <TableHead>Tür</TableHead>
                      <TableHead>Aşama</TableHead>
                      <TableHead>Güncellenme</TableHead>
                      <TableHead className="text-right">Aksiyon</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 8 }).map((_, idx) => (
                        <TableRow key={`reports-list-skeleton-${idx}`}>
                          <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-52" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-28" /></TableCell>
                        </TableRow>
                      ))
                    ) : rows.length ? (
                      rows.map((row) => (
                        <TableRow key={row.analysisId}>
                          <TableCell className="font-medium">#{row.analysisId}</TableCell>
                          <TableCell>
                            <p className="font-medium">{row.label}</p>
                            <p className="text-xs text-muted-foreground">{row.fileName ?? "Dosya bilgisi yok"}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{toTypeLabel(row.analysisType)}</Badge>
                          </TableCell>
                          <TableCell>{row.stage ?? "Completed"}</TableCell>
                          <TableCell className="text-muted-foreground">{formatUpdatedAt(row.updatedAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => {
                                router.push(`/reports/${row.analysisId}`);
                              }}
                            >
                              <FileTextIcon className="mr-2 size-4" />
                              Detayı Aç
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          {error ?? "Henüz tamamlanmış analiz bulunmuyor."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
    </main>
  );
}
