#!/usr/bin/env bash
# Sunucuda Bio-Dash + backend + Postgres + Redis tek komutla kurar.
# .env dosyasını siler, yeniler (rastgele secret), docker compose up --build çalıştırır.
#
# Gereksinim: root (veya sudo). Ubuntu 24.04 test edildi.
#
# Kullanım:
#   curl -fsSL https://raw.githubusercontent.com/Ovtnc/Bio-Dashboard/main/deploy/scripts/bootstrap-full-stack.sh | sudo bash -s
#
# Backend ayrı repodaysa:
#   sudo BACKEND_REPO="https://github.com/you/backend.git" bash bootstrap-full-stack.sh
#
# Tam temizlik (veritabanı volume dahil silinir, bio-dash ve backend yeniden klonlanır):
#   sudo bash bootstrap-full-stack.sh --factory-reset
#
# Sadece .env + yeniden build (kod ve volume kalır):
#   sudo bash bootstrap-full-stack.sh
#
set -euo pipefail

FACTORY_RESET=0
for arg in "$@"; do
  case "$arg" in
    --factory-reset) FACTORY_RESET=1 ;;
    --help|-h)
      echo "Kullanım: sudo $0 [--factory-reset]"
      echo "  --factory-reset  bio-dash + backend klasörlerini ve Docker volume'larını siler, yeniden klonlar."
      exit 0
      ;;
  esac
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "root ile çalıştırın: sudo bash $0"
  exit 1
fi

# Silinen dizinde kalmayı önle (factory-reset sonrası "Unable to read current working directory")
cd /

DOMAIN="${DOMAIN:-ore-oar.online}"
PROJECT_ROOT="${PROJECT_ROOT:-/opt/bio-dash-live}"
FRONTEND_DIR="${FRONTEND_DIR:-bio-dash}"
FRONTEND_REPO="${FRONTEND_REPO:-https://github.com/Ovtnc/Bio-Dashboard.git}"
BACKEND_REPO="${BACKEND_REPO:-}"

if [[ -n "${BACKEND_REPO}" ]] && [[ "${BACKEND_REPO}" =~ (SENIN|KULLANICI|your-backend|YOUR_|example\.com) ]]; then
  echo "HATA: BACKEND_REPO örnek bir adres gibi duruyor: ${BACKEND_REPO}"
  echo "Gerçek repo URL'si yazın veya BACKEND_REPO boş bırakıp önce scp ile backend atın."
  exit 1
fi

FRONTEND_PATH="${PROJECT_ROOT}/${FRONTEND_DIR}"
BACKEND_PATH="${PROJECT_ROOT}/backend"

have_cmd() { command -v "$1" >/dev/null 2>&1; }

install_docker_if_needed() {
  if have_cmd docker && docker compose version >/dev/null 2>&1; then
    return 0
  fi
  echo "==> Docker yok; kuruluyor..."
  local tmp
  tmp="$(mktemp)"
  curl -fsSL https://raw.githubusercontent.com/Ovtnc/Bio-Dashboard/main/deploy/scripts/install-docker-ubuntu.sh -o "$tmp"
  bash "$tmp"
  rm -f "$tmp"
}

compose_down_safe() {
  if [[ -f "${FRONTEND_PATH}/docker-compose.yml" ]]; then
    echo "==> Mevcut stack durduruluyor..."
    (cd "$FRONTEND_PATH" && docker compose -f docker-compose.yml -f deploy/compose.production.yml --env-file .env down 2>/dev/null) || true
    (cd "$FRONTEND_PATH" && docker compose -f docker-compose.yml --env-file .env down 2>/dev/null) || true
    (cd "$FRONTEND_PATH" && docker compose down 2>/dev/null) || true
  fi
}

if [[ "$FACTORY_RESET" -eq 1 ]]; then
  compose_down_safe
  echo "==> Factory reset: volume'lar ve proje klasörleri siliniyor..."
  cd /
  docker volume rm bio-dash_bio_dash_pg_data bio-dash_bio_dash_redis_data bio-dash_bio_dash_final_data 2>/dev/null || true
  rm -rf "${FRONTEND_PATH}" "${BACKEND_PATH}"
fi

mkdir -p "${PROJECT_ROOT}"
install_docker_if_needed

