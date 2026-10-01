#!/usr/bin/env bash
# One-time server setup for SparkForge Kids on a fresh Ubuntu 22.04/24.04 VM
# (Oracle Cloud Always Free, Google Cloud e2-micro, or any other host).
#
#   scp -r deploy ubuntu@<server-ip>:      # from your computer
#   ssh ubuntu@<server-ip>
#   GHCR_USER=<github-user> GHCR_TOKEN=<token with read:packages> bash deploy/setup.sh your.domain.com
#
# GHCR_USER/GHCR_TOKEN are only needed while the container image is private.
# Safe to run again: it keeps existing settings and data.
set -euo pipefail

DOMAIN="${1:-}"
SRC="$(cd "$(dirname "$0")" && pwd)"
DIR="$HOME/sparkforge"

if [ -z "$DOMAIN" ]; then
  echo "Usage: setup.sh <domain>   (a DNS name pointing at this server, e.g. sparkforge.duckdns.org)" >&2
  exit 1
fi

echo "==> Installing Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"
DOCKER="sudo docker"

echo "==> Opening ports 80 and 443 in the VM firewall"
# Oracle's Ubuntu images ship iptables rules that reject everything except SSH.
if sudo iptables -L INPUT -n 2>/dev/null | grep -q "REJECT"; then
  for port in 80 443; do
    sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
  done
  sudo iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p udp --dport 443 -j ACCEPT
  if command -v netfilter-persistent >/dev/null; then sudo netfilter-persistent save; fi
fi

echo "==> Installing the app stack into $DIR"
mkdir -p "$DIR/data"
cd "$DIR"
for f in docker-compose.yml Caddyfile update.sh; do cp "$SRC/$f" "$f"; done
chmod +x update.sh
sudo chown 1000:1000 data   # the app runs as the image's "node" user

if [ ! -f .env ]; then
  echo "==> Writing settings to $DIR/.env"
  cat > .env <<ENV
DOMAIN=$DOMAIN
# Live AI. Leave empty to run in free "practice mode".
ANTHROPIC_API_KEY=
SPARKFORGE_AI=auto
SPARKFORGE_SECRET=$(openssl rand -hex 32)
# Optional: email to parent-approved contacts
# SMTP_URL=smtps://user:pass@smtp.example.com
# SMTP_FROM=SparkForge Kids <hello@example.com>
ENV
  chmod 600 .env
else
  sed -i "s/^DOMAIN=.*/DOMAIN=$DOMAIN/" .env
fi

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "==> Logging in to GitHub Container Registry"
  echo "$GHCR_TOKEN" | $DOCKER login ghcr.io -u "${GHCR_USER:?set GHCR_USER too}" --password-stdin
fi

echo "==> Starting SparkForge"
$DOCKER compose pull
$DOCKER compose up -d

echo "==> Checking for new versions every 5 minutes"
( sudo crontab -l 2>/dev/null | grep -v sparkforge/update.sh || true; echo "*/5 * * * * $DIR/update.sh >> $DIR/update.log 2>&1" ) | sudo crontab -

echo
echo "Done. Open https://$DOMAIN in a minute or two (the HTTPS certificate is issued on first visit)."
echo "Settings: $DIR/.env  (after editing: cd $DIR && sudo docker compose up -d)"
