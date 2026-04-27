#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
XDG_CONF_DIR="${XDG_CONFIG_HOME:-$HOME/.config}"
SOFTHAIR_ROOT_DIR="${SOFTHAIR_ROOT_DIR:-$XDG_CONF_DIR/softHair/SoftHair}"
JWT_SECRET="${SOFTHAIR_JWT_SECRET:-${JWT_SECRET:-softHair-dev-jwt-secret-change-me}}"
JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-7d}"

export SOFTHAIR_ROOT_DIR
export JWT_SECRET
export JWT_EXPIRES_IN
export SOFTHAIR_DEFAULT_ADMIN_EMAIL="${SOFTHAIR_DEFAULT_ADMIN_EMAIL:-admin@salao.com}"
export SOFTHAIR_DEFAULT_ADMIN_PASSWORD="${SOFTHAIR_DEFAULT_ADMIN_PASSWORD:-admin123}"

cd "$SCRIPT_DIR"
mkdir -p "$SOFTHAIR_ROOT_DIR/data"

echo "========================================"
echo " SOFTHAIR - Sistema de Gestao de Salao"
echo "========================================"

if ! command -v node >/dev/null 2>&1; then
  echo "ERRO: Node.js NAO ESTA INSTALADO"
  echo "Instale o Node.js antes de continuar"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERRO: npm NAO ESTA DISPONIVEL"
  exit 1
fi

echo "[1/4] Verificando dependencias do backend..."
cd "$SCRIPT_DIR/backend"
if [ ! -d "node_modules" ]; then
  npm install >"$SCRIPT_DIR/backend-install.log" 2>&1
fi

SOFTHAIR_ROOT_DIR="$SOFTHAIR_ROOT_DIR" JWT_SECRET="$JWT_SECRET" JWT_EXPIRES_IN="$JWT_EXPIRES_IN" node src/scripts/createAdmin.js

echo "[2/4] Iniciando backend (porta 3001)..."
npm run dev >"$SCRIPT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

sleep 3

echo "[3/4] Iniciando frontend (porta 3000)..."
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
  npm install >"$SCRIPT_DIR/frontend-install.log" 2>&1
fi
npm run dev >"$SCRIPT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

cleanup() {
  echo "\nEncerrando processos..."
  if ps -p "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
  if ps -p "$FRONTEND_PID" >/dev/null 2>&1; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup INT TERM EXIT

echo "[4/4] Sistema iniciado!"
echo "Acesse no navegador: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo "Logs do backend: $SCRIPT_DIR/backend.log"
echo "Logs do frontend: $SCRIPT_DIR/frontend.log"
echo "Pressione Ctrl+C para encerrar"

wait "$BACKEND_PID" "$FRONTEND_PID"
