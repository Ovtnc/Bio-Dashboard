"use client";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ActivityIcon,
  ChartSplineIcon,
  CloudCogIcon,
  DatabaseBackupIcon,
  DnaIcon,
  FileCode2Icon,
  HardDriveUploadIcon,
  TerminalSquareIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    title: "Ham Veri Yükleme",
    description:
      "FASTQ, BAM, VCF ve CSV veri setlerini merkezi alana aktarın. Otomatik dosya doğrulama ve ilerleme takibi ile süreç güvenli başlar.",
    eyebrow: "Adım 1",
  },
  {
    title: "Otomatik Kalite Kontrol (QC)",
    description:
      "Her örnek için baz kalitesi, GC dağılımı ve adapter kontaminasyonu gibi kritik metrikler otomatik kontrol edilir.",
    eyebrow: "Adım 2",
  },
  {
    title: "Bulut Tabanlı Analiz (Pipeline)",
    description:
      "Pipeline aşamaları ölçeklenebilir compute üzerinde çalışır. CPU/RAM kullanımı ve işlem logları anlık izlenir.",
    eyebrow: "Adım 3",
  },
  {
    title: "İnteraktif Görselleştirme ve Raporlama",
    description:
      "Genom tarayıcı, volcano plot ve otomatik rapor çıktıları ile bulgularınızı hem teknik hem yönetici seviyesinde sunun.",
    eyebrow: "Adım 4",
  },
] as const;

function UploadVisual() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border bg-background/80 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <HardDriveUploadIcon className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">sample_batch_A.fastq.gz</p>
            <p className="text-xs text-muted-foreground">4.8 GB • Upload in progress</p>
          </div>
        </div>
        <Badge variant="outline">FASTQ</Badge>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Upload Progress</span>
          <span>%78</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: "12%" }}
            animate={{ width: "78%" }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="h-full rounded-full bg-primary"
          />
        </div>
      </div>
    </div>
  );
}

function QcVisual() {
  const bars = [72, 81, 88, 84, 91, 87, 93, 86, 90, 95];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">FastQC Snapshot</p>
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300">
          PASS
        </Badge>
      </div>

      <div className="rounded-xl border bg-background/80 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ChartSplineIcon className="size-3.5" />
          Per Base Sequence Quality (Simülasyon)
        </div>
        <div className="flex h-28 items-end gap-1.5">
          {bars.map((height, index) => (
            <motion.div
              key={index}
              initial={{ height: 8, opacity: 0.3 }}
              animate={{ height: `${height}%`, opacity: 1 }}
              transition={{ delay: index * 0.04, duration: 0.35 }}
              className="flex-1 rounded-sm bg-primary/70"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PipelineVisual() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-zinc-950 p-4 text-zinc-100 dark:bg-zinc-900">
        <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
          <TerminalSquareIcon className="size-3.5" />
          Pipeline Log
        </div>
        <div className="space-y-1 font-mono text-xs">
          <p>$ run_pipeline --sample Sample_A104 --profile rna-seq</p>
          <p className="text-emerald-400">[OK] QC stage completed</p>
          <p className="text-cyan-300">[RUN] Alignment on cloud node c7g.4xlarge</p>
          <p className="text-zinc-400">[INFO] Writing interim BAM chunks...</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-background/80 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <ActivityIcon className="size-3.5" /> CPU
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[72%] rounded-full bg-blue-500" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">72%</p>
        </div>
        <div className="rounded-xl border bg-background/80 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <CloudCogIcon className="size-3.5" /> RAM
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[58%] rounded-full bg-violet-500" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">58%</p>
        </div>
      </div>
    </div>
  );
}

function VisualizationVisual() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-background/80 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <DnaIcon className="size-3.5" /> Genome Browser
          </div>
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted" />
            <div className="h-2 w-5/6 rounded-full bg-muted" />
            <div className="h-2 w-2/3 rounded-full bg-emerald-500/60" />
            <div className="h-2 w-4/5 rounded-full bg-cyan-500/60" />
          </div>
        </div>

        <div className="rounded-xl border bg-background/80 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <FileCode2Icon className="size-3.5" /> Volcano Plot
          </div>
          <div className="relative h-20">
            <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
            <div className="absolute bottom-0 left-0 h-px w-full bg-border" />
            <div className="absolute left-[22%] top-[58%] size-2 rounded-full bg-blue-500" />
            <div className="absolute left-[68%] top-[35%] size-2 rounded-full bg-red-500" />
            <div className="absolute left-[48%] top-[52%] size-2 rounded-full bg-zinc-400" />
            <div className="absolute left-[75%] top-[22%] size-2 rounded-full bg-red-500" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-background/80 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <DatabaseBackupIcon className="size-3.5" />
          PDF + Excel raporları tek tıkla paylaşılabilir formatta hazırlanır.
        </div>
      </div>
    </div>
  );
}

function StepVisual({ stepIndex }: { stepIndex: number }) {
  if (stepIndex === 0) return <UploadVisual />;
  if (stepIndex === 1) return <QcVisual />;
  if (stepIndex === 2) return <PipelineVisual />;
  return <VisualizationVisual />;
}

export function LandingHowItWorksStepper() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const cardScale = useTransform(scrollYProgress, [0, 1], [0.96, 1]);
  const cardOpacity = useTransform(scrollYProgress, [0, 0.08, 1], [0.65, 1, 1]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextIndex = Math.min(steps.length - 1, Math.floor(latest * steps.length));
    setActiveStep((prev) => (prev === nextIndex ? prev : nextIndex));
  });

  return (
    <section className="rounded-2xl border bg-gradient-to-b from-zinc-50/60 to-zinc-100/20 p-4 md:p-6 dark:from-zinc-900/50 dark:to-zinc-900/20">
      <div className="mx-auto mb-8 max-w-3xl text-center">
        <Badge variant="outline" className="mb-3">
          Nasıl Çalışır / Farkımız Nedir
        </Badge>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Uçtan Uca Biyoinformatik Akışını Tek Ekranda Yönetin
        </h2>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          Kaydırdıkça her adım vurgulanır; sağ panelde aynı anda ilgili teknik görünüm
          animasyonla güncellenir.
        </p>
      </div>

      <div ref={sectionRef} className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div className="space-y-0">
          {steps.map((step, index) => {
            const isActive = index === activeStep;

            return (
              <div
                key={step.title}
                className="flex min-h-[52vh] items-center border-b border-border/60 py-8 last:border-b-0"
              >
                <motion.div
                  animate={{
                    opacity: isActive ? 1 : 0.35,
                    scale: isActive ? 1 : 0.97,
                    x: isActive ? 0 : -8,
                  }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="max-w-xl"
                >
                  <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                    {step.eyebrow}
                  </p>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight md:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
                    {step.description}
                  </p>
                </motion.div>
              </div>
            );
          })}
        </div>

        <motion.div style={{ scale: cardScale, opacity: cardOpacity }} className="lg:sticky lg:top-24">
          <Card className="overflow-hidden border-zinc-200/80 bg-background/95 shadow-xl dark:border-zinc-800">
            <CardHeader className="border-b bg-muted/20 pb-3">
              <CardTitle className="text-base">
                {steps[activeStep]?.eyebrow} • {steps[activeStep]?.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={steps[activeStep]?.title}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <StepVisual stepIndex={activeStep} />
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
