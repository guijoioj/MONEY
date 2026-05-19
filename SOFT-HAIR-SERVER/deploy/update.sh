#!/bin/bash
# ============================================================================
# update.sh — Auto-update do backend SoftHair no PC servidor.
#
# Roda via cron todo dia 4h da manhã. Verifica GitHub, atualiza se houver
# mudanças, roda migrations novas, reinicia o service.
#
# Logs em /var/log/softhair/update.log
# ============================================================================

set -e

INSTALL_DIR="/opt/softhair"
SERVER_DIR="$INSTALL_DIR/SOFT-HAIR-SERVER"
LOG_FILE="/var/log/softhair/update.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "═════════════════════════════════════"
log "Iniciando verificação de update"

cd "$SERVER_DIR"

# Verifica se há mudanças no remote
git fetch origin main 2>&1 | tee -a "$LOG_FILE"
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  log "✓ Sem updates (commit atual: $LOCAL)"
  exit 0
fi

log "📥 Update disponível: $LOCAL → $REMOTE"

# Pull
git pull origin main 2>&1 | tee -a "$LOG_FILE"

# Detectar se package.json mudou (precisa npm install)
if git diff "$LOCAL" "$REMOTE" --name-only -- "$SERVER_DIR" | grep -q "package.json"; then
  log "📦 package.json mudou — rodando npm install"
  npm install --omit=dev 2>&1 | tee -a "$LOG_FILE"
fi

# Detectar migrations novas
if git diff "$LOCAL" "$REMOTE" --name-only -- "$SERVER_DIR/src/migrations" | grep -q ".sql"; then
  log "🗄️ Migrations novas — aplicando"
  npm run db:migrate 2>&1 | tee -a "$LOG_FILE"
fi

# Restart service
log "🔄 Reiniciando softhair-backend"
sudo systemctl restart softhair-backend

# Health check
sleep 5
if curl -fs http://localhost:3001/api/health > /dev/null; then
  log "✅ Update completo. Servidor respondendo."
else
  log "❌ ALERTA: servidor não respondeu após update!"
  exit 1
fi
