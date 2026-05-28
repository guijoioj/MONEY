/**
 * Helpers WhatsApp via link wa.me — sem API externa.
 * - normalizePhone: tira tudo que não é dígito, garante +55 / DDI.
 * - buildLink: wa.me/<num>?text=<encodedURIComponent>
 * - openWhatsApp: abre janela em _blank.
 * - TEMPLATES: mensagens prontas com placeholders {nome}, {data}, {hora}, {servico}.
 */

export function normalizePhone(raw, defaultCountry = '55') {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  // Se já tem DDI (12-13 dígitos), não toca. Se 10-11 dígitos (DDD+número), prepende DDI.
  if (digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `${defaultCountry}${digits}`;
  // Telefone muito curto — não dá pra abrir wa.me, devolve null.
  return null;
}

export function buildLink(telefone, mensagem) {
  const num = normalizePhone(telefone);
  if (!num) return null;
  const text = mensagem ? `?text=${encodeURIComponent(mensagem)}` : '';
  return `https://wa.me/${num}${text}`;
}

export function openWhatsApp(telefone, mensagem) {
  const link = buildLink(telefone, mensagem);
  if (!link) {
    alert('Telefone inválido. Verifique o cadastro do cliente.');
    return false;
  }
  window.open(link, '_blank', 'noopener,noreferrer');
  return true;
}

export function render(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

// Templates editáveis (futuro: vir de config/DB).
export const TEMPLATES = [
  {
    id: 'confirmacao',
    label: 'Confirmação de agendamento',
    body: 'Oi {nome}! Confirmando seu horário em {data} às {hora} para {servico}. Qualquer coisa só responder aqui. 💇',
  },
  {
    id: 'lembrete',
    label: 'Lembrete de agendamento',
    body: 'Oi {nome}! Lembrando do seu horário amanhã ({data}) às {hora}. Se precisar remarcar, me avisa! 💖',
  },
  {
    id: 'aniversario',
    label: 'Feliz aniversário',
    body: 'Feliz aniversário, {nome}! 🎉 Que tal vir comemorar com um cabelo novo? Você merece! 💕',
  },
  {
    id: 'inativo',
    label: 'Cliente inativo',
    body: 'Oi {nome}! Faz um tempo que não vejo você por aqui. Posso te encaixar essa semana? 💇',
  },
  {
    id: 'pos_atendimento',
    label: 'Pós-atendimento',
    body: 'Oi {nome}! Espero que tenha gostado do atendimento hoje. Qualquer dúvida sobre cuidados, é só falar! ✨',
  },
];
