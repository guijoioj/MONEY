import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Scissors,
  Package,
  Calendar,
  ShoppingCart,
  Settings,
  Database,
  LogOut,
  Menu,
  X,
  Palette,
  LayoutDashboard,
  Clock,
  User,
  ClipboardCheck,
  Bell,
  BarChart3,
  Inbox,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [notifCount, setNotifCount] = useState(0);
  const [solicitacoesCount, setSolicitacoesCount] = useState(0);
  const [popups, setPopups] = useState([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme_config');
    if (savedTheme) {
      const theme = JSON.parse(savedTheme);
      if (theme.logoUrl) setLogoUrl(theme.logoUrl);
    }
  }, []);

  useEffect(() => {
    const fetchNotifCount = async () => {
      try {
        const res = await api.get('/notificacoes');
        const lista = res.data?.data || [];
        setNotifCount(lista.filter(n => !n.lida).length);
      } catch {}
    };
    fetchNotifCount();
    const interval = setInterval(fetchNotifCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSolicitacoesCount = useCallback(async () => {
    try {
      const res = await api.get('/agendamentos', { params: { status: 'pendente' } });
      setSolicitacoesCount((res.data.data || []).length);
    } catch {}
  }, []);

  useEffect(() => {
    fetchSolicitacoesCount();
    const interval = setInterval(fetchSolicitacoesCount, 120000);
    return () => clearInterval(interval);
  }, [fetchSolicitacoesCount]);

  const handleWsMessage = useCallback((data) => {
    if (data.tipo === 'novo_pedido_agendamento') {
      const id = Date.now();
      setPopups((prev) => [...prev, { id, titulo: data.titulo, mensagem: data.mensagem, pedido: data.pedido }]);
      setSolicitacoesCount((prev) => prev + 1);
      setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), 8000);
    }
  }, []);

  useWebSocket('salao', user?.salonId, handleWsMessage);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const dismissPopup = (id) => setPopups((prev) => prev.filter((p) => p.id !== id));

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/administrativo', icon: BarChart3, label: 'Administrativo' },
    { to: '/agenda', icon: Calendar, label: 'Agenda' },
    { to: '/solicitacoes', icon: Inbox, label: 'Solicitações', badge: solicitacoesCount },
    { to: '/clientes', icon: Users, label: 'Clientes' },
    { to: '/servicos-e-produtos', icon: Scissors, label: 'Serviços e Produtos' },
    { to: '/profissionais', icon: User, label: 'Profissionais' },
    { to: '/atendimentos', icon: ClipboardCheck, label: 'Atendimentos' },
    { to: '/vendas', icon: ShoppingCart, label: 'Vendas' },
    { to: '/fechamento', icon: ClipboardCheck, label: 'Fechamento' },
    { to: '/backup', icon: Database, label: 'Backup' },
    { to: '/notificacoes', icon: Bell, label: 'Notificações', badge: notifCount },
    { to: '/customizacao', icon: Palette, label: 'Personalizar' },
    { to: '/configuracoes', icon: Settings, label: 'Configurações' },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Popups de solicitação em tempo real */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3" style={{ maxWidth: 360 }}>
        {popups.map((popup) => (
          <div
            key={popup.id}
            className="rounded-xl shadow-2xl p-4 flex gap-3 items-start animate-slide-in"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-primary)' }}
          >
            <div
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-lg"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Bell size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{popup.titulo}</p>
              <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--color-text)', opacity: 0.75 }}>{popup.mensagem}</p>
              <button
                onClick={() => { dismissPopup(popup.id); navigate('/solicitacoes'); }}
                className="mt-2 text-xs font-medium px-3 py-1 rounded-full text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Ver Solicitações
              </button>
            </div>
            <button
              onClick={() => dismissPopup(popup.id)}
              className="flex-shrink-0 p-1 rounded hover:opacity-70"
              style={{ color: 'var(--color-text)' }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <nav className="shadow-lg" style={{ backgroundColor: 'var(--color-primary)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                className="md:hidden p-2 rounded-md hover:opacity-80"
                style={{ color: 'white' }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <div className="flex items-center gap-3 ml-2 md:ml-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-8 w-auto" />
                ) : (
                  <Scissors className="text-white" size={24} />
                )}
                <h1 className="text-xl font-bold text-white">Salão de Beleza</h1>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              {navItems.slice(0, 5).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-1 px-3 py-2 rounded-md transition-colors ${
                      isActive ? 'bg-white bg-opacity-20 text-white' : 'text-white hover:bg-white hover:bg-opacity-10'
                    }`
                  }
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center ml-1">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <span className="hidden md:inline text-sm text-white">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="p-2 rounded-md hover:bg-white hover:bg-opacity-10 text-white"
                title="Sair"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        <aside
          className={`${
            sidebarOpen ? 'block' : 'hidden'
          } md:block w-64 shadow-lg fixed md:static inset-y-0 left-0 z-40 pt-16 md:pt-0`}
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <nav className="mt-4 px-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                    isActive ? 'text-white' : 'hover:opacity-80'
                  }`
                }
                style={({ isActive }) => ({
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                  backgroundColor: isActive ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                })}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6"><Outlet /></main>
      </div>
    </div>
  );
}
