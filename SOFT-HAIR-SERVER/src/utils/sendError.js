// [M1] Sanitiza mensagens de erro para o cliente.
// Em produção: retorna mensagem genérica + correlationId; detalhes vão ao stderr.
// Em dev/test: retorna mensagem original para facilitar debug.

const crypto = require('crypto');

/**
 * @param {import('express').Response} res
 * @param {number} status HTTP status
 * @param {string} publicMessage Mensagem segura para o cliente
 * @param {Error|unknown} [error] Erro original (opcional, logado)
 * @param {object} [extra] Campos adicionais para incluir no payload
 */
function sendError(res, status, publicMessage, error, extra = {}) {
  const correlationId = crypto.randomBytes(8).toString('hex');
  const isProd = process.env.NODE_ENV === 'production';

  if (error) {
    const reqInfo = res.req ? `${res.req.method} ${res.req.originalUrl}` : '';
    console.error(`[ERROR][${correlationId}] ${reqInfo} ${publicMessage}:`, error?.message || error);
    if (!isProd && error?.stack) console.error(error.stack);
  }

  const body = {
    success: false,
    error: publicMessage,
    correlationId,
    ...extra,
  };
  if (!isProd && error && error.message) body.message = error.message;

  return res.status(status).json(body);
}

module.exports = { sendError };
