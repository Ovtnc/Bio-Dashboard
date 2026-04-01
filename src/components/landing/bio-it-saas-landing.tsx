"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRightIcon,
  BookMarkedIcon,
  BrainCircuitIcon,
  FileCode2Icon,
  FlaskConicalIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadCloudIcon,
} from "lucide-react";

import { StickyScrollStations } from "@/components/landing/sticky-scroll-stations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const differentiators = [
  {
    title: "🧬 Moleküler Derinlik",
    description:
      "Sadece genler değil; NGL Viewer ile protein yapılarını ve mutasyon bölgelerini 3D olarak görün.",
    icon: FlaskConicalIcon,
  },
  {
    title: "🚦 Akıllı Karar Desteği",
    description:
      "Ham veri ile klinik teşhis arasındaki boşluğu; otomatik ilaç eşleşmeleri ve patojenite skorlarıyla kapatın.",
    icon: BrainCircuitIcon,
  },
  {
    title: "🛠️ Araştırmacı Özgürlüğü",
    description:
      "Gen Sepeti, Lab Notebook ve Code Export (Python/R) ile analizinizi tamamen kişiselleştirin ve akademik yayına hazır hale getirin.",
    icon: BookMarkedIcon,
  },
];

const workflowSteps = [
  {
    step: "Adım 1 • Yükle",
    title: "Güvenli ve parçalı (chunked) upload",
    description:
      "Güvenli ve parçalı (chunked) upload ile GB'larca veriyi saniyeler içinde sisteme aktarın.",
    icon: UploadCloudIcon,
  },
  {
    step: "Adım 2 • Keşfet",
    title: "Canlı pipeline + 3D keşif",
    description:
      "Otomatik pipeline'lar çalışırken canlı bildirimler alın; 3D sarmal ve Genome Browser ile veriyi yerinde inceleyin.",
    icon: SparklesIcon,
  },
  {
    step: "Adım 3 • Raporla",
    title: "Akademik standartlarda çıktı",
    description:
      "Tek tıkla akademik standartlarda PDF/Excel raporları alın ve anonim linklerle güvenle paylaşın.",
    icon: FileCode2Icon,
  },
];

const techStack = [
  "FastAPI",
  "Next.js",
  "Celery",
  "Redis",
  "IGV.js",
  "NGL",
  "Plotly",
  "Prisma",
  "PostgreSQL",
  "WebSocket",
];

