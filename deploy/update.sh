#!/usr/bin/env bash
# Pulls the newest published image and restarts the app only if it changed.
set -euo pipefail
cd "$(dirname "$0")"
docker compose pull --quiet app
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
