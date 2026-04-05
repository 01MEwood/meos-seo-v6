#!/bin/bash
# ============================================================
# MEOS:SEO v6.0 — Build & Push to Docker Hub
# Deployment-Law: Nie direkt auf VPS pushen!
# ============================================================

set -e

VERSION=${1:-latest}
REGISTRY="memario"

echo "=============================="
echo "MEOS:SEO v6.0 — Build & Push"
echo "Version: ${VERSION}"
echo "=============================="

# 1. Backend bauen
echo ""
echo "→ Backend bauen..."
cd backend
docker build -t ${REGISTRY}/meos-seo-v6-backend:${VERSION} .
docker tag ${REGISTRY}/meos-seo-v6-backend:${VERSION} ${REGISTRY}/meos-seo-v6-backend:latest
echo "✓ Backend Image gebaut"

# 2. Frontend bauen
echo ""
echo "→ Frontend bauen..."
cd ../frontend
docker build -t ${REGISTRY}/meos-seo-v6-frontend:${VERSION} .
docker tag ${REGISTRY}/meos-seo-v6-frontend:${VERSION} ${REGISTRY}/meos-seo-v6-frontend:latest
echo "✓ Frontend Image gebaut"

# 3. Push zu Docker Hub
echo ""
echo "→ Push zu Docker Hub..."
docker push ${REGISTRY}/meos-seo-v6-backend:${VERSION}
docker push ${REGISTRY}/meos-seo-v6-backend:latest
docker push ${REGISTRY}/meos-seo-v6-frontend:${VERSION}
docker push ${REGISTRY}/meos-seo-v6-frontend:latest
echo "✓ Alle Images gepusht"

# 4. Anweisungen für VPS
echo ""
echo "=============================="
echo "NÄCHSTE SCHRITTE AUF DEM VPS:"
echo "=============================="
echo ""
echo "1. Hostinger Docker Manager öffnen"
echo "2. Alte Container löschen (meos-seo-v6-backend, -frontend)"
echo "3. docker-compose.prod.yml als YAML in Docker Manager einfügen"
echo "4. Environment-Variablen setzen"
echo "5. Deploy klicken"
echo ""
echo "Danach:"
echo "  docker exec <backend-container> npx prisma db push"
echo "  docker exec <backend-container> node prisma/seed.js"
echo ""
echo "Nginx Proxy Manager:"
echo "  seo.meosapp.de → frontend:3000"
echo "  seo-api.meosapp.de → backend:4000"
echo ""
echo "=============================="
echo "BUILD COMPLETE v${VERSION}"
echo "=============================="
