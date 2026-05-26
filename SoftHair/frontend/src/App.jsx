import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import RequireRole, { roleHome } from './components/RequireRole';

// Eager: auth pages (lightweight, first-paint critical)
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
// Lazy: post-login pages (heavy deps like recharts, dexie, etc.)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Administrativo = lazy(() => import('./pages/Administrativo'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Clientes = lazy(() => import('./pages/Clientes'));
const ServicosEProdutos = lazy(() => import('./pages/ServicosEProdutos'));
const Profissionais = lazy(() => import('./pages/Profissionais'));
const Atendimentos = lazy(() => import('./pages/Atendimentos'));
const Vendas = lazy(() => import('./pages/Vendas'));
const Fechamento = lazy(() => import('./pages/Fechamento'));
const Backup = lazy(() => import('./pages/Backup'));
const Despesas = lazy(() => import('./pages/Despesas'));
const Financeiro = lazy(() => import('./pages/Financeiro'));
const Customizacao = lazy(() => import('./pages/Customizacao'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const Notificacoes = lazy(() => import('./pages/Notificacoes'));
const Solicitacoes = lazy(() => import('./pages/Solicitacoes'));
const Caixa = lazy(() => import('./pages/Caixa'));
const Metas = lazy(() => import('./pages/Metas'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Sync = lazy(() => import('./pages/Sync'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const MinhaAgenda = lazy(() => import('./pages/MinhaAgenda'));
const MeusAtendimentos = lazy(() => import('./pages/MeusAtendimentos'));
const MinhasComissoes = lazy(() => import('./pages/MinhasComissoes'));
// V2: Comissões reescritas
const ComissoesV2 = lazy(() => import('./pages/ComissoesV2'));
const RegrasComissao = lazy(() => import('./pages/RegrasComissao'));
const ExtratoProfissional = lazy(() => import('./pages/ExtratoProfissional'));
const PagamentoComissao = lazy(() => import('./pages/PagamentoComissao'));
const ConfigurarServidor = lazy(() => import('./pages/ConfigurarServidor'));

function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
    </div>
  );
}

function lazyEl(Component) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

/** Guarda autenticação. RequireRole faz autorização. */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  if (user) return <Navigate to={roleHome(user.role)} replace />;
  return children;
}

/** Redireciona "/" para a home do role logado. */
function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={roleHome(user?.role)} replace />;
}

// Helpers de role-guard
const onlyAdmin = (el) => <RequireRole roles="admin">{el}</RequireRole>;
const adminOrRecepcao = (el) => <RequireRole roles={['admin', 'recepcao']}>{el}</RequireRole>;
const onlyProfissional = (el) => <RequireRole roles="profissional">{el}</RequireRole>;
const anyAuthed = (el) => <RequireRole roles={['admin', 'recepcao', 'profissional']}>{el}</RequireRole>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Home redireciona conforme role */}
        <Route index element={<RoleHomeRedirect />} />

        {/* Admin-only */}
        <Route path="dashboard"           element={onlyAdmin(lazyEl(Dashboard))} />
        <Route path="administrativo"      element={onlyAdmin(lazyEl(Administrativo))} />
        <Route path="comissoes-v2"        element={onlyAdmin(lazyEl(ComissoesV2))} />
        <Route path="comissoes/regras"    element={onlyAdmin(lazyEl(RegrasComissao))} />
        <Route path="comissoes/extrato/:id" element={onlyAdmin(lazyEl(ExtratoProfissional))} />
        <Route path="comissoes/pagamento" element={onlyAdmin(lazyEl(PagamentoComissao))} />
        <Route path="fechamento"          element={onlyAdmin(lazyEl(Fechamento))} />
        <Route path="financeiro"          element={onlyAdmin(lazyEl(Financeiro))} />
        <Route path="despesas"            element={onlyAdmin(lazyEl(Despesas))} />
        <Route path="caixa"               element={onlyAdmin(lazyEl(Caixa))} />
        <Route path="metas"               element={onlyAdmin(lazyEl(Metas))} />
        <Route path="relatorios"          element={onlyAdmin(lazyEl(Relatorios))} />
        <Route path="backup"              element={onlyAdmin(lazyEl(Backup))} />
        <Route path="usuarios"            element={onlyAdmin(lazyEl(Usuarios))} />
        <Route path="sync"                element={onlyAdmin(lazyEl(Sync))} />
        <Route path="customizacao"        element={onlyAdmin(lazyEl(Customizacao))} />
        <Route path="configuracoes"       element={onlyAdmin(lazyEl(Configuracoes))} />
        <Route path="configurar-servidor" element={onlyAdmin(lazyEl(ConfigurarServidor))} />

        {/* Admin + Recepção */}
        <Route path="agenda"              element={adminOrRecepcao(lazyEl(Agenda))} />
        <Route path="solicitacoes"        element={adminOrRecepcao(lazyEl(Solicitacoes))} />
        <Route path="clientes"            element={adminOrRecepcao(lazyEl(Clientes))} />
        <Route path="servicos-e-produtos" element={adminOrRecepcao(lazyEl(ServicosEProdutos))} />
        <Route path="servicos"            element={<Navigate to="/servicos-e-produtos" replace />} />
        <Route path="produtos"            element={<Navigate to="/servicos-e-produtos" replace />} />
        <Route path="profissionais"       element={adminOrRecepcao(lazyEl(Profissionais))} />
        <Route path="atendimentos"        element={adminOrRecepcao(lazyEl(Atendimentos))} />
        <Route path="vendas"              element={adminOrRecepcao(lazyEl(Vendas))} />

        {/* Profissional */}
        <Route path="minha-agenda"        element={onlyProfissional(lazyEl(MinhaAgenda))} />
        <Route path="meus-atendimentos"   element={onlyProfissional(lazyEl(MeusAtendimentos))} />
        <Route path="minhas-comissoes"    element={onlyProfissional(lazyEl(MinhasComissoes))} />

        {/* Qualquer role autenticada */}
        <Route path="notificacoes"        element={anyAuthed(lazyEl(Notificacoes))} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
