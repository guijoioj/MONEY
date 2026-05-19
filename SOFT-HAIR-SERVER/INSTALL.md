# Instalação do Backend (PC Servidor)

> Manual único pra deixar o servidor SoftHair rodando no PC dedicado do salão.

---

## O que vai ser instalado

- PostgreSQL 16 (banco de dados)
- Node.js 20 LTS
- Backend SoftHair (`/opt/softhair`)
- Service systemd (auto-start no boot, restart se cair)
- Cron de update automático (madrugada)
- Cron de backup diário (madrugada)
- Firewall liberando porta 3001 só na rede do salão

Tempo total: ~5-10 minutos.

---

## Pré-requisitos

| Item | Detalhe |
|------|---------|
| PC | i5/Ryzen 5+, 8GB RAM, SSD 256GB |
| SO | Ubuntu Server 24.04 LTS |
| Rede | Cabo ethernet (não WiFi) ligado ao roteador |
| IP fixo | Configurar no roteador (ex: `192.168.1.10`) |
| Internet | Necessária só pra instalar (depois funciona offline) |

---

## Passo 1 — Instalar Ubuntu Server

1. Baixa ISO: https://ubuntu.com/download/server
2. Cria pendrive bootável (Rufus no Windows, ou `dd` no Linux)
3. Boota o PC pelo pendrive
4. Durante a instalação:
   - Linguagem: Português
   - Tipo: **Ubuntu Server (minimal)**
   - Usuário do sistema: `softhair`
   - ✅ **Marcar "Install OpenSSH server"** (essencial pra acessar remoto depois)
5. Espera instalar (~10 min), reboot, remove pendrive

---

## Passo 2 — Primeiro acesso

No PC servidor (com teclado/monitor):

```bash
# Login com user softhair + senha que você definiu
# Atualiza tudo
sudo apt update && sudo apt upgrade -y

# Descobre o IP
ip a | grep "inet "
# Anota (ex: 192.168.1.10)
```

A partir daqui pode acessar remoto do seu PC normal:
```bash
ssh softhair@192.168.1.10
```

---

## Passo 3 — Configurar IP fixo (no roteador)

1. Abre painel do roteador (geralmente `192.168.1.1`)
2. Procura **"DHCP Reservation"** ou **"Reservar IP"**
3. Reserva `192.168.1.10` pro MAC do PC servidor
4. Reboot do servidor pra pegar IP novo

(Senão o IP pode mudar de tempos em tempos e os 6 PCs cliente perdem conexão.)

---

## Passo 4 — Rodar o instalador

No PC servidor (1 comando faz tudo):

```bash
sudo apt install -y git
git clone https://github.com/guijoioj/MONEY.git /tmp/install
sudo bash /tmp/install/SOFT-HAIR-SERVER/deploy/install.sh
rm -rf /tmp/install
```

O instalador faz, sem intervenção:
- Instala PostgreSQL + Node 20
- Cria user `softhair` no Postgres com senha aleatória
- Cria database `softhair`
- Clona repo em `/opt/softhair`
- Gera 4 secrets aleatórios (JWT, encryption, HMAC, backup)
- Roda migrations (inclui Comissões V2)
- Cria service systemd
- Cron 4h: auto-update via git pull
- Cron 3h: backup diário (30 dias retention)
- Firewall: porta 3001 liberada só na LAN

Aparece no final:
```
✅ Instalação concluída!
Servidor rodando em http://192.168.1.10:3001
```

---

## Passo 5 — (Opcional) Restaurar dados da Render

Se você já tem dados em produção (Render) e quer migrá-los pro servidor local:

**Do seu PC normal:**
```bash
pg_dump "postgresql://USER:PASS@HOST.ohio-postgres.render.com/db?sslmode=require" \
  --no-owner --no-acl --clean --if-exists \
  > /tmp/prod.sql
scp /tmp/prod.sql softhair@192.168.1.10:/tmp/
```

**No PC servidor:**
```bash
# Pega senha do banco gerada pelo install.sh
sudo grep DATABASE_URL /opt/softhair/SOFT-HAIR-SERVER/.env
# Saída: DATABASE_URL=postgresql://softhair:SENHA_ALEATORIA@localhost:5432/softhair

# Restaura (substitui SENHA_ALEATORIA pela copiada)
PGPASSWORD='SENHA_ALEATORIA' psql -h localhost -U softhair -d softhair -f /tmp/prod.sql

rm /tmp/prod.sql
sudo systemctl restart softhair-backend
```

