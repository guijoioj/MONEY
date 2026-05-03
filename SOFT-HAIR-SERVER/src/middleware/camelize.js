/**
 * Middleware que converte snake_case → camelCase em todas as respostas JSON.
 * Isso garante compatibilidade com frontend (desktop + mobile) que usa camelCase.
 */

function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function camelizeKeys(obj) {
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [snakeToCamel(k), camelizeKeys(v)])
    );
  }
  return obj;
}

function camelizeResponse(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    return originalJson(camelizeKeys(data));
  };
  next();
}

module.exports = { camelizeResponse, camelizeKeys };
