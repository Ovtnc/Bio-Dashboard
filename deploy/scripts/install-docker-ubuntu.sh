#!/usr/bin/env bash
# Ubuntu 24.04 (ve yakın sürümler) için Docker Engine + Compose eklentisi.
# Çalıştırma: sudo bash install-docker-ubuntu.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "root ile çalıştırın: sudo bash $0"
  exit 1
fi

apt-get update -y
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME:-noble} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

docker --version
docker compose version
echo "Kurulum bitti. Örnek: docker run --rm hello-world"
