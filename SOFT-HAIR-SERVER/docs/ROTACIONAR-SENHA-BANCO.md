# 🚨 URGENTE: Rotacionar Senha do PostgreSQL do Render

## O problema

A senha do banco PostgreSQL no Render foi **commitada acidentalmente** em
3 arquivos de teste/script e ficou no histórico público do Git:

- `SOFT-HAIR-SERVER/src/__tests__/integration.smoke.test.js`
- `SOFT-HAIR-SERVER/src/__tests__/pass7.test.js`
- `SOFT-HAIR-SERVER/tools/migrate-servicos-to-produtos.js`

O hash bcrypt sozinho não revela senha, mas **DATABASE_URL completa** dá acesso
direto ao banco de produção. Qualquer pessoa que clonou o repo histórico tem
essa credencial.

## Como rotacionar (5 min)

### 1. Dashboard Render

1. Acessa https://dashboard.render.com
2. Vai no **Database service** `db_softhair`
3. Aba **Settings** (não "Connect")
4. Procura **"Rotate Credentials"** ou **"Reset Password"**
5. Clica → confirma → Render gera senha nova automaticamente

### 2. Atualizar Web Service

1. Volta no **Web Service** `MONEY`
2. Aba **Environment**
3. Variável `DATABASE_URL`:
   - Render auto-atualiza se a DB e o Web Service estão linkados (recomendado)
   - Senão: copia a nova "Internal Database URL" e cola
4. Salva → Render faz redeploy automático

### 3. Verificar

```bash
# Espera redeploy (~30s) e testa:
curl https://money-f5rz.onrender.com/api/health
# Esperado: {"success":true,"status":"healthy"}
```

Se 200 OK → backend conecta com a nova senha → tudo certo.

### 4. (Opcional) Limpar histórico Git

A senha antiga já está no histórico público. Tem 2 opções:

**A — Aceitar e seguir:** depois da rotação, senha antiga não vale mais. Risco zero.

**B — Reescrever histórico** (só faz se for paranoico):
```bash
# Instala git-filter-repo
pip install git-filter-repo

# Cria arquivo replacements.txt
echo 'HIRdZdaglLmErrqqvQP86LQjLcMzFThv==><REDACTED>' > replacements.txt

# Reescreve
git filter-repo --replace-text replacements.txt --force

# Force push (DESTRUTIVO — quebra clones existentes)
git push origin main --force --all --tags
```

**Recomendação:** opção A. Force-push quebra colaboradores e auto-update dos
clientes Electron (electron-updater).

## Por que aconteceu

Tests precisam de DATABASE_URL pra rodar contra prod. Foi hardcoded em vez de
ler de env var. Fix definitivo: tests devem ler de `process.env.DATABASE_URL`
ou usar banco de test separado.

## Como prevenir no futuro

1. Adicionar pre-commit hook que bloqueia commits com credencial:
   ```bash
   # .git/hooks/pre-commit
   #!/bin/bash
   if git diff --cached | grep -qE "postgresql?://[^/]+:[^@]+@"; then
     echo "❌ DATABASE_URL com senha detectada. Use env var."
     exit 1
   fi
   ```

2. Tests devem usar:
   ```js
   const DATABASE_URL = process.env.DATABASE_URL;
   if (!DATABASE_URL) { console.warn('Skip: DATABASE_URL not set'); return; }
   ```

3. `git-secrets` ou `gitleaks` no CI (próximo passo).
