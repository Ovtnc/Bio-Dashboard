import { GenomeBrowserPanel } from "@/components/Bio/genome-browser-panel";

export default function GenomeBrowserPage() {
  return (
    <main className="relative flex-1 overflow-hidden p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 right-10 h-64 w-64 rounded-full bg-zinc-400/10 blur-3xl dark:bg-zinc-600/10" />
        <div className="absolute bottom-10 -left-20 h-56 w-56 rounded-full bg-zinc-300/10 blur-3xl dark:bg-zinc-500/10" />
      </div>
      <section className="relative flex h-full flex-col gap-5">
        <div className="rounded-xl border bg-card/70 p-4 backdrop-blur-sm md:p-5">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Genom Tarayıcı
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            hg38 referansı ile interaktif IGV tarayıcı ve hızlı lokus navigasyonu.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Klinik odaklı genom bölgelerini hızlıca incelemek ve hizalama sinyalini teknik olarak doğrulamak için optimize edildi.
          </p>
        </div>
        <div className="flex-1">
          <GenomeBrowserPanel />
        </div>
      </section>
    </main>
  );
}
