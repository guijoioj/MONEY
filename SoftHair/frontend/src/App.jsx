import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Administrativo from './pages/Administrativo';
import Agenda from './pages/Agenda';
import Clientes from './pages/Clientes';
import ServicosEProdutos from './pages/ServicosEProdutos';
import Profissionais from './pages/Profissionais';
import Atendimentos from './pages/Atendimentos';
import Vendas from './pages/Vendas';
import Fechamento from './pages/Fechamento';
import Backup from './pages/Backup';
import Customizacao from './pages/Customizacao';
import Configuracoes from './pages/Configuracoes';
import Notificacoes from './pages/Notificacoes';
import Solicitacoes from './pages/Solicitacoes';
import Sync from './pages/Sync';

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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="administrativo" element={<Administrativo />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="solicitacoes" element={<Solicitacoes />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="servicos-e-produtos" element={<ServicosEProdutos />} />
        <Route path="servicos" element={<Navigate to="/servicos-e-produtos" replace />} />
        <Route path="produtos" element={<Navigate to="/servicos-e-produtos" replace />} />
        <Route path="profissionais" element={<Profissionais />} />
        <Route path="atendimentos" element={<Atendimentos />} />
        <Route path="vendas" element={<Vendas />} />
        <Route path="fechamento" element={<Fechamento />} />
        <Route path="backup" element={<Backup />} />
        <Route path="customizacao" element={<Customizacao />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="notificacoes" element={<Notificacoes />} />
        <Route path="sync" element={<Sync />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
