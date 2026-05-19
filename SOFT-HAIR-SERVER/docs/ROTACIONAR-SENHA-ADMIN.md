# Rotacionar Senha do Admin em Produção

> Procedimento seguro pra trocar a senha admin sem nunca commitar a senha real.

## Quando rodar
- Após detecção de vazamento de credencial
- Periodicamente (a cada 90 dias)
- Sempre que um funcionário com acesso admin sair
- Após teste de penetração

---

## Passo 1 — Gerar hash bcrypt localmente

No seu PC (NÃO no Render):

```bash
cd SOFT-HAIR-SERVER
node scripts/generate-password-hash.js
```

Você digita a senha 2x (ela não aparece na tela). O script:
- Valida força (mínimo 12 chars, letra + número + símbolo)
- Gera hash bcrypt cost=12
- Imprime APENAS o hash no terminal

**Copie o hash inteiro** (algo como `$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxx...`).

A senha em si **nunca é salva, logada ou enviada**.

---

## Passo 2 — Preparar o UPDATE SQL

Edite o arquivo template (sem commitar a edição):

```bash
cp scripts/templates/rotate-admin-password.sql /tmp/rotate.sql
# Edita /tmp/rotate.sql substituindo <COLE_AQUI_O_HASH_BCRYPT> pelo hash
```

⚠️ **Use `/tmp/` ou qualquer pasta FORA do repo.** Nunca edite o template
versionado diretamente — risco de commitar acidentalmente o hash.

---

## Passo 3 — Aplicar no banco de produção

**Opção A — Render Shell** (mais fácil):

1. Render dashboard → seu Web Service `MONEY` → aba **Shell**
2. Cola o conteúdo de `/tmp/rotate.sql` direto no terminal `psql`:
   ```bash
   psql $DATABASE_URL
   ```
3. Cola o SQL inteiro
4. Verifica retorno do SELECT (deve mostrar token_version incrementado)
5. Se OK, digita `COMMIT;` e Enter
6. Sai do psql: `\q`

**Opção B — Via External URL do banco** (do seu PC):

1. Pega External Database URL no dashboard do Render → Database service
2. Roda:
   ```bash
   psql "postgresql://user:pass@host.ohio-postgres.render.com/db?sslmode=require" \
     -f /tmp/rotate.sql
   ```
3. Confere output

---

## Passo 4 — Limpar env vars do Render

No dashboard Render → Web Service → **Environment**:

1. **Remover** `DEFAULT_ADMIN_PASSWORD` (se existir)
2. **Remover** `SOFTHAIR_DEFAULT_ADMIN_PASSWORD` (se existir)
3. Mantém: `DEFAULT_ADMIN_EMAIL` (sem senha) — usado só pra display

Salva. Render faz redeploy automático.

---

## Passo 5 — Apagar arquivo temporário

```bash
rm /tmp/rotate.sql
```

O hash bcrypt sozinho não revela a senha, mas melhor não deixar vazado.

---

## Passo 6 — Validar

**6.1. Senha antiga não funciona mais:**
```bash
curl -s -X POST https://money-f5rz.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@softhair.com","senha":"SENHA_ANTIGA_AQUI"}'
# Esperado: HTTP 401 / "Credenciais inválidas"
```

**6.2. Senha nova funciona:**
```bash
curl -s -X POST https://money-f5rz.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@softhair.com","senha":"SUA_SENHA_NOVA"}'
# Esperado: HTTP 200 com JWT no body
```

**6.3. Tokens antigos foram invalidados:**
- Se você tinha um JWT admin antigo aberto, qualquer chamada vai retornar 401
- (Porque `token_version` no JWT não bate mais com o da `users`)

---

## Checklist final

- [ ] Hash gerado localmente sem commitar senha
- [ ] UPDATE rodou em produção (SELECT confirmou)
- [ ] `DEFAULT_ADMIN_PASSWORD` removido do Render
- [ ] `/tmp/rotate.sql` apagado
- [ ] Senha antiga retorna 401
- [ ] Senha nova retorna 200 com JWT
- [ ] Audit log no banco registra a mudança (opcional)

---

## Limitações conhecidas

- **Histórico Git** — a credencial antiga pode estar no histórico. Mesmo
  redirigida no commit atual, o histórico mantém. Considerar a senha
  antiga PUBLICAMENTE COMPROMETIDA mesmo após rotação.
- **JWT já em uso** — usuários ativos perdem sessão (esperado).
- **Cache** — se há cache de auth no servidor, pode demorar uns segundos.

---

## NÃO faça

❌ Commitar hash bcrypt ou senha real em arquivo  
❌ Deixar `DEFAULT_ADMIN_PASSWORD` setada no Render após rotação  
❌ Usar a mesma senha que vazou no histórico do Git  
❌ Editar o template SQL versionado (use cópia em `/tmp/`)  
❌ Mandar a senha em chat, email ou Slack