if [[ ! -d "${FRONTEND_PATH}/.git" ]]; then
  echo "==> Ön yüz klonlanıyor..."
  GIT_TERMINAL_PROMPT=0 git clone "${FRONTEND_REPO}" "${FRONTEND_PATH}"
else
  echo "==> Ön yüz güncelleniyor..."
  git -C "${FRONTEND_PATH}" pull --ff-only origin main || git -C "${FRONTEND_PATH}" pull --ff-only
fi

if [[ ! -d "${BACKEND_PATH}/.git" ]] && [[ ! -f "${BACKEND_PATH}/Dockerfile" ]]; then
  if [[ -n "${BACKEND_REPO}" ]]; then
    echo "==> Backend klonlanıyor..."
    GIT_TERMINAL_PROMPT=0 git clone "${BACKEND_REPO}" "${BACKEND_PATH}"
  else
    echo ""
    echo "HATA: ${BACKEND_PATH} yok ve BACKEND_REPO tanımlı değil."
    echo "Örnek:"
    echo "  sudo BACKEND_REPO='https://github.com/KULLANICI/backend.git' bash $0"
    echo "veya önce:"
    echo "  scp -r ./backend root@SUNUCU:${BACKEND_PATH}"
    exit 1
  fi
fi

if [[ ! -f "${BACKEND_PATH}/Dockerfile" ]]; then
  echo "HATA: ${BACKEND_PATH}/Dockerfile bulunamadı."
  exit 1
fi

compose_down_safe

echo "==> Eski .env kaldırılıyor..."
rm -f "${FRONTEND_PATH}/.env"

AUTH_SECRET="$(openssl rand -hex 32)"
JWT_SECRET="$(openssl rand -hex 32)"
POSTGRES_PASSWORD="$(openssl rand -hex 16)"

SCHEME="https"
if [[ "${USE_HTTP:-0}" == "1" ]]; then
  SCHEME="http"
fi

CORS_ORIGINS="${SCHEME}://${DOMAIN},${SCHEME}://www.${DOMAIN}"

echo "==> .env oluşturuluyor (DOMAIN=${DOMAIN})..."
cat > "${FRONTEND_PATH}/.env" <<EOF
NEXT_PUBLIC_API_BASE_URL=${SCHEME}://${DOMAIN}/backend
NEXTAUTH_URL=${SCHEME}://${DOMAIN}
CORS_ALLOW_ORIGINS=${CORS_ORIGINS}
AUTH_SECRET=${AUTH_SECRET}
JWT_SECRET=${JWT_SECRET}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
FRONTEND_PORT=127.0.0.1:3001
BACKEND_PORT=127.0.0.1:8000
POSTGRES_PORT=127.0.0.1:5433
REDIS_PORT=127.0.0.1:6379
INTERNAL_BACKEND_URL=http://backend:8000
EOF
chmod 600 "${FRONTEND_PATH}/.env"

echo "==> Docker imajları build + stack başlatılıyor (uzun sürebilir)..."
cd "${FRONTEND_PATH}"
docker compose -f docker-compose.yml -f deploy/compose.production.yml --env-file .env up -d --build

echo ""
echo "-------------------------------------------------------------------"
echo "Kurulum tamam."
echo "  Yerel test:  curl -sI http://127.0.0.1:3001 | head -3"
echo "  API:         curl -sI http://127.0.0.1:8000/health | head -3"
echo ""
echo "Dışarıdan domain ile kullanmak için host Nginx + TLS:"
echo "  apt install -y nginx"
echo "  cp ${FRONTEND_PATH}/deploy/nginx-host/ore-oar.online.conf /etc/nginx/sites-available/ore-oar.online"
echo "  sed -i 's/ore-oar.online/${DOMAIN}/g' /etc/nginx/sites-available/ore-oar.online"
echo "  ln -sf /etc/nginx/sites-available/ore-oar.online /etc/nginx/sites-enabled/"
echo "  nginx -t && systemctl reload nginx"
echo "  apt install -y certbot python3-certbot-nginx"
echo "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo ""
echo "USE_HTTP=1 ile çalıştırdıysanız .env http kullanır; üretimde HTTPS önerilir."
echo "-------------------------------------------------------------------"
