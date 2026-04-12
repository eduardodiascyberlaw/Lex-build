#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# Lex Build — First deploy on VDS Contabo (77.237.233.117)
# Run as root on the server after cloning the repo.
# ──────────────────────────────────────────────────────────
set -euo pipefail

DEPLOY_DIR="/opt/lexbuild"
PG_USER="lexbuild"
PG_DB="lexbuild"

echo "=== 1. Create PostgreSQL database and user ==="
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${PG_USER} WITH PASSWORD '$(read -rsp 'PG password for lexbuild: ' pw && echo "$pw")';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};"
echo "PostgreSQL ready."

echo ""
echo "=== 2. Generate secrets ==="
if [ ! -f "${DEPLOY_DIR}/.env.production" ]; then
  cp "${DEPLOY_DIR}/.env.production.example" "${DEPLOY_DIR}/.env.production"
  NEXTAUTH_SECRET=$(openssl rand -base64 32)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  MINIO_PW=$(openssl rand -base64 16 | tr -d '=/+')

  sed -i "s|GENERATE_WITH_openssl_rand_base64_32|${NEXTAUTH_SECRET}|g" "${DEPLOY_DIR}/.env.production"
  sed -i "s|GENERATE_WITH_openssl_rand_hex_32|${ENCRYPTION_KEY}|g" "${DEPLOY_DIR}/.env.production"
  sed -i "s|CHANGE_ME_MINIO_PASSWORD|${MINIO_PW}|g" "${DEPLOY_DIR}/.env.production"
  echo "Secrets generated. Edit .env.production to set the PG password."
else
  echo ".env.production already exists — skipping."
fi

echo ""
echo "=== 3. Build and start containers ==="
cd "${DEPLOY_DIR}"
docker compose build --no-cache
docker compose up -d

echo ""
echo "=== 4. Run Prisma migrations ==="
docker compose exec lexbuild npx prisma migrate deploy

echo ""
echo "=== 5. Seed database ==="
docker compose exec lexbuild npx prisma db seed

echo ""
echo "=== 6. Create MinIO bucket ==="
docker compose exec minio mc alias set local http://localhost:9000 minioadmin "${MINIO_PW}"
docker compose exec minio mc mb local/lexbuild --ignore-existing

echo ""
echo "=== 7. Add Caddy entry ==="
cat <<'CADDY'

Add this block to /etc/caddy/Caddyfile:

lexbuild.advocaciadeguerrilha.com {
    reverse_proxy localhost:3002
}

Then reload: systemctl reload caddy

CADDY

echo ""
echo "=== Done! ==="
echo "App:   https://lexbuild.advocaciadeguerrilha.com"
echo "MinIO: http://localhost:9001 (admin console, local only)"
