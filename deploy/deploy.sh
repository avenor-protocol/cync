#!/bin/sh
# Builds and starts the site on this server. Safe to run again for every update.
# Needs .env.production next to docker-compose.yml. Run as root on a fresh Debian/Ubuntu server.
set -eu
cd "$(dirname "$0")/.."

fail() { echo "error: $*" >&2; exit 1; }
env=.env.production
[ -f "$env" ] || fail "missing $env (copy .env.example and fill it in)"
get() { sed -n "s/^$1=//p" "$env" | tail -n 1 | tr -d "\r\"'"; }

domain=$(get DOMAIN)
site=$(get NEXT_PUBLIC_SITE_URL)
[ -n "$domain" ] || fail "DOMAIN is empty in $env"
[ "${site%/}" = "https://$domain" ] || fail "NEXT_PUBLIC_SITE_URL must be https://$domain (link previews use it)"

if ! command -v docker >/dev/null 2>&1; then
  [ "$(id -u)" = 0 ] || fail "docker is not installed; run this as root to install it"
  echo "installing docker..."
  curl -fsSL https://get.docker.com | sh
fi

# next build needs about 2 GB; small servers get a swap file so it does not run out of memory
mem_kb=$(sed -n 's/^MemTotal: *\([0-9]*\).*/\1/p' /proc/meminfo)
if [ "$mem_kb" -lt 2000000 ] && [ -z "$(swapon --noheadings 2>/dev/null)" ] && [ "$(id -u)" = 0 ]; then
  echo "adding a 2 GB swap file..."
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null

echo
echo "done: https://$domain"
echo "the DNS A record of $domain must point to this server, or Caddy cannot get the certificate (it keeps retrying)"
