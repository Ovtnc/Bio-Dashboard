# Üretim sunucusu: ore-oar.online (161.97.132.240)

Bu rehber, **Bio-Dash** ön yüzü + **backend** (FastAPI) + Postgres + Redis yığınını bir VPS üzerinde çalıştırmak içindir. Nginx, sunucuda (Docker dışında) 80/443 üzerinden reverse proxy yapar.

## 1. DNS

Alan adı sağlayıcınızda:

| Tür | Ad | Değer |
|-----|-----|--------|
| A | `@` | `161.97.132.240` |
| A | `www` | `161.97.132.240` |

Yayılması birkaç dakika ile 48 saat arasında sürebilir.

## 2. Sunucuda yeni proje + Git’ten yükleme

Örnek: tüm uygulama `/opt/bio-dash-live` altında dursun (istediğiniz yolu `PROJECT_ROOT` ile değiştirebilirsiniz).

### Seçenek A — Tek komut (GitHub’daki `main` dalında betik yüklüyse)

```bash
sudo mkdir -p /opt/bio-dash-live && sudo chown -R "$(whoami):$(whoami)" /opt/bio-dash-live
curl -fsSL https://raw.githubusercontent.com/Ovtnc/Bio-Dashboard/main/deploy/scripts/init-from-git.sh -o /tmp/init-from-git.sh
bash /tmp/init-from-git.sh
```

Backend’i de ayrı repodan çekmek için:

```bash
export BACKEND_REPO="https://github.com/KULLANICI/backend-repo.git"
bash /tmp/init-from-git.sh
```

### Seçenek B — Elle (aynı sonuç)

```bash
sudo mkdir -p /opt/bio-dash-live && sudo chown -R "$(whoami):$(whoami)" /opt/bio-dash-live
cd /opt/bio-dash-live
git clone https://github.com/Ovtnc/Bio-Dashboard.git bio-dash
# Backend yoksa: ../backend klasörüne kopyalayın veya ikinci bir git clone kullanın
cd bio-dash
```

Yerel repodan betiği çalıştırmak:

```bash
bash deploy/scripts/init-from-git.sh
```

`PROJECT_ROOT` varsayılanı `/opt/bio-dash-live`’dır; değiştirmek için:

```bash
export PROJECT_ROOT="$HOME/bio-proje"
export FRONTEND_DIR="bio-dash"
bash deploy/scripts/init-from-git.sh
```

## 3. Sunucu dizin yapısı

`docker-compose.yml` içinde backend imajı `../backend` klasöründen build edilir. Önerilen yapı:

```text
/opt/bio-dash-live/
  bio-dash/     # Bu repo (GitHub: Bio-Dashboard)
  backend/      # FastAPI backend (aynı üst dizinde yan yana)
```

Backend kodu repoda yoksa, geliştirme makinenizden `backend` klasörünü sunucuya kopyalayın veya ayrı bir git deposu kullanın (`BACKEND_REPO` ile betik veya ikinci `git clone`).

## 4. Sunucuda Docker

Hızlı kurulum (root):

```bash
curl -fsSL https://raw.githubusercontent.com/Ovtnc/Bio-Dashboard/main/deploy/scripts/install-docker-ubuntu.sh -o /tmp/install-docker-ubuntu.sh
sudo bash /tmp/install-docker-ubuntu.sh
```

Ayrıntı: [Docker Engine — Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Komut `docker compose` (V2 eklentisi) sağlar.

### Git / `git pull` hataları

- **Public repo** için `git pull origin main` genelde **kimlik istemez**. İstem çıkarsa Enter’a basıp çıkmayın; talimat metnini **kullanıcı adı** alanına yapıştırmayın (GitHub “Invalid username” verir).
- **Şifre ile push/pull** GitHub’da kapalıdır; özel repoda **PAT** veya **SSH anahtarı** kullanın.

## 5. Ortam dosyası

```bash
cd /opt/bio-dash-live/bio-dash
cp deploy/env.production.example .env
nano .env   # AUTH_SECRET, JWT_SECRET, POSTGRES_PASSWORD vb.
```

- `NEXT_PUBLIC_API_BASE_URL` ve `NEXTAUTH_URL` domain ile uyumlu olmalı (`https://ore-oar.online/...`).
- `FRONTEND_PORT` / `BACKEND_PORT` vb. için `docker-compose.yml` container portunu kendisi ekler. `.env` içinde **`127.0.0.1:3001`** yazın, **`127.0.0.1:3001:3000` yazmayın** (Compose “invalid IP address” verir).
- İlk kurulumda `docker-compose.yml` içindeki Postgres şifresi varsayılan `postgres` ise, `.env` içinde `POSTGRES_PASSWORD` değiştirirseniz **tüm `DATABASE_URL` tanımlarını** `docker-compose.yml` içinde elle aynı şifreyle güncellemeniz gerekir; aksi halde varsayılan `postgres` ile devam edin.

## 6. Konteynerleri ayağa kaldırma

```bash
cd /opt/bio-dash-live/bio-dash
docker compose -f docker-compose.yml -f deploy/compose.production.yml --env-file .env up -d --build
```

İlk build birkaç dakika sürebilir. Log: `docker compose logs -f frontend backend`.

## 7. Host Nginx + TLS

```bash
sudo apt update && sudo apt install -y nginx
sudo cp /opt/bio-dash-live/bio-dash/deploy/nginx-host/ore-oar.online.conf /etc/nginx/sites-available/ore-oar.online
sudo ln -sf /etc/nginx/sites-available/ore-oar.online /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Sertifika:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ore-oar.online -d www.ore-oar.online
```

Certbot, yapılandırmaya `listen 443` ve SSL satırlarını ekler. Sonrasında `NEXTAUTH_URL=https://ore-oar.online` ile çerezler güvenli modda çalışır.

## 8. Güvenlik duvarı (önerilir)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Postgres/Redis/uygulama portları yalnızca `127.0.0.1`’e bağlı olduğu için dışarıdan erişilmez.

## 9. Güncelleme

```bash
cd /opt/bio-dash-live/bio-dash
git pull
docker compose -f docker-compose.yml -f deploy/compose.production.yml --env-file .env up -d --build
```

---

**Not:** Bu depo ([Bio-Dashboard](https://github.com/Ovtnc/Bio-Dashboard)) yalnızca Next.js uygulamasını içerir; canlı ortam için `backend` servisinin aynı sunucuda build edilebilir olması gerekir.
