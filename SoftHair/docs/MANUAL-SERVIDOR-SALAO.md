# Manual: Instalação do Servidor (Cérebro) no Salão

> **Objetivo**: configurar 1 PC que vai guardar todos os dados do salão e servir os outros 7 PCs.

---

## Hardware necessário

- **PC dedicado**: i5/Ryzen 5, 8GB RAM mínimo, SSD 256GB
- **No-break (UPS)**: APC 700VA ou similar
- **Cabo de rede** ligando o PC ao roteador
- **IP fixo no roteador** (próximo passo)

---

## Parte 1 — Sistema operacional

**Recomendado: Ubuntu Server 24.04 LTS** (gratuito, sem GUI, estável)

Alternativa: Windows 11 (se você prefere familiaridade)

Vou cobrir os DOIS caminhos.

---

# CAMINHO A — Ubuntu Server (recomendado)

## A1. Instalar Ubuntu Server

1. Baixa ISO: https://ubuntu.com/download/server
2. Cria pendrive bootável com Rufus (https://rufus.ie)
3. Boota o PC pelo pendrive
4. Instalação:
   - Linguagem: Português
   - Layout teclado: Portuguese (Brazil)
   - Tipo: **Ubuntu Server (minimal)**
   - Rede: deixa DHCP por enquanto
   - Disco: usa o disco todo, LVM
   - Usuário: `softhair` / senha forte
   - Hostname: `cerebro-salao`
   - **Marcar: Install OpenSSH server** (essencial!)
   - Pula features adicionais
5. Espera instalar, reboot, remove pendrive

## A2. Primeiro acesso

No PC servidor (teclado/monitor conectado):
```bash
# Login com user softhair
# Atualizar tudo
sudo apt update && sudo apt upgrade -y

# Descobrir IP atual
ip a | grep inet
# Anota o IP (ex: 192.168.1.150)
```

## A3. Configurar IP fixo

**Via roteador** (mais fácil):
1. Abre painel do roteador (geralmente 192.168.1.1)
2. Procura "DHCP Reservation" ou "Static IP"
3. Reserva `192.168.1.10` pro MAC do servidor
4. Reboot o servidor pra pegar IP novo

**Via Ubuntu** (alternativa):
```bash
sudo nano /etc/netplan/00-installer-config.yaml
```
Edita:
```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses: [192.168.1.10/24]
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
```
```bash
sudo netplan apply
```

## A4. Conectar via SSH (do seu PC normal)

```bash
ssh softhair@192.168.1.10
# Daqui pra frente, faz tudo remoto. Pode desconectar teclado/monitor do servidor.
```

## A5. Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # deve mostrar v20.x.x
npm -v
```

## A6. Instalar PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Criar usuário e database
sudo -u postgres psql <<EOF
CREATE USER softhair WITH PASSWORD 'TROCAR_ESTA_SENHA_AQUI';
CREATE DATABASE softhair OWNER softhair;
GRANT ALL PRIVILEGES ON DATABASE softhair TO softhair;
EOF
```

## A7. Permitir conexões da LAN no PostgreSQL

```bash
# Edita config principal
sudo nano /etc/postgresql/16/main/postgresql.conf
# Procura "listen_addresses" → muda pra:
#   listen_addresses = 'localhost'
# (mantém só localhost — backend acessa via localhost)

# Edita autenticação
sudo nano /etc/postgresql/16/main/pg_hba.conf
# Adiciona linha:
#   host    softhair    softhair    127.0.0.1/32    md5

sudo systemctl restart postgresql
```

## A8. Clonar o SoftHair

```bash
cd /opt
sudo mkdir softhair && sudo chown softhair:softhair softhair
cd softhair
git clone https://github.com/guijoioj/MONEY .
cd SoftHair/backend
npm install
```

## A9. Configurar .env do backend

```bash
nano /opt/softhair/SoftHair/backend/.env
```

Cola:
```
NODE_ENV=production
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://softhair:TROCAR_ESTA_SENHA_AQUI@localhost:5432/softhair
PORT=3001
HOST=0.0.0.0
JWT_SECRET=GERAR_COM_openssl_rand_-hex_32
JWT_EXPIRES_IN=30d
ENCRYPTION_KEY=GERAR_COM_openssl_rand_-hex_32
HMAC_SECRET=GERAR_COM_openssl_rand_-hex_32
BACKUP_ENCRYPTION_KEY=GERAR_COM_openssl_rand_-hex_32
ALLOWED_ORIGINS=http://192.168.1.10:3001,app://softhair.com
SOFTHAIR_DEFAULT_ADMIN_EMAIL=<REDACTED_EMAIL>
SOFTHAIR_DEFAULT_ADMIN_PASSWORD=TROCAR_DEPOIS_DE_LOGAR
```

Gera os 4 secrets:
```bash
for i in 1 2 3 4; do openssl rand -hex 32; done
# Cola cada um no .env nos lugares marcados TROCAR
```

## A10. Rodar migrações do banco

```bash
cd /opt/softhair/SoftHair/backend
node migrate.js   # ou npm run migrate, depende do projeto
```

## A11. Testar manualmente

```bash
cd /opt/softhair/SoftHair/backend
node src/server.js
# Deve mostrar: "Server running on http://0.0.0.0:3001"
# Ctrl+C pra parar
```

Testa do seu PC normal:
```bash
curl http://192.168.1.10:3001/api/health
# Deve responder algo tipo: {"status":"ok"}
```

## A12. Criar systemd service (roda sozinho, reinicia se cair)

```bash
sudo nano /etc/systemd/system/softhair.service
```

Cola:
```ini
[Unit]
Description=SoftHair Backend
After=network.target postgresql.service

[Service]
Type=simple
User=softhair
WorkingDirectory=/opt/softhair/SoftHair/backend
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/softhair/out.log
StandardError=append:/var/log/softhair/err.log
EnvironmentFile=/opt/softhair/SoftHair/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo mkdir -p /var/log/softhair
sudo chown softhair:softhair /var/log/softhair
sudo systemctl daemon-reload
sudo systemctl enable softhair
sudo systemctl start softhair
sudo systemctl status softhair   # deve mostrar "active (running)"
```

Daqui pra frente o backend sobe sozinho a cada reboot.

## A13. Liberar firewall

```bash
sudo ufw allow from 192.168.1.0/24 to any port 3001
sudo ufw enable
sudo ufw status
```

## A14. Backup automático pra Render

```bash
nano /opt/softhair/backup.sh
```

Cola:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/softhair/backups"
mkdir -p $BACKUP_DIR
PGPASSWORD="TROCAR_ESTA_SENHA_AQUI" pg_dump -h localhost -U softhair softhair | gzip > $BACKUP_DIR/softhair_$DATE.sql.gz

# Mantém só últimos 7 dias local
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

# Upload pra Render (precisa configurar rclone ou similar)
# Alternativa: usa Google Drive via API que já existe no SoftHair
```

```bash
chmod +x /opt/softhair/backup.sh

# Crontab: roda toda noite 3h
crontab -e
```

Adiciona:
```
0 3 * * * /opt/softhair/backup.sh >> /var/log/softhair/backup.log 2>&1
```

## A15. Auto-update do backend (madrugada 4h)

```bash
nano /opt/softhair/update.sh
```

Cola:
```bash
#!/bin/bash
cd /opt/softhair
git pull origin main
cd SoftHair/backend
npm install --omit=dev
sudo systemctl restart softhair
echo "Updated at $(date)"
```

```bash
chmod +x /opt/softhair/update.sh
sudo visudo
# Adiciona linha:
softhair ALL=(ALL) NOPASSWD: /bin/systemctl restart softhair
```

Crontab:
```
0 4 * * * /opt/softhair/update.sh >> /var/log/softhair/update.log 2>&1
```

---

# CAMINHO B — Windows 11 (alternativa)

## B1. Instalação básica

1. Instala Windows 11 normal
2. Cria conta `softhair` (admin)
3. Atualiza tudo via Windows Update

## B2. Instalar Node 20

1. Baixa: https://nodejs.org/en/download → versão LTS 20.x
2. Instala (next, next, next)
3. Abre PowerShell: `node -v`

## B3. Instalar PostgreSQL

1. Baixa: https://www.postgresql.org/download/windows/
2. Instala (anota a senha do `postgres`)
3. Porta padrão 5432
4. Abre **pgAdmin** → cria database `softhair` + user `softhair`

## B4. Clonar repo

```powershell
cd C:\
git clone https://github.com/guijoioj/MONEY softhair
cd softhair\SoftHair\backend
npm install
```

## B5. Criar .env

Mesma estrutura do Linux (A9 acima).

## B6. Rodar como serviço Windows

Instala `node-windows`:
```powershell
npm install -g node-windows
```

Cria `C:\softhair\install-service.js`:
```js
const Service = require('node-windows').Service;
const svc = new Service({
  name: 'SoftHair Backend',
  description: 'SoftHair Server',
  script: 'C:\\softhair\\SoftHair\\backend\\src\\server.js',
});
svc.on('install', () => svc.start());
svc.install();
```

```powershell
node C:\softhair\install-service.js
```

Agora aparece em **Services** do Windows. Roda sozinho a cada boot.

## B7. Firewall

Painel de Controle → Firewall → Regras de entrada → Nova regra → Porta 3001 TCP → Permitir.

---

# Parte final — Configurar os 7 PCs cliente

Em CADA um dos 7 PCs do salão:

1. Baixa `SoftHair-Setup-3.0.0.exe` (do GitHub Release)
2. Instala
3. **Primeira abertura**: tela de configuração → cola `http://192.168.1.10:3001/api` no campo "Servidor"
4. Login admin / senha
5. Pronto. Usa normal.

**Implementação dessa tela de "Configurar servidor"** ainda precisa ser feita no Electron. Hoje o app aponta hardcoded pro backend embarcado. Falar com Claude pra adicionar essa tela.

---

# Comandos do dia-a-dia (servidor)

```bash
# Ver status
sudo systemctl status softhair

# Ver logs em tempo real
journalctl -u softhair -f
# ou
tail -f /var/log/softhair/out.log

# Reiniciar manualmente
sudo systemctl restart softhair

# Update manual
cd /opt/softhair && git pull && cd SoftHair/backend && npm install && sudo systemctl restart softhair

# Ver uso de disco/memória
htop
df -h
```

---

# Resumo da checklist

- [ ] PC servidor instalado (Ubuntu ou Windows)
- [ ] No-break ligado
- [ ] IP fixo no roteador: 192.168.1.10
- [ ] PostgreSQL rodando
- [ ] Backend SoftHair rodando como serviço
- [ ] Backup automático configurado
- [ ] Firewall liberando porta 3001 na LAN
- [ ] 7 PCs cliente apontando pro servidor
- [ ] Teste: marca agendamento no PC1, vê no PC2 em < 2s

---

**Tempo estimado de setup do servidor**: 2-3 horas (primeira vez), 30 min (com prática).
