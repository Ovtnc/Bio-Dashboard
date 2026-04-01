"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const GenomeBrowser = dynamic(
  () => import("@/components/Bio/GenomeBrowser").then((module) => module.GenomeBrowser),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center rounded-lg border bg-muted/10 p-6">
        <div className="w-full max-w-3xl space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-[420px] w-full rounded-lg" />
        </div>
      </div>
    ),
  }
);

export function GenomeBrowserPanel() {
  return <GenomeBrowser />;
}
