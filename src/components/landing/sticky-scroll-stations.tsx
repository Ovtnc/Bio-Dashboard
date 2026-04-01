"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  AtomIcon,
  BookMarkedIcon,
  CheckCheckIcon,
  FileCheck2Icon,
  FolderUpIcon,
  FlaskConicalIcon,
  Layers3Icon,
  NetworkIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type Station = {
  id: "upload" | "protein" | "network" | "basket";
  title: string;
  description: string;
  detail: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
};

const stations: Station[] = [
  {
    id: "upload",
    title: "İstasyon 1: Chunked Upload & Akıllı QC",
    description:
      "GB ölçeğindeki FASTQ/BAM dosyalarını parçalı upload ile güvenli şekilde aktarın; kalite metrikleri otomatik üretilsin.",
    detail: "Upload, QC ve iş kuyruğu tek timeline üzerinde izlenir. Manuel dosya transfer zinciri ortadan kalkar.",
    value: "Yükleme + ön kontrol akışında operasyon süresi belirgin şekilde kısalır.",
    icon: FolderUpIcon,
  },
  {
    id: "protein",
    title: "İstasyon 2: Protein 3D & Mutasyon Odağı",
    description:
      "NGL tabanlı protein görünümünde kritik mutasyon bölgelerini 3D olarak inceleyin ve yapısal etkisini görün.",
    detail: "Gen seviyesindeki bulgular doğrudan protein uzayında doğrulanır; ekip içi yorum netleşir.",
    value: "Kritik biyobelirteç değerlendirmesi daha güvenli ve görsel hale gelir.",
    icon: AtomIcon,
  },
  {
    id: "network",
    title: "İstasyon 3: Interaction Network & Pathway Map",
    description:
      "Önemli genleri etkileşim ağında ve pathway katmanında birlikte görerek biyolojik bağlamı kaybetmeden yorumlayın.",
    detail: "Node-level sinyal etkisi, fonksiyonel zenginleştirme ve klinik risk göstergeleri tek çerçevede birleşir.",
    value: "Ham diferansiyel ifade verisi, karar destek sinyaline dönüşür.",
    icon: NetworkIcon,
  },
  {
    id: "basket",
    title: "İstasyon 4: Gene Basket + Notebook + Yayın Çıktısı",
    description:
      "Gene Basket ile seçili genleri takip edin, Lab Notebook ile bağlamı kaydedin, PDF/Excel ve kod export ile yayına hazırlayın.",
    detail: "Analiz sonunda klinik ekip ve araştırma ekipleri için aynı doğrulukta taşınabilir çıktı üretirsiniz.",
    value: "Raporlama ve paylaşım döngüsü tek tık akışına iner.",
    icon: FileCheck2Icon,
  },
];

