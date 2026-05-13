import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

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

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function ElectronMenuBridge() {
  // P2-M4: escuta o IPC `navigate` enviado pelo menu do Electron e roteia
  // via react-router. Não precisa mais de `executeJavaScript` no main.
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron || typeof window.electron.onNavigate !== 'function') {
      return undefined;
    }
    const off = window.electron.onNavigate((route) => navigate(route));
    return () => { try { off && off(); } catch (_) { /* noop */ } };
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <>
      <ElectronMenuBridge />
      <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={lazyEl(Dashboard)} />
        <Route path="administrativo" element={lazyEl(Administrativo)} />
        <Route path="agenda" element={lazyEl(Agenda)} />
        <Route path="solicitacoes" element={lazyEl(Solicitacoes)} />
        <Route path="clientes" element={lazyEl(Clientes)} />
        <Route path="servicos-e-produtos" element={lazyEl(ServicosEProdutos)} />
        <Route path="servicos" element={<Navigate to="/servicos-e-produtos" replace />} />
        <Route path="produtos" element={<Navigate to="/servicos-e-produtos" replace />} />
        <Route path="profissionais" element={lazyEl(Profissionais)} />
        <Route path="atendimentos" element={lazyEl(Atendimentos)} />
        <Route path="vendas" element={lazyEl(Vendas)} />
        <Route path="fechamento" element={lazyEl(Fechamento)} />
        <Route path="backup" element={lazyEl(Backup)} />
        <Route path="despesas" element={lazyEl(Despesas)} />
        <Route path="financeiro" element={lazyEl(Financeiro)} />
        <Route path="customizacao" element={lazyEl(Customizacao)} />
        <Route path="configuracoes" element={lazyEl(Configuracoes)} />
        <Route path="notificacoes" element={lazyEl(Notificacoes)} />
        <Route path="caixa" element={lazyEl(Caixa)} />
        <Route path="metas" element={lazyEl(Metas)} />
        <Route path="relatorios" element={lazyEl(Relatorios)} />
        <Route path="sync" element={lazyEl(Sync)} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
