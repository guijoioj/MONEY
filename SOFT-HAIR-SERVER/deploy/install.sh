#!/bin/bash
# ============================================================================
# install.sh — Setup inicial do PC servidor (cérebro) do SoftHair.
#
# Roda UMA VEZ, no PC dedicado do salão (Ubuntu 24.04 LTS recomendado).
# Após instalar: roda como serviço systemd, atualiza sozinho via cron.
#
# Uso:
#   sudo bash install.sh
# ============================================================================

set -e

REPO_URL="https://github.com/guijoioj/MONEY.git"
INSTALL_DIR="/opt/softhair"
SERVER_DIR="$INSTALL_DIR/SOFT-HAIR-SERVER"
SERVICE_USER="softhair"
DB_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
HMAC_SECRET=$(openssl rand -hex 32)
BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)

echo ""
echo "🚀 SoftHair Server — instalação"
echo "================================"
echo ""

# 1. Verificar root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Rode como root: sudo bash install.sh"
  exit 1
fi

# 2. Pacotes do sistema
echo "📦 Instalando dependências do sistema..."
apt update
apt install -y curl git build-essential

# 3. Node.js 20 LTS
if ! command -v node &> /dev/null || ! node -v | grep -q "v20"; then
  echo "📦 Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "✓ Node $(node -v)"

# 4. PostgreSQL
if ! command -v psql &> /dev/null; then
  echo "📦 Instalando PostgreSQL..."
  apt install -y postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
fi
echo "✓ PostgreSQL"

# 5. Usuário do sistema
if ! id "$SERVICE_USER" &>/dev/null; then
  useradd -r -s /bin/bash -m -d "/home/$SERVICE_USER" "$SERVICE_USER"
fi

# 6. Database
echo "🗄️ Configurando banco de dados..."
sudo -u postgres psql <<EOF
DROP DATABASE IF EXISTS softhair;
DROP USER IF EXISTS softhair;
CREATE USER softhair WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE softhair OWNER softhair;
GRANT ALL PRIVILEGES ON DATABASE softhair TO softhair;
EOF

# 7. Clonar repo
echo "📥 Clonando repositório..."
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  ↳ Repo já existe, fazendo git pull"
  cd "$INSTALL_DIR" && git pull
else
  rm -rf "$INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# 8. npm install
echo "📦 Instalando dependências do backend..."
cd "$SERVER_DIR"
sudo -u "$SERVICE_USER" npm install --omit=dev

# 9. .env
echo "🔐 Gerando .env com secrets..."
cat > "$SERVER_DIR/.env" <<EOF
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
DATABASE_URL=postgresql://softhair:$DB_PASSWORD@localhost:5432/softhair
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=30d
ENCRYPTION_KEY=$ENCRYPTION_KEY
HMAC_SECRET=$HMAC_SECRET
BACKUP_ENCRYPTION_KEY=$BACKUP_ENCRYPTION_KEY
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,app://softhair.com,http://192.168.1.0/24
SOFTHAIR_DEFAULT_ADMIN_EMAIL=admin@salao.com
SOFTHAIR_DEFAULT_ADMIN_PASSWORD=TROQUE_NA_PRIMEIRA_LOGIN
AUTO_COMISSAO=true
EOF
chmod 600 "$SERVER_DIR/.env"
chown "$SERVICE_USER:$SERVICE_USER" "$SERVER_DIR/.env"

# 10. Init DB + migrations
echo "📊 Inicializando schema..."
cd "$SERVER_DIR"
sudo -u "$SERVICE_USER" npm run db:init || true
sudo -u "$SERVICE_USER" npm run db:migrate

# 11. systemd service
echo "🔧 Configurando systemd service..."
cp "$SERVER_DIR/deploy/softhair-backend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable softhair-backend
systemctl restart softhair-backend

# 12. Cron de auto-update
echo "⏰ Configurando auto-update às 4h da manhã..."
mkdir -p /var/log/softhair
chown "$SERVICE_USER:$SERVICE_USER" /var/log/softhair
cp "$SERVER_DIR/deploy/update.sh" /opt/softhair/update.sh
chmod +x /opt/softhair/update.sh
(crontab -u "$SERVICE_USER" -l 2>/dev/null | grep -v "softhair update"; echo "0 4 * * * /opt/softhair/update.sh # softhair update") | crontab -u "$SERVICE_USER" -

# 13. Backup automático às 3h
(crontab -u "$SERVICE_USER" -l 2>/dev/null | grep -v "softhair backup"; echo "0 3 * * * /opt/softhair/SOFT-HAIR-SERVER/deploy/backup.sh # softhair backup") | crontab -u "$SERVICE_USER" -
cp "$SERVER_DIR/deploy/backup.sh" /opt/softhair/SOFT-HAIR-SERVER/deploy/backup.sh
chmod +x /opt/softhair/SOFT-HAIR-SERVER/deploy/backup.sh

# 14. Firewall (libera porta 3001 só na LAN)
if command -v ufw &> /dev/null; then
  ufw allow from 192.168.0.0/16 to any port 3001
  ufw allow ssh
  echo "y" | ufw enable
fi

echo ""
echo "✅ Instalação concluída!"
echo ""
echo "Servidor rodando em http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "Credenciais admin (TROQUE NA PRIMEIRA LOGIN):"
echo "  Email: admin@salao.com"
echo "  Senha: TROQUE_NA_PRIMEIRA_LOGIN"
echo ""
echo "Comandos úteis:"
echo "  sudo systemctl status softhair-backend  # ver status"
echo "  sudo systemctl restart softhair-backend # reiniciar"
echo "  journalctl -u softhair-backend -f       # logs ao vivo"
echo "  bash /opt/softhair/update.sh            # update manual"
echo ""
echo "DB password salvo em $SERVER_DIR/.env (chmod 600)"