function previewByStation(stationId: Station["id"]) {
  if (stationId === "upload") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {["Upload", "QC Score", "Read Count"].map((item, idx) => (
            <div key={item} className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2">
              <p className="text-[10px] text-muted-foreground">{item}</p>
              <p className="mt-1 text-xs font-semibold">
                {idx === 0 ? "84%" : idx === 1 ? "92/100" : "18.4M"}
              </p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {[84, 66, 92, 77, 95].map((width, idx) => (
            <div key={`bar-${idx}`} className="h-2 rounded-full bg-zinc-300/50 dark:bg-zinc-700/60">
              <motion.div
                className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-indigo-500"
                initial={{ width: "0%" }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.8, delay: idx * 0.08 }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stationId === "protein") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-md border border-fuchsia-500/25 bg-fuchsia-500/5 px-3 py-1 text-[11px]">
          <span>Protein: TP53</span>
          <span className="text-fuchsia-300">Mutasyon lokusu: p.R248Q</span>
        </div>
        <div className="relative h-32 overflow-hidden rounded-md border border-indigo-500/25 bg-gradient-to-br from-indigo-950/70 to-cyan-950/30">
          {Array.from({ length: 18 }).map((_, idx) => (
            <motion.span
              key={`prot-node-${idx}`}
              className="absolute size-2 rounded-full bg-cyan-300/70"
              style={{
                left: `${8 + ((idx * 5.4) % 84)}%`,
                top: `${10 + ((idx * 7.4) % 72)}%`,
              }}
              animate={{
                y: [0, idx % 2 === 0 ? 6 : -6, 0],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 3.5 + (idx % 4) * 0.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
          <motion.span
            className="absolute left-[48%] top-[44%] size-4 rounded-full bg-fuchsia-400 shadow-[0_0_14px_rgba(232,121,249,0.95)]"
            animate={{ scale: [1, 1.45, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
        </div>
      </div>
    );
  }

  if (stationId === "network") {
    return (
      <div className="grid gap-3">
        <svg
          viewBox="0 0 340 140"
          className="w-full rounded-md border border-cyan-500/25 bg-cyan-500/5 p-2"
        >
          {[0, 1, 2, 3, 4].map((idx) => (
            <g key={`node-${idx}`}>
              {idx < 4 ? (
                <line
                  x1={45 + idx * 72}
                  y1={70}
                  x2={100 + idx * 72}
                  y2={70}
                  stroke={idx >= 2 ? "#f43f5e" : "#38bdf8"}
                  strokeWidth="3"
                  strokeDasharray={idx >= 2 ? "6 4" : "0"}
                />
              ) : null}
              <circle
                cx={30 + idx * 72}
                cy={70}
                r="16"
                fill={idx >= 2 ? "rgba(244,63,94,0.18)" : "rgba(34,211,238,0.18)"}
                stroke={idx >= 2 ? "#f43f5e" : "#22d3ee"}
                strokeWidth="2"
              />
            </g>
          ))}
        </svg>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2">Node: 20</div>
          <div className="rounded-md border border-indigo-500/20 bg-indigo-500/5 p-2">Edge: 43</div>
          <div className="rounded-md border border-fuchsia-500/20 bg-fuchsia-500/5 p-2">Critical: 5</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {["Basket", "Notebook", "Export"].map((item, idx) => (
          <div key={item} className="rounded-md border border-violet-500/20 bg-violet-500/5 p-2">
            <p className="text-[10px] text-zinc-300">{item}</p>
            <p className="mt-1 text-xs font-semibold">
              {idx === 0 ? "12 gen" : idx === 1 ? "8 not" : "PDF + XLSX"}
            </p>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {["BRCA1", "TP53", "PIK3CA"].map((gene) => (
          <div
            key={gene}
            className="flex items-center justify-between rounded-md border border-indigo-500/25 bg-background/70 px-2 py-1 text-[11px]"
          >
            <span>{gene}</span>
            <span className="text-cyan-300">Basket ✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StationBlock({
  station,
  index,
  total,
  progress,
  activeIndex,
}: {
  station: Station;
  index: number;
  total: number;
  progress: MotionValue<number>;
  activeIndex: number;
}) {
  const denom = Math.max(1, total - 1);
  const center = index / denom;
  const left = Math.max(0, center - 0.2);
  const right = Math.min(1, center + 0.2);
  const opacity = useTransform(progress, [left, center, right], [0.3, 1, 0.3]);
  const scale = useTransform(progress, [left, center, right], [0.98, 1.01, 0.98]);
  const Icon = station.icon;

  return (
    <motion.article
      style={{ opacity, scale }}
      className={`mx-auto max-w-xl rounded-xl border p-6 transition-colors ${
        activeIndex === index
          ? "border-cyan-400/55 bg-cyan-500/10 text-zinc-100 backdrop-blur-md"
          : "border-zinc-500/45 bg-zinc-900/55 text-zinc-100 backdrop-blur-md"
      }`}
    >
      <div className="inline-flex rounded-md border border-zinc-600/70 bg-zinc-900/50 p-2">
        <Icon className="size-4 text-cyan-300" />
      </div>
      <h3 className="mt-4 text-xl font-semibold tracking-tight text-zinc-100">{station.title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-300">{station.description}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-200">{station.detail}</p>
      <div className="mt-3 inline-flex items-center rounded-full border border-cyan-400/45 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
        <CheckCheckIcon className="mr-1.5 size-3.5" />
        {station.value}
      </div>
    </motion.article>
  );
}

function MacbookFrame({ activeIndex, progress }: { activeIndex: number; progress: MotionValue<number> }) {
  const frameScale = useTransform(progress, [0, 1], [0.96, 1.02]);
  const frameRotate = useTransform(progress, [0, 1], [-1.2, 1.2]);

  return (
    <motion.div style={{ scale: frameScale, rotateZ: frameRotate }} className="w-full max-w-[620px]">
      <div className="rounded-[22px] border border-zinc-500/40 bg-zinc-900 p-2 shadow-[0_32px_90px_-45px_rgba(14,165,233,0.45)]">
        <div className="rounded-[16px] border border-zinc-700 bg-zinc-950 p-3">
          <div className="mb-3 flex items-center gap-2 border-b border-zinc-700 pb-2">
            <span className="size-2 rounded-full bg-red-400/80" />
            <span className="size-2 rounded-full bg-amber-400/80" />
            <span className="size-2 rounded-full bg-emerald-400/80" />
            <span className="ml-2 text-[10px] text-zinc-400">Bio Dash Interactive Console</span>
          </div>

          <div className="relative min-h-[290px] overflow-hidden rounded-md border border-zinc-700 bg-zinc-900/80 p-3">
            {stations.map((station, index) => (
              <motion.div
                key={station.id}
                className="absolute inset-3"
                initial={false}
                animate={{
                  opacity: activeIndex === index ? 1 : 0,
                  scale: activeIndex === index ? 1 : 0.96,
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                {previewByStation(station.id)}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto mt-2 h-2.5 w-40 rounded-b-full bg-zinc-400/45 dark:bg-zinc-600/45" />
    </motion.div>
  );
}

export function StickyScrollStations() {
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    container: desktopScrollRef,
    offset: ["start start", "end end"],
  });
  const [activeIndex, setActiveIndex] = useState(0);

  const stationCount = stations.length;
  const maxIndex = Math.max(0, stationCount - 1);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = Math.min(maxIndex, Math.max(0, Math.round(value * maxIndex)));
    setActiveIndex((prev) => (prev === next ? prev : next));
  });

  return (
    <section className="space-y-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium tracking-[0.14em] text-cyan-200/85 uppercase">
          Elite Feature Walkthrough
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100 md:text-4xl">
          Protein, Ağ, Sepet ve Yayın Çıktısı Tek Akışta
        </h2>
        <p className="mt-3 text-sm text-zinc-300 md:text-base">
          Kaydırdıkça aktif istasyon değişir; soldaki mockup anlık olarak ilgili modülü önizler.
        </p>
      </div>

      <div className="relative hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
        <div className="sticky top-20 flex h-[calc(100vh-6rem)] items-center justify-center">
          <MacbookFrame activeIndex={activeIndex} progress={scrollYProgress} />
        </div>
        <div
          ref={desktopScrollRef}
          className="no-scrollbar max-h-[calc(100vh-6rem)] space-y-0 overflow-y-auto pr-2 snap-y snap-mandatory scroll-smooth"
        >
          {stations.map((station, idx) => (
            <div key={station.id} className="flex h-[82vh] items-center snap-center">
              <StationBlock
                station={station}
                index={idx}
                total={stations.length}
                progress={scrollYProgress}
                activeIndex={activeIndex}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:hidden">
        {stations.map((station) => {
          const Icon = station.icon;
          return (
            <Card
              key={station.id}
              className="border-zinc-700/70 bg-zinc-900/55 text-zinc-100 backdrop-blur-md"
            >
              <CardContent className="space-y-4 p-4">
                <div className="inline-flex rounded-md border border-zinc-600/70 bg-zinc-900/50 p-2">
                  <Icon className="size-4 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-tight text-zinc-100">{station.title}</h3>
                  <p className="mt-1 text-sm text-zinc-300">{station.description}</p>
                </div>
                <div className="rounded-md border bg-zinc-950/95 p-3 text-zinc-100">
                  {previewByStation(station.id)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-zinc-700/70 bg-zinc-900/55 text-zinc-100 backdrop-blur-md">
          <CardContent className="p-5">
            <div className="inline-flex rounded-md border border-zinc-600/70 bg-zinc-900/50 p-2">
              <Layers3Icon className="size-4 text-cyan-300" />
            </div>
            <h3 className="mt-3 text-base font-semibold tracking-tight text-zinc-100">Diğer Dashboardlardan Farkı</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Bio-Dash, sadece veri çizmez; protein yapısı, etkileşim ağı ve klinik karar desteğini tek bağlamda birleştirir.
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-700/70 bg-zinc-900/55 text-zinc-100 backdrop-blur-md">
          <CardContent className="p-5">
            <div className="inline-flex rounded-md border border-zinc-600/70 bg-zinc-900/50 p-2">
              <FlaskConicalIcon className="size-4 text-cyan-300" />
            </div>
            <h3 className="mt-3 text-base font-semibold tracking-tight text-zinc-100">Neden Avantaj Sağlar?</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Dağınık araç seti yerine tek panelde karar hızını artırır, ekip içi tutarlılığı yükseltir ve çıktıyı standardize eder.
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-700/70 bg-zinc-900/55 text-zinc-100 backdrop-blur-md">
          <CardContent className="p-5">
            <div className="inline-flex rounded-md border border-zinc-600/70 bg-zinc-900/50 p-2">
              <BookMarkedIcon className="size-4 text-cyan-300" />
            </div>
            <h3 className="mt-3 text-base font-semibold tracking-tight text-zinc-100">Ölçeklenebilir Operasyon</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Gene Basket, Notebook ve Code Export ile araştırma çıktısını yeniden üretilebilir akademik akışa taşır.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
