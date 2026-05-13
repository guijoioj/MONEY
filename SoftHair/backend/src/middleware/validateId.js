/**
 * Middleware that validates `req.params.id` is a positive integer.
 * Use as `router.param('id', validateId)` once per Router file, or per-route.
 * E28: evita 500 em vez de 404 quando id não-numérico chega na URL.
 */

function validateId(req, res, next, id) {
  const parsed = Number.parseInt(id, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(id)) {
    return res.status(400).json({ success: false, error: 'ID inválido' });
  }
  req.params.id = parsed;
  next();
}

module.exports = { validateId };