---

## Passo 6 — Testar

Do seu PC normal:

```bash
curl http://192.168.1.10:3001/api/health
# Esperado: {"status":"ok",...}
```

Login (com a senha admin que você configurou):

```bash
curl -X POST http://192.168.1.10:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@softhair.com","senha":"SUA_SENHA"}'
# Esperado: JSON com "token"
```

✅ Backend pronto.

---

## Comandos do dia-a-dia

```bash
# Ver status
sudo systemctl status softhair-backend

# Ver logs ao vivo
journalctl -u softhair-backend -f
# ou
tail -f /var/log/softhair/out.log

# Reiniciar manualmente
sudo systemctl restart softhair-backend

# Forçar update agora (sem esperar cron 4h)
sudo bash /opt/softhair/update.sh

# Backup manual
sudo bash /opt/softhair/SOFT-HAIR-SERVER/deploy/backup.sh

# Ver backups
ls -la /opt/softhair/backups/

# Restaurar backup
gunzip < /opt/softhair/backups/softhair_AAAAMMDD_HHMMSS.sql.gz \
  | PGPASSWORD='SENHA' psql -U softhair -d softhair
```

---

## Estrutura criada

```
/opt/softhair/
├── SOFT-HAIR-SERVER/        # Código do backend (git clone)
│   ├── .env                 # Secrets (chmod 600, dono softhair)
│   ├── src/server.js        # Entry point
│   └── deploy/              # Scripts (install, update, backup)
├── update.sh                # Auto-update via cron 4h
└── backups/                 # Backups SQL gzipped (30 dias)

/etc/systemd/system/
└── softhair-backend.service # Unit do serviço

/var/log/softhair/
├── out.log                  # stdout do backend
├── err.log                  # stderr
├── update.log               # log do cron de update
└── backup.log               # log do cron de backup
```

---

## Troubleshooting

**Servidor não inicia:**
```bash
journalctl -u softhair-backend -n 100
```
Procura erro em `database`, `JWT_SECRET`, ou porta ocupada.

**`port 3001 in use`:**
```bash
sudo lsof -i :3001
# Mata o processo antigo
sudo systemctl restart softhair-backend
```

**Postgres não conecta:**
```bash
sudo systemctl status postgresql
sudo -u postgres psql -d softhair -c "SELECT 1"
```

**Outros PCs não acessam o servidor:**
```bash
# Confirma firewall
sudo ufw status
# Confirma backend escuta em 0.0.0.0:3001 (não só localhost)
sudo ss -tlnp | grep 3001
```

**Senha do banco perdida:**
```bash
sudo cat /opt/softhair/SOFT-HAIR-SERVER/.env | grep DATABASE_URL
```

---

## Update automático

Não precisa fazer nada manual depois.

- **Backend**: cron roda `update.sh` toda madrugada às 4h. Verifica GitHub, pulls, migra, restart. Logs em `/var/log/softhair/update.log`.
- **Backup**: cron roda `backup.sh` toda madrugada às 3h. Mantém últimos 30 dias.

Se quiser forçar update agora:
```bash
sudo bash /opt/softhair/update.sh
```

---

## Próximos passos

Backend pronto. Agora:

1. **Instalar SoftHair nos 6 PCs cliente** (Windows)
   - Baixa `SoftHair-Setup.exe` em https://github.com/guijoioj/MONEY/releases
   - Instala
   - Abre app → menu **Sistema → Configurar Servidor**
   - Escolhe **🏠 Servidor local** → cola `http://192.168.1.10:3001`
   - Salva, reinicia app
   - Login com `admin@softhair.com` + sua senha

2. **Migrar dados** (se ainda não fez no Passo 5)

3. **Testar:** cria venda no PC 1, abre PC 2 → venda aparece.

---

## Segurança

- `.env` com permissão `600` (só user `softhair` lê)
- 4 secrets aleatórios (32 bytes hex) gerados no install
- Postgres só escuta `localhost` (não exposto na rede)
- Firewall UFW: porta 3001 só pra LAN `192.168.0.0/16`
- systemd: roda como user `softhair` (não-root), hardening (NoNewPrivileges, ProtectSystem)
- Senha admin: trocar via `node scripts/generate-password-hash.js` + UPDATE manual (ver `docs/ROTACIONAR-SENHA-ADMIN.md`)
