"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2Icon,
  DatabaseZapIcon,
  HardDriveIcon,
  LoaderCircleIcon,
  TargetIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { RunAnalysisPanel } from "@/components/dashboard/run-analysis-panel";
import { fetchApiWithAuth } from "@/lib/authenticated-fetch";
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

const MultiAnalysisComparison = dynamic(
  () =>
    import("@/components/dashboard/multi-analysis-comparison").then(
      (module) => module.MultiAnalysisComparison
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[760px] w-full rounded-xl" />,
  }
);

type DashboardOverview = {
  summary: {
    totalSamples: number;
    qcPassedCount: number;
    qcPassedRate: number;
    analyzedGenes: number;
    storageUsedBytes: number;
    storageLimitBytes: number;
  };
  activities: Array<{
    analysisId: number;
    sampleId: string;
    activity: string;
    pipeline: string;
    owner: string;
    updatedAt: string;
  }>;
};

function formatStorage(bytes: number) {
  const tb = bytes / (1024 ** 4);
  if (tb >= 1) {
    return `${tb.toFixed(2)} TB`;
  }

  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(1)} GB`;
}

function relativeTime(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return "az önce";
  if (diffMin < 60) return `${diffMin} dakika önce`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} saat önce`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} gün önce`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadOverview = async () => {
      setIsLoading(true);
      try {
        const response = await fetchApiWithAuth("/api/dashboard/overview", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as DashboardOverview | null;

        if (!response.ok || !payload) {
          throw new Error("Dashboard verisi alınamadı.");
        }

        if (!cancelled) {
          setOverview(payload);
        }
      } catch {
        if (!cancelled) {
          setOverview(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  const summaryCards = useMemo(() => {
    const summary = overview?.summary;
    const totalSamples = summary?.totalSamples ?? 0;
    const qcPassedCount = summary?.qcPassedCount ?? 0;
    const qcRate = summary?.qcPassedRate ?? 0;
    const analyzedGenes = summary?.analyzedGenes ?? 0;
    const storageUsed = summary?.storageUsedBytes ?? 0;
    const storageLimit = summary?.storageLimitBytes ?? 0;

    return [
      {
        title: "Toplam Örnek Sayısı",
        value: totalSamples.toLocaleString("tr-TR"),
        icon: UsersIcon,
        iconClassName: "text-muted-foreground",
      },
      {
        title: "QC Geçen Örnekler",
        value: `${qcPassedCount.toLocaleString("tr-TR")} / %${qcRate.toFixed(1)}`,
        icon: CheckCircle2Icon,
        iconClassName: "text-emerald-600",
      },
      {
        title: "Analiz Edilen Gen Sayısı",
        value: analyzedGenes.toLocaleString("tr-TR"),
        icon: TargetIcon,
        iconClassName: "text-muted-foreground",
      },
      {
        title: "Depolama Alanı",
        value: `${formatStorage(storageUsed)} / ${formatStorage(storageLimit)}`,
        icon: HardDriveIcon,
        iconClassName: "text-muted-foreground",
      },
    ];
  }, [overview]);

  const lastUpdatedLabel = useMemo(() => {
    if (!overview?.activities?.length) {
      return isLoading ? "veri yükleniyor" : "veri bekleniyor";
    }

    const latest = overview.activities
      .map((activity) => activity.updatedAt)
      .find((updatedAt) => Boolean(updatedAt));
    return latest ? relativeTime(latest) : "veri bekleniyor";
  }, [isLoading, overview]);

  return (
    <main className="flex-1 p-4 md:p-6">
      <section className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Proje Genel Bakış
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Son güncelleme: {lastUpdatedLabel}
              </p>
              </div>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={isDemoLoading}
                onClick={async () => {
                  setIsDemoLoading(true);
                  try {
                    const response = await fetchApiWithAuth("/api/demo/load-analysis", {
                      method: "POST",
                    });
                    const payload = (await response.json().catch(() => null)) as
                      | { analysisId?: number; reportPath?: string; message?: string }
                      | null;
                    if (!response.ok || !payload?.analysisId) {
                      throw new Error("Demo analiz yüklenemedi.");
                    }

                    toast.success(payload.message ?? "Demo analiz hazır.");
                    router.push(payload.reportPath ?? `/reports/${payload.analysisId}`);
                  } catch (error) {
                    const message =
                      error instanceof Error ? error.message : "Demo analiz yüklenemedi.";
                    toast.error(message);
                  } finally {
                    setIsDemoLoading(false);
                  }
                }}
              >
                {isDemoLoading ? (
                  <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
                ) : (
                  <DatabaseZapIcon className="mr-2 size-4" />
                )}
                Load Demo Data
              </Button>
            </div>

            <RunAnalysisPanel />

            <MultiAnalysisComparison />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {isLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Card key={`dashboard-summary-skeleton-${index}`}>
                      <CardHeader className="pb-2">
                        <Skeleton className="h-4 w-32" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-8 w-24" />
                      </CardContent>
                    </Card>
                  ))
                : summaryCards.map(({ title, value, icon: Icon, iconClassName }) => (
                    <Card key={title}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {title}
                        </CardTitle>
                        <Icon className={`size-4 ${iconClassName}`} />
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-semibold tracking-tight">{value}</p>
                      </CardContent>
                    </Card>
                  ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Son Aktiviteler</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Örnek ID</TableHead>
                      <TableHead>Aktivite</TableHead>
                      <TableHead>Pipeline</TableHead>
                      <TableHead>Sorumlu</TableHead>
                      <TableHead className="text-right">Zaman</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={`dashboard-activity-skeleton-${index}`}>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                        </TableRow>
                      ))
                    ) : overview && overview.activities.length > 0 ? (
                      overview.activities.map((activity) => (
                        <TableRow key={`${activity.analysisId}-${activity.updatedAt}`}>
                          <TableCell className="font-medium">{activity.sampleId}</TableCell>
                          <TableCell>{activity.activity}</TableCell>
                          <TableCell>{activity.pipeline}</TableCell>
                          <TableCell>{activity.owner}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {relativeTime(activity.updatedAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                          Henüz aktivite bulunmuyor. İlk analizi başlattığınızda burada görünecek.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
      </section>
    </main>
  );
}
