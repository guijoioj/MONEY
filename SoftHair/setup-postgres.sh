#!/usr/bin/env bash
set -euo pipefail

SOFTHAIR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_USER="softhair"
DB_PASS="softhair2026"
DB_NAME="softhair"
DB_PORT="5432"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   SoftHair — Setup PostgreSQL completo   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

echo "[1/6] Instalando PostgreSQL..."
pacman -S --noconfirm postgresql

echo "[2/6] Inicializando cluster do banco..."
if [ ! -f /var/lib/postgres/data/PG_VERSION ]; then
    sudo -u postgres initdb --locale=pt_BR.UTF-8 --encoding=UTF8 -D /var/lib/postgres/data
    echo "      Cluster inicializado."
else
    echo "      Cluster ja existia, pulando initdb."
fi

echo "[3/6] Iniciando servico PostgreSQL..."
systemctl enable --now postgresql
sleep 2
if ! systemctl is-active --quiet postgresql; then
    echo "ERRO: PostgreSQL nao iniciou. Verifique: journalctl -u postgresql"
    exit 1
fi
echo "      PostgreSQL rodando."

echo "[4/6] Criando usuario e banco de dados..."
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || \
    sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || \
    echo "      Banco '${DB_NAME}' ja existe."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
echo "      Usuario '${DB_USER}' e banco '${DB_NAME}' prontos."

echo "[5/6] Criando backend/.env..."
JWT_KEY="softhair-$(openssl rand -hex 24)"
cat > "${SOFTHAIR_DIR}/backend/.env" << EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}
DATABASE_SSL=false

JWT_SECRET=${JWT_KEY}
JWT_EXPIRES_IN=7d

SOFTHAIR_DEFAULT_ADMIN_EMAIL=admin@salao.com
SOFTHAIR_DEFAULT_ADMIN_PASSWORD=TROQUE_NA_PRIMEIRA_LOGIN
SOFTHAIR_DEFAULT_ADMIN_NAME=Administrador

PORT=3001
EOF
echo "      backend/.env criado."

echo "[6/6] Testando conexao com o banco..."
if PGPASSWORD="${DB_PASS}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "      Conexao OK!"
else
    echo "ERRO: Nao foi possivel conectar. Verifique as configuracoes."
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║              SETUP COMPLETO!             ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Banco:    ${DB_NAME}"
echo "  Usuario:  ${DB_USER}"
echo "  Porta:    ${DB_PORT}"
echo ""
echo "  Inicie o sistema com:"
echo "    cd ${SOFTHAIR_DIR}"
echo "    npm start              (App Electron)"
echo "    ./iniciar-sistema.sh   (Navegador)"
echo ""
