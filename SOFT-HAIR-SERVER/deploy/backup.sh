#!/bin/bash
# ============================================================================
# backup.sh — Backup diário do banco PostgreSQL.
#
# Roda via cron todo dia 3h da manhã. Salva últimos 30 dias localmente.
# Opcionalmente faz upload pra Render/S3/GoogleDrive.
#
# Logs em /var/log/softhair/backup.log
# ============================================================================

set -e

BACKUP_DIR="/opt/softhair/backups"
LOG_FILE="/var/log/softhair/backup.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

mkdir -p "$BACKUP_DIR"

# Carrega DATABASE_URL do .env
set -a
source /opt/softhair/SOFT-HAIR-SERVER/.env
set +a

# Extrair credenciais do DATABASE_URL=postgresql://user:pass@host:port/db
PROTO_DROPPED="${DATABASE_URL#postgresql://}"
USER_PASS="${PROTO_DROPPED%@*}"
HOST_DB="${PROTO_DROPPED#*@}"
PGUSER="${USER_PASS%:*}"
PGPASSWORD="${USER_PASS#*:}"
HOST_PORT_DB="${HOST_DB%/*}"
PGDATABASE="${HOST_DB#*/}"
PGHOST="${HOST_PORT_DB%:*}"
PGPORT="${HOST_PORT_DB#*:}"
[ "$PGPORT" = "$PGHOST" ] && PGPORT=5432

export PGPASSWORD

log "═════════════════════════════════════"
log "Iniciando backup $TIMESTAMP"

BACKUP_FILE="$BACKUP_DIR/softhair_$TIMESTAMP.sql.gz"

pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  --no-owner --no-acl --clean --if-exists \
  | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "✓ Backup criado: $BACKUP_FILE ($SIZE)"

# Limpa backups antigos
DELETED=$(find "$BACKUP_DIR" -name "softhair_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
[ "$DELETED" -gt 0 ] && log "🗑️ Removidos $DELETED backups com mais de $RETENTION_DAYS dias"

# TODO: upload pra cloud (rclone, gcloud, aws, etc)
# rclone copy "$BACKUP_FILE" remote:softhair-backups

log "✅ Backup completo"
