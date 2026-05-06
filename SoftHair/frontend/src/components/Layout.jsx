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
  Search,
  Plus,
  CalendarPlus,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherQuery, setLauncherQuery] = useState('');
  const [launcherIdx, setLauncherIdx] = useState(0);
  const launcherInputRef = useRef(null);

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

  const handleLogout = () => { logout(); navigate('/login'); };
  const dismissPopup = (id) => setPopups((prev) => prev.filter((p) => p.id !== id));

  const openLauncher = () => { setLauncherOpen(true); setLauncherQuery(''); setLauncherIdx(0); setTimeout(() => launcherInputRef.current?.focus(), 50); };
  const closeLauncher = () => { setLauncherOpen(false); setLauncherQuery(''); };

  // Keybind configurável
  const getLauncherBind = () => {
    try { return JSON.parse(localStorage.getItem('launcher_bind') || '{"key":"k","meta":true,"ctrl":false}'); } catch { return { key: 'k', meta: true, ctrl: false }; }
  };

  useEffect(() => {
    const handler = (e) => {
      const bind = getLauncherBind();
      const metaOk = bind.meta ? (e.metaKey || e.ctrlKey) : true;
      const ctrlOk = bind.ctrl ? e.ctrlKey : true;
      const keyMatch = e.key.toLowerCase() === bind.key.toLowerCase();
      if (keyMatch && metaOk && !e.shiftKey && !e.altKey) { e.preventDefault(); launcherOpen ? closeLauncher() : openLauncher(); }
      if (e.key === 'Escape') closeLauncher();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [launcherOpen]);

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

      {/* ── Navbar mínima ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 gap-3"
        style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(28px) saturate(200%)', WebkitBackdropFilter: 'blur(28px) saturate(200%)', borderBottom: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <button className="md:hidden p-2 rounded-xl hover:bg-black hover:bg-opacity-5" style={{ color: 'var(--color-text)' }} onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="flex items-center gap-2">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="h-7 w-auto" /> : (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-primary)' }}><Scissors size={14} className="text-white" /></div>
          )}
          <span className="font-semibold text-sm hidden md:inline" style={{ color: 'var(--color-text)', letterSpacing: '-0.01em' }}>Salão de Beleza</span>
        </div>

        {/* Trigger Raycast */}
        <div className="flex-1 flex justify-center">
          <button onClick={openLauncher}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)', color: 'rgba(80,80,110,0.55)', minWidth: 240 }}>
            <Search size={13} />
            <span className="flex-1 text-left text-xs">Buscar ou executar ação…</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded-md font-mono" style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(80,80,110,0.5)' }}>{(() => { const b = getLauncherBind(); return `${b.meta ? '⌘' : ''}${b.ctrl && !b.meta ? 'Ctrl+' : ''}${b.key.toUpperCase()}`; })()}</kbd>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate('/notificacoes')} className="relative p-2 rounded-xl hover:bg-black hover:bg-opacity-5" style={{ color: 'rgba(60,60,80,0.6)' }}>
            <Bell size={17} />
            {notifCount > 0 && <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{notifCount > 9 ? '9+' : notifCount}</span>}
          </button>
          {solicitacoesCount > 0 && (
            <button onClick={() => navigate('/solicitacoes')} className="relative p-2 rounded-xl hover:bg-black hover:bg-opacity-5" style={{ color: 'rgba(60,60,80,0.6)' }}>
              <Inbox size={17} />
              <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{solicitacoesCount > 9 ? '9+' : solicitacoesCount}</span>
            </button>
          )}
          <div className="w-px h-5 mx-1" style={{ background: 'rgba(0,0,0,0.1)' }} />
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-black hover:bg-opacity-5" style={{ color: 'rgba(60,60,80,0.6)' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--color-primary)' }}>{(user?.name || user?.email || 'U')[0].toUpperCase()}</div>
            <LogOut size={14} />
          </button>
        </div>
      </nav>

      {/* ── Raycast Launcher ── */}
      {launcherOpen && (() => {
        const allCommands = [
          { section: 'Navegar', items: navItems.map(n => ({ ...n, type: 'nav', action: () => { navigate(n.to); closeLauncher(); } })) },
          { section: 'Ações Rápidas', items: [
            { label: 'Novo Agendamento', icon: CalendarPlus, type: 'action', action: () => { navigate('/agenda?new=1'); closeLauncher(); } },
            { label: 'Novo Cliente', icon: Users, type: 'action', action: () => { navigate('/clientes?new=1'); closeLauncher(); } },
            { label: 'Nova Venda', icon: ShoppingCart, type: 'action', action: () => { navigate('/vendas?new=1'); closeLauncher(); } },
            { label: 'Novo Produto', icon: Package, type: 'action', action: () => { navigate('/servicos-e-produtos?new=produto'); closeLauncher(); } },
            { label: 'Sair', icon: LogOut, type: 'action', action: () => { closeLauncher(); handleLogout(); } },
          ]},
        ];
        const q = launcherQuery.toLowerCase();
        const filtered = allCommands.map(s => ({ ...s, items: s.items.filter(i => i.label.toLowerCase().includes(q)) })).filter(s => s.items.length > 0);
        const flat = filtered.flatMap(s => s.items);
        const safeIdx = Math.min(launcherIdx, flat.length - 1);

        const handleKey = (e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setLauncherIdx(i => Math.min(i + 1, flat.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setLauncherIdx(i => Math.max(i - 1, 0)); }
          if (e.key === 'Enter' && flat[safeIdx]) { flat[safeIdx].action(); }
          if (e.key === 'Escape') closeLauncher();
        };

        return (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[18vh]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) closeLauncher(); }}>
            <div className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: 'rgba(22,22,28,0.97)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <Search size={16} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                <input ref={launcherInputRef} value={launcherQuery}
                  onChange={e => { setLauncherQuery(e.target.value); setLauncherIdx(0); }}
                  onKeyDown={handleKey}
                  placeholder="Buscar ou executar ação…"
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'rgba(255,255,255,0.9)', caretColor: 'var(--color-primary)' }}
                  spellCheck={false} autoComplete="off" />
                <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>esc</kbd>
              </div>
              {/* Results */}
              <div className="max-h-[340px] overflow-y-auto py-2">
                {filtered.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>Nenhum resultado</p>
                ) : (
                  filtered.map(section => (
                    <div key={section.section}>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>{section.section}</p>
                      {section.items.map(item => {
                        const globalIdx = flat.indexOf(item);
                        const isSelected = globalIdx === safeIdx;
                        return (
                          <button key={item.label} onClick={item.action}
                            onMouseEnter={() => setLauncherIdx(globalIdx)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 transition-all text-left"
                            style={{ background: isSelected ? 'rgba(94,106,210,0.25)' : 'transparent', borderLeft: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent' }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: isSelected ? 'rgba(94,106,210,0.3)' : 'rgba(255,255,255,0.07)' }}>
                              <item.icon size={15} style={{ color: isSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.5)' }} />
                            </div>
                            <span className="text-sm" style={{ color: isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)', fontWeight: isSelected ? 500 : 400 }}>
                              {item.label}
                            </span>
                            {item.badge > 0 && <span className="ml-auto bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">{item.badge}</span>}
                            {isSelected && <span className="ml-auto text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>↵</span>}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
              {/* Footer */}
              <div className="px-4 py-2.5 flex items-center gap-3 text-[10px]" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }}>
                <span><kbd className="font-mono">↑↓</kbd> navegar</span>
                <span><kbd className="font-mono">↵</kbd> executar</span>
                <span><kbd className="font-mono">esc</kbd> fechar</span>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex">
        <aside
          className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex flex-col fixed inset-y-0 left-0 z-40 pt-16 pb-6 px-3`}
          style={{ width: '72px' }}
        >
          <nav className="flex flex-col gap-1 flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                title={item.label}
                className={({ isActive }) =>
                  `group relative flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-2xl transition-all duration-200 cursor-pointer ${
                    isActive ? 'shadow-lg' : 'hover:scale-105'
                  }`
                }
                style={({ isActive }) => ({
                  background: isActive
                    ? 'rgba(255,255,255,0.35)'
                    : 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  border: isActive
                    ? '1px solid rgba(255,255,255,0.5)'
                    : '1px solid rgba(255,255,255,0.15)',
                  boxShadow: isActive
                    ? '0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.4)'
                    : 'none',
                  color: isActive ? 'var(--color-primary)' : 'rgba(80,80,100,0.85)',
                })}
              >
                <item.icon size={20} />
                <span style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.02em', lineHeight: 1 }}>
                  {item.label.split(' ')[0]}
                </span>
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 md:ml-20 pt-20"><Outlet /></main>
      </div>
    </div>
  );
}
