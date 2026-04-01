# Bio-Dash

**Bio-Dash**, omik ve klinik biyoenformatik akışlarını tek bir web arayüzünde toplayan **klinik karar destek odaklı** bir panodur. Diferansiyel ekspresyon, kalite kontrol (QC), genom tarayıcısı, zenginleştirme analizleri ve PDF/Excel raporlarıyla çalışmayı hedefler.

> Bu depo **Next.js ön yüzünü** içerir. Tam işlevsellik için aynı makinede **FastAPI tabanlı backend** (`../backend`), **PostgreSQL** ve **Redis** gerekir. Üretim kurulumu için bkz. [`deploy/README.md`](deploy/README.md).

---

## Özellikler

| Alan | Açıklama |
|------|----------|
| **Kimlik & oturum** | NextAuth (credentials + isteğe bağlı Google), rol tabanlı erişim |
| **Dashboard** | Analiz özeti, çoklu analiz karşılaştırması (Upset, heatmap) |
| **Dosyalar** | Analiz dosyaları yükleme ve yönetim |
| **QC** | FASTQ / QC metrikleri ve analiz bazlı QC görünümü |
| **Diferansiyel ekspresyon** | Volcano plot, gen tabloları, sepet (gene basket) |
| **Genom tarayıcısı** | IGV.js ile iz görüntüleme |
| **Klinik raporlar** | Analiz başına rapor: 3D DNA/protein görünümleri, anlamlı varyantlar, tedavi önerileri, Kaplan–Meier, pathway, **Klinik PDF** ve Excel dışa aktarım |
| **Fonksiyonel zenginleştirme** | GO kategorileri, etkileşim ağı grafikleri |
| **Lab not defteri** | Markdown notlar (analiz bazlı taslak) |
| **Gerçek zamanlı** | Analiz durumu için WebSocket bildirimleri |

Rapor ve grafiklerde Plotly, 3D görünümlerde Three.js / NGL kullanılır.

---

## Teknoloji yığını

- **Ön yüz:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Prisma (PostgreSQL şeması ve migrasyonlar)
- **Görselleştirme:** Plotly, Recharts, IGV.js, Cytoscape tabanlı ağlar
- **Arka uç (ayrı repo / `../backend`):** FastAPI, Celery, Redis kuyruğu (Docker Compose ile orkestre edilir)

---

## Ön koşullar

- Node.js **20+**
- `npm` veya uyumlu paket yöneticisi
- Yerel tam stack için: **Docker** + **Docker Compose**, yanında **`backend`** klasörü (`docker-compose.yml` içinde `context: ../backend`)

---

## Yerel geliştirme (yalnızca ön yüz)

```bash
cd bio-dash
cp .env.example .env   # yoksa .env dosyanızı oluşturun (DATABASE_URL, AUTH_SECRET, JWT_SECRET, NEXT_PUBLIC_API_BASE_URL)
npm ci
npx prisma generate
npm run dev
```

Uygulama varsayılan olarak [http://localhost:3000](http://localhost:3000) adresinde açılır. Backend’e proxy ve oturum için `.env` içindeki `NEXT_PUBLIC_API_BASE_URL` ve NextAuth değişkenlerinin çalışan bir API ile uyumlu olması gerekir.

### Derleme

```bash
npm run build
npm run start
```

### Lint

```bash
npm run lint
```

---

## Docker ile tam yığın

Ön yüz klasörü ile **aynı üst dizinde** `backend` bulunmalıdır:

```text
bioinfo/
  bio-dash/     ← bu repo
  backend/      ← FastAPI servisi (Dockerfile içerir)
```

```bash
cd bio-dash
cp deploy/env.production.example .env
# .env içinde AUTH_SECRET, JWT_SECRET ve gerekirse domain/portları düzenleyin

docker compose up -d --build
```

Üretim domain’i, TLS ve otomatik `.env` için: **[`deploy/README.md`](deploy/README.md)** ve `deploy/scripts/bootstrap-full-stack.sh`.

---

## Proje yapısı (özet)

```text
src/app/           App Router sayfaları (landing, login, dashboard, qc, reports, …)
src/components/    UI, rapor grafikleri, genome browser, layout
src/lib/           API şemaları, fetch yardımcıları, zenginleştirme mantığı
prisma/            Veritabanı şeması ve migrasyonlar
deploy/            Nginx örnekleri, üretim compose override, kurulum betikleri
```

---

## Örnek veri

Depoda küçük boyutlu **`qc-test.fastq`** örnek dosyası bulunabilir; QC / yükleme akışlarını denemek için kullanılabilir.

---

## Yasal uyarı

Bu yazılım **araştırma ve klinik karar desteği** amaçlıdır. Tıbbi tanı veya tedavi kararı **yalnızca yetkili sağlık profesyonellerinin** sorumluluğundadır. Rapor çıktıları mutlaka uzman doğrulamasına tabidir.

---

## Lisans

Özel proje (`private`). Dağıtım ve kullanım koşulları proje sahibine aittir.

---

## Bağlantılar

- **Üretim dağıtım rehberi:** [`deploy/README.md`](deploy/README.md)
- **Next.js dokümantasyonu:** [nextjs.org/docs](https://nextjs.org/docs)
