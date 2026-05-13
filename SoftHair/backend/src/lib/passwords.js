/**
 * Validação de força de senha compartilhada (Pass 3 P3-C6).
 *
 * Extraído de `routes/auth.js` para que `config/initDb.js` (bootstrap via env)
 * possa reusar a mesma regra. Caso contrário, `BOOTSTRAP_ADMIN_PASSWORD=12345678`
 * passava só pelo check `.length >= 8` enquanto o endpoint UI rejeitava.
 */

const COMMON_PASSWORDS = new Set([
  'password', 'senha123', '12345678', '123456789', '1234567890',
  'qwerty123', 'admin123', 'admin1234', 'softhair', 'softhair1',
  'salaobeleza', 'cabeleireiro', 'password1', 'iloveyou', 'aaaaaaaa',
  'abcdefgh', '11111111', '00000000', 'changeme', 'letmein123',
  'password123', 'P@ssw0rd', 'Senha1234', 'Qwerty123',
]);

/**
 * Senha forte:
 *  - 8+ caracteres
 *  - não é senha comum (case-insensitive)
 *  - tem pelo menos 1 minúscula, 1 maiúscula, 1 dígito
 *
 * @param {string} senha
 * @returns {boolean}
 */
function isStrongPassword(senha) {
  if (typeof senha !== 'string' || senha.length < 8) return false;
  if (COMMON_PASSWORDS.has(senha.toLowerCase())) return false;
  if (!/[a-z]/.test(senha)) return false;
  if (!/[A-Z]/.test(senha)) return false;
  if (!/\d/.test(senha)) return false;
  return true;
}

module.exports = { isStrongPassword, COMMON_PASSWORDS };
