"use client";

import dynamic from "next/dynamic";

const IgvBrowser = dynamic(
  () =>
    import("@/components/genome-browser/igv-browser").then(
      (module) => module.IgvBrowser
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[520px] items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
        Genom tarayıcı yükleniyor...
      </div>
    ),
  }
);

export function GenomeBrowserPanel() {
  return <IgvBrowser />;
}
