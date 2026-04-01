#!/usr/bin/env bash
# Sunucuda yeni proje dizini oluşturur ve Git'ten Bio-Dash ön yüzünü klonlar.
#
# Kullanım (sunucuda, örn. SSH ile bağlandıktan sonra):
#   curl -fsSL https://raw.githubusercontent.com/Ovtnc/Bio-Dashboard/main/deploy/scripts/init-from-git.sh | bash
# veya repoyu bir kez elle klonladıktan sonra:
#   bash deploy/scripts/init-from-git.sh
#
# Ortam değişkenleri:
#   PROJECT_ROOT   Varsayılan: /opt/bio-dash-live
#   FRONTEND_REPO  Varsayılan: https://github.com/Ovtnc/Bio-Dashboard.git
#   FRONTEND_DIR   Varsayılan: bio-dash  (PROJECT_ROOT altında oluşur)
#   BACKEND_REPO   Opsiyonel: backend git URL'i (varsa PROJECT_ROOT/backend olarak klonlanır)

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-/opt/bio-dash-live}"
FRONTEND_REPO="${FRONTEND_REPO:-https://github.com/Ovtnc/Bio-Dashboard.git}"
FRONTEND_DIR="${FRONTEND_DIR:-bio-dash}"
BACKEND_REPO="${BACKEND_REPO:-}"

FRONTEND_PATH="${PROJECT_ROOT}/${FRONTEND_DIR}"

echo "==> Proje kökü: ${PROJECT_ROOT}"
if [[ ! -d "${PROJECT_ROOT}" ]]; then
  if ! mkdir -p "${PROJECT_ROOT}" 2>/dev/null; then
    echo "    Hata: dizin oluşturulamadı. Örnek:"
    echo "    sudo mkdir -p ${PROJECT_ROOT} && sudo chown -R \"\$(whoami):\$(whoami)\" ${PROJECT_ROOT}"
    exit 1
  fi
  echo "    Oluşturuldu."
else
  echo "    Zaten var."
fi

if [[ ! -d "${FRONTEND_PATH}/.git" ]]; then
  echo "==> Ön yüz klonlanıyor: ${FRONTEND_REPO} -> ${FRONTEND_PATH}"
  git clone "${FRONTEND_REPO}" "${FRONTEND_PATH}"
else
  echo "==> Ön yüz zaten klonlu; güncelleniyor: ${FRONTEND_PATH}"
  git -C "${FRONTEND_PATH}" pull --ff-only
fi

if [[ -n "${BACKEND_REPO}" ]]; then
  BACKEND_PATH="${PROJECT_ROOT}/backend"
  if [[ ! -d "${BACKEND_PATH}/.git" ]]; then
    echo "==> Backend klonlanıyor: ${BACKEND_REPO} -> ${BACKEND_PATH}"
    git clone "${BACKEND_REPO}" "${BACKEND_PATH}"
  else
    echo "==> Backend zaten klonlu; güncelleniyor: ${BACKEND_PATH}"
    git -C "${BACKEND_PATH}" pull --ff-only
  fi
else
  echo ""
  echo "!!! UYARI: BACKEND_REPO tanımlı değil."
  echo "    Docker Compose, ../backend bekliyor. Şunlardan birini yapın:"
  echo "    1) Tekrar çalıştırın: BACKEND_REPO='https://...' bash $0"
  echo "    2) Veya backend klasörünü ${PROJECT_ROOT}/backend konumuna kopyalayın/rsync ile atın."
  echo ""
fi

echo ""
echo "==> Sonraki adımlar:"
echo "    cd ${FRONTEND_PATH}"
echo "    cp deploy/env.production.example .env && nano .env"
echo "    docker compose -f docker-compose.yml -f deploy/compose.production.yml --env-file .env up -d --build"
echo ""