function HeroMolecularField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(99,102,241,0.34),transparent_40%),radial-gradient(circle_at_84%_28%,rgba(139,92,246,0.3),transparent_43%),radial-gradient(circle_at_52%_86%,rgba(34,211,238,0.26),transparent_40%)]" />

      <motion.div
        className="absolute left-1/2 top-[48%] h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30"
        animate={{ rotate: 360 }}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute left-1/2 top-[48%] h-[16rem] w-[16rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/30"
        animate={{ rotate: -360 }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
      />

      {Array.from({ length: 24 }).map((_, index) => (
        <motion.span
          key={`hero-node-${index}`}
          className="absolute size-2 rounded-full bg-cyan-300/70 shadow-[0_0_20px_rgba(34,211,238,0.55)]"
          style={{
            left: `${8 + ((index * 3.8) % 84)}%`,
            top: `${10 + ((index * 5.2) % 76)}%`,
          }}
          animate={{
            x: [0, index % 2 === 0 ? 14 : -12, 0],
            y: [0, index % 3 === 0 ? -16 : 12, 0],
            opacity: [0.35, 0.9, 0.35],
          }}
          transition={{
            duration: 5 + (index % 6),
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.14,
          }}
        />
      ))}

      {Array.from({ length: 8 }).map((_, index) => (
        <motion.div
          key={`helix-line-${index}`}
          className="absolute left-1/2 h-0.5 w-[46rem] max-w-[92vw] -translate-x-1/2 bg-gradient-to-r from-indigo-400/10 via-violet-300/50 to-cyan-300/15"
          style={{ top: `${22 + index * 8}%` }}
          animate={{ rotate: [0, index % 2 ? 6 : -6, 0], opacity: [0.3, 0.75, 0.3] }}
          transition={{ duration: 6 + index, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function ElitePreviewCard() {
  return (
    <Card className="relative overflow-hidden border-white/20 bg-white/10 backdrop-blur-md dark:border-cyan-400/20 dark:bg-zinc-900/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Elite Clinical Intelligence Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Protein Structure: TP53</span>
            <span className="text-fuchsia-300">Mutation hotspot: p.R248Q</span>
          </div>
          <div className="relative h-28 overflow-hidden rounded-lg border border-indigo-400/20 bg-gradient-to-br from-indigo-950/70 to-cyan-950/25">
            {Array.from({ length: 20 }).map((_, idx) => (
              <motion.span
                key={`preview-node-${idx}`}
                className="absolute size-2 rounded-full bg-cyan-300/70"
                style={{ left: `${6 + ((idx * 4.7) % 88)}%`, top: `${10 + ((idx * 6.9) % 74)}%` }}
                animate={{ y: [0, idx % 2 ? 5 : -5, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 3.6 + (idx % 4) * 0.6, repeat: Infinity }}
              />
            ))}
            <motion.span
              className="absolute left-[52%] top-[44%] size-4 rounded-full bg-fuchsia-400 shadow-[0_0_16px_rgba(232,121,249,0.9)]"
              animate={{ scale: [1, 1.45, 1] }}
              transition={{ duration: 1.9, repeat: Infinity }}
            />
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          {[
            { label: "Significant Genes", value: "1,284" },
            { label: "Drug Matches", value: "17" },
            { label: "Clinical Score", value: "82 / 100" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-violet-400/20 bg-violet-500/5 p-2.5">
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TechStackMarquee() {
  return (
    <Card className="overflow-hidden border-white/20 bg-white/10 backdrop-blur-md dark:border-cyan-400/20 dark:bg-zinc-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Powered by Industry Standards</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-hidden rounded-lg border border-cyan-400/20 bg-cyan-500/5 py-3">
          <motion.div
            className="flex min-w-max items-center gap-3 px-4"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          >
            {[...techStack, ...techStack].map((item, index) => (
              <span
                key={`stack-${index}`}
                className="whitespace-nowrap rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-foreground"
              >
                {item}
              </span>
            ))}
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BioItSaasLanding() {
  return (
    <main className="relative overflow-x-hidden">
      <HeroMolecularField />

      <div className="relative mx-auto w-full max-w-7xl space-y-14 px-4 py-10 md:px-8 md:py-14">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <p className="text-xs font-medium tracking-[0.16em] text-cyan-200/80 uppercase">
            Elite Bioinformatics Operating System
          </p>
          <h1 className="mx-auto mt-4 max-w-6xl text-balance text-3xl font-semibold tracking-tight md:text-6xl">
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
              Genomik Veriden Klinik Keşfe: Uçtan Uca Biyoinformatik İşletim Sistemi.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-4xl text-pretty text-sm text-zinc-200/85 md:text-lg">
            Sadece analiz yapmayın; 3D protein modelleri, etkileşim ağları ve kişiselleştirilmiş tedavi önerileriyle verinizin hikayesini keşfedin.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="bg-cyan-500 text-zinc-950 hover:bg-cyan-400" nativeButton={false} render={<Link href="/files" />}>
              Analize Başla
              <ArrowRightIcon className="ml-2 size-4" />
            </Button>
            <Button size="lg" variant="outline" className="border-cyan-300/35 bg-white/5 backdrop-blur-md" nativeButton={false} render={<Link href="/reports" />}>
              Örnek Raporu İncele
            </Button>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          viewport={{ once: true, amount: 0.25 }}
        >
          <ElitePreviewCard />
        </motion.section>

        <StickyScrollStations />

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          viewport={{ once: true, amount: 0.25 }}
          className="space-y-4"
        >
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">Neden Bio-Dash?</h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Rakip dashboardların ötesinde; moleküler derinlik, klinik karar desteği ve araştırmacı özgürlüğü sunar.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {differentiators.map((item) => (
              <Card
                key={item.title}
                className="border-white/20 bg-white/10 backdrop-blur-md dark:border-cyan-400/20 dark:bg-zinc-900/40"
              >
                <CardContent className="p-5">
                  <div className="inline-flex rounded-md border border-cyan-400/25 bg-cyan-500/10 p-2">
                    <item.icon className="size-4 text-cyan-300" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          viewport={{ once: true, amount: 0.25 }}
          className="space-y-4"
        >
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">Nasıl Çalışır? (3 Adımda Analiz)</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {workflowSteps.map((step) => (
              <Card
                key={step.step}
                className="border-white/20 bg-white/10 backdrop-blur-md dark:border-indigo-400/20 dark:bg-zinc-900/40"
              >
                <CardContent className="p-5">
                  <div className="inline-flex rounded-md border border-violet-400/25 bg-violet-500/10 p-2">
                    <step.icon className="size-4 text-violet-300" />
                  </div>
                  <p className="mt-3 text-xs font-medium tracking-wide text-cyan-300/90 uppercase">{step.step}</p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          viewport={{ once: true, amount: 0.2 }}
          className="space-y-4"
        >
          <TechStackMarquee />
          <Card className="border-emerald-400/30 bg-emerald-500/10 backdrop-blur-md">
            <CardContent className="flex items-start gap-2 p-4 text-sm">
              <ShieldCheckIcon className="mt-0.5 size-4 text-emerald-300" />
              <p className="text-emerald-100/95">
                Klinik güvenlik ve araştırma izlenebilirliği için modern auth, audit ve standartlaştırılmış rapor üretim katmanlarıyla tasarlanmıştır.
              </p>
            </CardContent>
          </Card>
        </motion.section>
      </div>

      <footer className="border-t border-zinc-800/60 bg-zinc-950/60 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 text-xs text-zinc-400 md:px-8">
          <p>Oar & Ore Biyoteknoloji © 2026</p>
          <div className="inline-flex items-center gap-2">
            <SparklesIcon className="size-3.5 text-cyan-300" />
            <span>Bio-Dash Clinical Intelligence</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
