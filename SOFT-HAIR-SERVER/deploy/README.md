# Deploy do PC Servidor (Cérebro Local)

Scripts prontos pra instalar o backend SoftHair no PC servidor de um salão.

## Quick start

No PC servidor (Ubuntu 24.04 LTS recomendado):

```bash
# 1. Clonar repo temporariamente pra pegar scripts
git clone https://github.com/guijoioj/MONEY.git /tmp/softhair-install

# 2. Rodar instalador (sobe Postgres, Node 20, clona /opt/softhair,
#    cria service systemd, configura cron de update/backup)
sudo bash /tmp/softhair-install/SOFT-HAIR-SERVER/deploy/install.sh

# 3. Limpa
rm -rf /tmp/softhair-install
```

Tempo total: ~5 min.

## O que cada arquivo faz

| Arquivo | Função |
|---------|--------|
| `install.sh` | Setup inicial completo. Roda 1 vez. |
| `update.sh` | Auto-update via cron 4h. Verifica GitHub, pulls, install deps, migra, restart. |
| `backup.sh` | Backup PostgreSQL via cron 3h. Mantém últimos 30 dias. |
| `softhair-backend.service` | Unit systemd. Auto-start no boot, restart se cair. |

## Auto-update funciona assim

1. Você faz `git push` + tag no seu PC
2. PC servidor às 4h roda `update.sh`:
   - `git fetch` → vê mudanças
   - `git pull`
   - Se `package.json` mudou → `npm install`
   - Se há migration nova → `npm run db:migrate`
   - `systemctl restart softhair-backend`
   - Health check
3. 4h05: servidor já tá com a versão nova
4. Manhã: salão abre, ninguém percebeu

## Backup funciona assim

- Todo dia 3h: `backup.sh` cria `softhair_YYYYMMDD_HHMMSS.sql.gz` em `/opt/softhair/backups/`
- Mantém últimos 30 dias localmente
- TODO: upload automático pra cloud (descomentar `rclone copy` no script)

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

# Update manual (sem esperar cron)
sudo bash /opt/softhair/update.sh

# Backup manual
sudo bash /opt/softhair/SOFT-HAIR-SERVER/deploy/backup.sh

# Restaurar backup
gunzip < /opt/softhair/backups/softhair_20260519_030000.sql.gz | psql -U softhair -d softhair
```

## Cliente Electron apontando pro servidor

Em cada PC do salão:
1. Abre SoftHair
2. Vai em **Configurar Servidor** (link no menu)
3. Escolhe **🏠 Servidor local do salão (cérebro)**
4. URL: `http://192.168.1.10:3001` (ajuste pro IP do servidor)
5. Salva → reinicia app

## Troubleshooting

**Servidor não inicia:**
```bash
journalctl -u softhair-backend -n 100
```

**Update falhou:**
```bash
tail -50 /var/log/softhair/update.log
```

**Health check falha:**
```bash
curl http://localhost:3001/api/health
```

**Postgres não conecta:**
```bash
sudo -u postgres psql -d softhair -c "SELECT 1"
```

## Segurança

- `.env` chmod 600, dono `softhair`
- Service roda como `softhair` (não-root)
- systemd hardening: NoNewPrivileges, PrivateTmp, ProtectSystem
- Firewall: porta 3001 só na LAN 192.168.0.0/16
- Auto-update verifica via git (origem GitHub, autenticado por HTTPS)

## Migração de PC

Quebrou o PC servidor? Instala em outro:
```bash
# No PC novo
sudo bash install.sh

# Restaura último backup
scp pcantigo:/opt/softhair/backups/softhair_*.sql.gz /tmp/
gunzip < /tmp/softhair_*.sql.gz | sudo -u postgres psql softhair
```

Pronto. ~10 min de migração + restore.
