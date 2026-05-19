-- ============================================================================
-- TEMPLATE: rotação de senha do admin
-- ============================================================================
--
-- USO:
--   1. Gere o hash localmente:
--        cd SOFT-HAIR-SERVER
--        node scripts/generate-password-hash.js
--
--   2. Cole o hash gerado abaixo no lugar de <COLE_AQUI_O_HASH_BCRYPT>.
--
--   3. Conecte no banco de produção (Render Shell ou psql via DATABASE_URL).
--
--   4. Rode este UPDATE. Token_version + 1 invalida JWTs antigos imediatamente.
--
--   5. APAGUE este arquivo após rodar (não comitar com hash real).
--
-- IMPORTANTE:
--   - NÃO commitar este arquivo com hash real preenchido.
--   - O hash é gerado com cost=12 (mesmo do gerador local).
--   - token_version força logout de qualquer sessão admin existente.
-- ============================================================================

BEGIN;

UPDATE users
   SET password      = '<COLE_AQUI_O_HASH_BCRYPT>',
       token_version = COALESCE(token_version, 0) + 1
 WHERE email IN ('admin@softhair.com', 'admin@salao.com');

-- Confirma quantas linhas foram atualizadas (esperado: 1 ou 2)
SELECT id, email, role, token_version
  FROM users
 WHERE email IN ('admin@softhair.com', 'admin@salao.com');

-- Se OK, descomenta e roda:
-- COMMIT;
-- Se algo estranho, roda:
-- ROLLBACK;
