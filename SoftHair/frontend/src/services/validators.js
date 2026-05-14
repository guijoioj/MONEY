/**
 * P7-A3: validators client-side reusáveis.
 *
 * Antes do submit, chamar `validateField(value, type)` para detectar formato
 * inválido ANTES do round-trip ao backend. Backend continua revalidando.
 *
 * Convenção:
 *   - empty/null/undefined retornam { ok: true } (deixar `required` decidir).
 *   - Mesma regra do express-validator backend.
 */

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

export function validateCPF(value) {
  if (!value) return { ok: true };
  const d = onlyDigits(value);
  if (d.length !== 11) return { ok: false, error: 'CPF deve ter 11 dígitos' };
  // Rejeita "00000000000", "11111111111", etc — não são CPFs reais
  if (/^(\d)\1{10}$/.test(d)) return { ok: false, error: 'CPF inválido' };
  return { ok: true };
}

export function validateTelefone(value) {
  if (!value) return { ok: true };
  const d = onlyDigits(value);
  if (d.length < 10 || d.length > 11) {
    return { ok: false, error: 'Telefone deve ter 10 ou 11 dígitos (DDD + número)' };
  }
  return { ok: true };
}

export function validateEmail(value) {
  if (!value) return { ok: true };
  // Mesma regex pragmática usada por express-validator (não RFC completa, mas pega 99.9%).
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value))) {
    return { ok: false, error: 'Email inválido' };
  }
  return { ok: true };
}

export function validateCEP(value) {
  if (!value) return { ok: true };
  const d = onlyDigits(value);
  if (d.length !== 8) return { ok: false, error: 'CEP deve ter 8 dígitos' };
  return { ok: true };
}

export function validatePositiveNumber(value, { allowZero = false } = {}) {
  if (value === '' || value === null || value === undefined) return { ok: true };
  const n = Number(value);
  if (!Number.isFinite(n)) return { ok: false, error: 'Valor numérico inválido' };
  if (allowZero ? n < 0 : n <= 0) {
    return { ok: false, error: allowZero ? 'Valor deve ser >= 0' : 'Valor deve ser positivo' };
  }
  return { ok: true };
}

export function validateDate(value) {
  if (!value) return { ok: true };
  // Formato esperado: YYYY-MM-DD (input type=date) ou ISO 8601.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { ok: false, error: 'Data inválida' };
  return { ok: true };
}

/**
 * Política de senha forte do backend (P3-C6) replicada para feedback antecipado.
 * Mantém em sync com backend/src/lib/passwords.js.
 */
export function validateStrongPassword(value) {
  if (!value) return { ok: true };
  if (typeof value !== 'string' || value.length < 8) {
    return { ok: false, error: 'Senha fraca: mínimo 8 caracteres' };
  }
  if (!/[a-z]/.test(value)) return { ok: false, error: 'Senha precisa de letra minúscula' };
  if (!/[A-Z]/.test(value)) return { ok: false, error: 'Senha precisa de letra maiúscula' };
  if (!/\d/.test(value)) return { ok: false, error: 'Senha precisa de número' };
  return { ok: true };
}

/**
 * P7-A4: score 0-4 para indicador visual de força.
 *   0 = vazio
 *   1 = curta/só letras
 *   2 = média (atende minimum)
 *   3 = forte (com case mix + dígito)
 *   4 = excelente (com símbolo + 12+)
 */
export function passwordStrengthScore(value) {
  if (!value || typeof value !== 'string' || value.length === 0) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value) && value.length >= 12) score++;
  return score;
}

export function passwordStrengthLabel(score) {
  return ['', 'fraca', 'média', 'forte', 'excelente'][score] || '';
}

export function passwordStrengthColor(score) {
  // Retorna classes Tailwind ou cores hex
  return ['#e5e7eb', '#dc2626', '#f59e0b', '#16a34a', '#059669'][score] || '#e5e7eb';
}

/**
 * Helper composto para validar form inteiro. Retorna { valid: bool, errors: {field: msg} }.
 *
 * Exemplo:
 *   const r = validateForm(formData, {
 *     nome: { required: true },
 *     email: { email: true },
 *     cpf: { cpf: true },
 *     telefone: { telefone: true },
 *   });
 *   if (!r.valid) setErrors(r.errors);
 */
export function validateForm(data, rules) {
  const errors = {};
  for (const [field, rule] of Object.entries(rules || {})) {
    const value = data[field];
    if (rule.required && (value === '' || value === null || value === undefined)) {
      errors[field] = `${field} é obrigatório`;
      continue;
    }
    if (rule.email) {
      const r = validateEmail(value);
      if (!r.ok) { errors[field] = r.error; continue; }
    }
    if (rule.cpf) {
      const r = validateCPF(value);
      if (!r.ok) { errors[field] = r.error; continue; }
    }
    if (rule.telefone) {
      const r = validateTelefone(value);
      if (!r.ok) { errors[field] = r.error; continue; }
    }
    if (rule.cep) {
      const r = validateCEP(value);
      if (!r.ok) { errors[field] = r.error; continue; }
    }
    if (rule.positiveNumber) {
      const r = validatePositiveNumber(value, rule.positiveNumber);
      if (!r.ok) { errors[field] = r.error; continue; }
    }
    if (rule.date) {
      const r = validateDate(value);
      if (!r.ok) { errors[field] = r.error; continue; }
    }
    if (rule.strongPassword) {
      const r = validateStrongPassword(value);
      if (!r.ok) { errors[field] = r.error; continue; }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
