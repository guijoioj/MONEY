/**
 * Middleware de autorização por perfil (role).
 *
 * Hierarquia de perfis (campo `usuarios.tipo`):
 *   - 'admin'        → acesso total
 *   - 'recepcao'     → operação de salão (agenda, clientes, produtos, serviços, atendimentos, vendas)
 *   - 'profissional' → apenas dados vinculados ao próprio profissional (profissional_id)
 *
 * Uso:
 *   const { requireRole, requireAnyRole } = require('../middleware/role');
 *   router.post('/foo', authMiddleware, requireRole('admin'), handler);
 *   router.get('/bar',  authMiddleware, requireAnyRole(['admin','recepcao']), handler);
 *
 * Convenção:
 *   - `req.user.tipo` é o perfil (vem do JWT).
 *   - Em rotas onde role='profissional' é permitido, USAR `req.user.profissionalId`
 *     para filtrar listagens / proteger writes (defense-in-depth no service layer).
 */

const VALID_ROLES = ['admin', 'recepcao', 'profissional'];

function _denied(res, msg) {
  return res.status(403).json({
    success: false,
    error: msg || 'Você não tem permissão para acessar este recurso.',
  });
}

/**
 * requireRole('admin') | requireRole(['admin','recepcao'])
 */
function requireRole(roleOrRoles) {
  const allowed = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  // Validação defensiva: se passar role inválida, joga em tempo de carga
  for (const r of allowed) {
    if (!VALID_ROLES.includes(r)) {
      throw new Error(`requireRole: role inválida "${r}". Use: ${VALID_ROLES.join(', ')}`);
    }
  }
  return function (req, res, next) {
    const userRole = req.user?.tipo;
    if (!userRole) return _denied(res, 'Autenticação necessária');
    if (!allowed.includes(userRole)) {
      return _denied(res, `Acesso restrito (perfil exigido: ${allowed.join(' ou ')})`);
    }
    return next();
  };
}

/** Alias semântico para múltiplos roles */
const requireAnyRole = (roles) => requireRole(roles);

/**
 * isProfissionalScope(req)
 * Retorna true se o usuário logado é profissional e deve ter dados filtrados.
 * Em endpoints que aceitam admin/recepcao/profissional, use isso para decidir
 * se aplica WHERE profissional_id = req.user.profissionalId.
 */
function isProfissionalScope(req) {
  return req.user?.tipo === 'profissional';
}

/**
 * Helper: aplica filtro de profissional_id quando o usuário é profissional.
 * Retorna o valor do profissional_id (ou null se admin/recepcao).
 * Se for profissional sem profissional_id vinculado → 403 (config errada).
 *
 * Uso:
 *   const scopeId = scopedProfissionalId(req, res); if (scopeId === undefined) return;
 *   const sql = scopeId ? `... AND profissional_id = $X` : `...`;
 */
function scopedProfissionalId(req, res) {
  if (req.user?.tipo !== 'profissional') return null;
  const pid = req.user?.profissionalId;
  if (!pid) {
    res.status(403).json({
      success: false,
      error: 'Usuário profissional sem vínculo. Contate o administrador.',
    });
    return undefined;
  }
  return pid;
}

module.exports = {
  requireRole,
  requireAnyRole,
  isProfissionalScope,
  scopedProfissionalId,
  VALID_ROLES,
};
