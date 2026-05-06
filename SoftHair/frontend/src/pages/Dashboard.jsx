import React, { useState, useEffect, useCallback } from 'react';

// Role helpers (espelhados de Agenda.jsx)
const ROLE_COLORS_DASH = {
  'Cabeleireiro': '#4F46E5', 'Barbeiro': '#7C3AED', 'Auxiliar': '#D97706',
  'Manicure': '#DB2777', 'Esteticista': '#059669', 'Depilador': '#DC2626',
  'Maquiador': '#0891B2', 'Massagista': '#7C3AED', 'Podólogo': '#065F46',
};
const normalizeRoleDash = (role) => {
  if (!role) return 'Outros';
  const n = role.toLowerCase();
  if (/cabeleir/.test(n)) return 'Cabeleireiro';
  if (/barbei/.test(n)) return 'Barbeiro';
  if (/manicur|pedicur/.test(n)) return 'Manicure';
  if (/depil/.test(n)) return 'Depilador';
  if (/maqui|designer|sobrancelh/.test(n)) return 'Maquiador';
  if (/auxiliar|assistente/.test(n)) return 'Auxiliar';
  if (/massag/.test(n)) return 'Massagista';
  if (/podól|podologo/.test(n)) return 'Podólogo';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
};
const getRoleColorDash = (role) => ROLE_COLORS_DASH[normalizeRoleDash(role)] || '#6B7280';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Treemap, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, RadialBarChart, RadialBar } from 'recharts';
import { Users, Package, AlertTriangle, TrendingUp, Calendar, DollarSign, ArrowUpRight, User, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const COLORS = [
  '#db2777','#ec4899','#f472b6','#fb923c','#facc15','#4ade80','#22d3ee','#818cf8',
  '#a855f7','#f43f5e','#10b981','#3b82f6','#f59e0b','#6366f1','#14b8a6','#ef4444',
  '#84cc16','#06b6d4','#8b5cf6','#f97316','#e11d48','#0ea5e9','#65a30d','#7c3aed',
];

const CHART_TYPES = [
  { id: 'pizza',   label: 'Pizza',      icon: '◕' },
  { id: 'barra-v', label: 'Barras',     icon: '▮' },
  { id: 'barra-h', label: 'Horizontal', icon: '▬' },
  { id: 'treemap', label: 'Treemap',    icon: '⊞' },
  { id: 'radial',  label: 'Radial',     icon: '◎' },
  { id: 'area',    label: 'Área',       icon: '◭' },
  { id: 'radar',   label: 'Radar',      icon: '⬡' },
];

const PROFISSIONAL_COLORS = [
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-400' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-400' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-400' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-400' },
];

const HORARIOS_AGENDA = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

function getAutoChartType(count) {
  if (count <= 5)  return 'pizza';
  if (count <= 10) return 'barra-v';
  if (count <= 20) return 'barra-h';
  return 'treemap';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalClientes: 0,
    totalServicos: 0,
    totalProdutos: 0,
    produtosEstoqueBaixo: 0,
    agendamentosHoje: 0,
    atendimentosMes: 0,
    vendasMes: 0,
    valorTotalEstoque: 0
  });
  const [loading, setLoading] = useState(true);
  const [produtosEstoqueBaixo, setProdutosEstoqueBaixo] = useState([]);
  const [produtosPorCategoria, setProdutosPorCategoria] = useState([]);
  const [todosProdutos, setTodosProdutos] = useState([]);
  const [chartType, setChartType] = useState(null);
  const [chartManual, setChartManual] = useState(false);
  const [miniExpanding, setMiniExpanding] = useState(false);
  const miniHeaderRef = React.useRef(null);
  const [profissionais, setProfissionais] = useState([]);
  const [agendamentosHoje, setAgendamentosHoje] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [servicos, setServicos] = useState([]);

  const loadDashboardData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      
      const [clientesRes, servicosRes, produtosRes, agendamentosRes, atendimentosRes, profissionaisRes] = await Promise.all([
        api.get('/clientes'),
        api.get('/servicos'),
        api.get('/produtos'),
        api.get('/agendamentos'),
        api.get('/atendimentos'),
        api.get('/profissionais', { params: { ativo: true } })
      ]);

      // helper: extrai array de respostas simples ou paginadas
      const toArr = (d) => Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];

      const clientesPaginado = clientesRes.data?.data;
      const clientesData = toArr(clientesPaginado);
      const totalClientesReal = clientesPaginado?.total ?? clientesData.length;
      const servicosRaw = toArr(servicosRes.data?.data);
      const servicosData = servicosRaw.filter(s => s.ativo);
      const produtos = toArr(produtosRes.data?.data);
      const produtosAtivos = produtos.filter(p => p.ativo);
      const agendamentos = toArr(agendamentosRes.data?.data);
      const atendimentos = toArr(atendimentosRes.data?.data);
      const profissionaisLista = toArr(profissionaisRes.data?.data);

      // normalizar campos snake_case → camelCase
      const norm = (a) => ({
        ...a,
        dataHora: a.dataHora || a.data_hora,
        data: a.data || a.data_inicio || a.data_hora,
        totalGeral: a.totalGeral ?? a.total_geral ?? a.valor_total ?? 0,
        estoque: a.estoque ?? a.quantidade_estoque ?? 0,
        estoqueMinimo: a.estoqueMinimo ?? a.quantidade_minima ?? 0,
        precoVenda: a.precoVenda ?? a.preco_venda ?? 0,
        clienteId: a.clienteId || a.cliente_id,
        profissionalId: a.profissionalId || a.profissional_id,
        servicoId: a.servicoId || a.servico_id,
        clienteNome: a.clienteNome || a.cliente_nome,
        profissionalNome: a.profissionalNome || a.profissional_nome,
        servicoNome: a.servicoNome || a.servico_nome,
        duracao_minutos: a.duracao_minutos || a.duracao,
      });

      const agendamentosNorm = agendamentos.map(norm);
      const atendimentosNorm = atendimentos.map(norm);
      const produtosNorm = produtos.map(norm);
      const produtosAtivosNorm = produtosNorm.filter(p => p.ativo);

      const produtosBaixoEstoque = produtosAtivosNorm.filter(p => p.estoque <= p.estoqueMinimo && p.estoqueMinimo > 0);

      const hoje = new Date().toISOString().split('T')[0];
      const agendamentosHojeData = agendamentosNorm.filter(a => a.dataHora && a.dataHora.startsWith(hoje));

      const agora = new Date();
      const totalAtendimentosMes = atendimentosNorm.filter(a => {
        const d = new Date(a.data);
        return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
      });

      const receitaTotalMes = totalAtendimentosMes.reduce((sum, a) => sum + (a.totalGeral || 0), 0);

      const categoriaCount = {};
      produtosAtivosNorm.forEach(p => {
        const cat = p.categoria || 'Sem Categoria';
        categoriaCount[cat] = (categoriaCount[cat] || 0) + 1;
      });
      const produtosPorCat = Object.entries(categoriaCount).map(([name, value]) => ({ name, value }));

      const valorTotalEstoque = produtosAtivosNorm.reduce((sum, p) => sum + (p.estoque * p.precoVenda), 0);

      setStats({
        totalClientes: totalClientesReal,
        totalServicos: servicosData.length,
        totalProdutos: produtosAtivosNorm.length,
        produtosEstoqueBaixo: produtosBaixoEstoque.length,
        agendamentosHoje: agendamentosHojeData.length,
        atendimentosMes: totalAtendimentosMes.length,
        vendasMes: receitaTotalMes,
        valorTotalEstoque
      });

      setProdutosEstoqueBaixo(produtosBaixoEstoque);
      setProdutosPorCategoria(produtosPorCat);
      setTodosProdutos(produtosNorm);
      setProfissionais(profissionaisLista);
      setClientes(clientesData);
      setServicos(servicosData);
      setAgendamentosHoje(agendamentosHojeData);
      
      if (!chartManual && produtosPorCat.length > 0) {
        setChartType(getAutoChartType(produtosPorCat.length));
      }

    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [chartManual]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const handleFocus = () => {
      loadDashboardData(false);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const statCards = [
    { label: 'Total de Clientes', value: stats.totalClientes, icon: Users, color: 'bg-pink-500' },
    { label: 'Serviços Ativos', value: stats.totalServicos, icon: TrendingUp, color: 'bg-purple-500' },
    { label: 'Produtos em Estoque', value: stats.totalProdutos, icon: Package, color: 'bg-blue-500' },
    { label: 'Agendamentos Hoje', value: stats.agendamentosHoje, icon: Calendar, color: 'bg-green-500' },
    { label: 'Atendimentos Mês', value: stats.atendimentosMes, icon: Calendar, color: 'bg-orange-500' },
    { label: 'Receita Mês', value: formatCurrency(stats.vendasMes), icon: DollarSign, color: 'bg-teal-500' },
    { label: 'Valor em Estoque', value: formatCurrency(stats.valorTotalEstoque), icon: Package, color: 'bg-indigo-500' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <button
          onClick={loadDashboardData}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
          title="Atualizar dados"
        >
          <RefreshCw size={18} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="text-white" size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats.produtosEstoqueBaixo > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="text-red-500" size={24} />
          <div>
            <p className="font-semibold text-red-700">Atenção: {stats.produtosEstoqueBaixo} produto(s) com estoque baixo!</p>
            <p className="text-sm text-red-600">Verifique a aba de Produtos para repor o estoque.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 2px 24px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.8) inset',
          }}
        >
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div>
              <h2 className="text-base font-semibold tracking-tight" style={{ color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
                Produtos por Categoria
              </h2>
              {produtosPorCategoria.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: 'rgba(100,100,120,0.6)' }}>
                  {produtosPorCategoria.length} categorias
                  {!chartManual && <span className="ml-1" style={{ color: 'var(--color-primary)', opacity: 0.7 }}>· auto</span>}
                </p>
              )}
            </div>
            {produtosPorCategoria.length > 0 && (
              <div className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.04)' }}>
                {CHART_TYPES.map(ct => (
                  <button
                    key={ct.id}
                    onClick={() => { setChartType(ct.id); setChartManual(true); }}
                    title={ct.label}
                    className="px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150"
                    style={chartType === ct.id
                      ? { background: 'white', color: 'var(--color-primary)', boxShadow: '0 1px 6px rgba(0,0,0,0.1)' }
                      : { background: 'transparent', color: 'rgba(80,80,100,0.6)' }
                    }
                  >
                    {ct.label}
                  </button>
                ))}
                {chartManual && (
                  <button
                    onClick={() => { setChartManual(false); setChartType(getAutoChartType(produtosPorCategoria.length)); }}
                    className="px-2 py-1 rounded-lg text-xs transition-all"
                    style={{ color: 'rgba(100,100,120,0.5)' }}
                  >auto</button>
                )}
              </div>
            )}
          </div>

          {produtosPorCategoria.length > 0 ? (
            <ResponsiveContainer width="100%" height={chartType === 'barra-h' ? Math.max(320, produtosPorCategoria.length * 38) : 360}>
              {chartType === 'pizza' ? (
                <PieChart>
                  <Pie
                    data={produtosPorCategoria}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={130}
                    paddingAngle={2}
                    labelLine={false}
                    label={false}
                    dataKey="value"
                  >
                    {produtosPorCategoria.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 13 }}
                    formatter={(value, name) => [`${value} produtos`, name]}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
                </PieChart>
              ) : chartType === 'barra-v' ? (
                <BarChart data={produtosPorCategoria} margin={{ top: 8, right: 16, left: 0, bottom: produtosPorCategoria.length > 5 ? 70 : 24 }}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgba(80,80,100,0.6)' }} angle={produtosPorCategoria.length > 5 ? -40 : 0} textAnchor={produtosPorCategoria.length > 5 ? 'end' : 'middle'} interval={0} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'rgba(80,80,100,0.6)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 13 }} />
                  <Bar dataKey="value" name="Produtos" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {produtosPorCategoria.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : chartType === 'barra-h' ? (
                <BarChart data={produtosPorCategoria} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="0" horizontal={false} stroke="rgba(0,0,0,0.06)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'rgba(80,80,100,0.6)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: 'rgba(80,80,100,0.7)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 13 }} />
                  <Bar dataKey="value" name="Produtos" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {produtosPorCategoria.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : chartType === 'radial' ? (
                <RadialBarChart
                  data={[...produtosPorCategoria].sort((a,b) => b.value - a.value).map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }))}
                  cx="50%" cy="50%" innerRadius="15%" outerRadius="90%"
                  startAngle={90} endAngle={-270}
                >
                  <RadialBar dataKey="value" background={{ fill: 'rgba(0,0,0,0.03)' }} label={{ position: 'insideStart', fill: '#fff', fontSize: 10, fontWeight: 600 }} />
                  <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" formatter={(v) => <span style={{ fontSize: 11, color: 'rgba(60,60,80,0.7)' }}>{v}</span>} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 13 }} formatter={(v, n) => [v, n]} />
                </RadialBarChart>
              ) : chartType === 'area' ? (
                <AreaChart data={produtosPorCategoria} margin={{ top: 8, right: 24, left: 0, bottom: produtosPorCategoria.length > 5 ? 70 : 24 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(80,80,100,0.6)' }} angle={produtosPorCategoria.length > 5 ? -40 : 0} textAnchor={produtosPorCategoria.length > 5 ? 'end' : 'middle'} interval={0} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'rgba(80,80,100,0.6)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 13 }} />
                  <Area type="monotone" dataKey="value" name="Produtos" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#areaGrad)" dot={{ fill: 'var(--color-primary)', r: 3 }} />
                </AreaChart>
              ) : chartType === 'radar' ? (
                <RadarChart data={produtosPorCategoria} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="rgba(0,0,0,0.08)" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(80,80,100,0.7)' }} />
                  <PolarRadiusAxis allowDecimals={false} tick={{ fontSize: 9, fill: 'rgba(80,80,100,0.5)' }} />
                  <Radar name="Produtos" dataKey="value" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.2} strokeWidth={2} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 13 }} />
                </RadarChart>
              ) : (
                <Treemap
                  data={produtosPorCategoria.map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }))}
                  dataKey="value"
                  aspectRatio={16 / 7}
                  content={({ x, y, width, height, name, value, fill }) => {
                    const showText = width > 50 && height > 36;
                    return (
                      <g>
                        <rect x={x} y={y} width={width} height={height} fill={fill} stroke="white" strokeWidth={3} />
                        {showText && (
                          <>
                            <text x={x + width / 2} y={y + height / 2 - 7} textAnchor="middle" fill="#fff" fontSize={Math.min(12, width / 8)} fontWeight="600" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                              {name.length > 14 ? name.slice(0, 13) + '…' : name}
                            </text>
                            <text x={x + width / 2} y={y + height / 2 + 9} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={10}>
                              {value} {value === 1 ? 'produto' : 'produtos'}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  }}
                />
              )}
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-10">Nenhum produto cadastrado</p>
          )}
        </div>

        <div style={{ order: -1 }}>
        {(() => {
          const handleExpand = () => {
            if (miniHeaderRef.current) {
              const rect = miniHeaderRef.current.getBoundingClientRect();
              // Criar clone flutuante que anima para a posição da barra de cargos da agenda real
              // A barra de cargos da agenda fica em: top≈56(nav)+80(pt-20)+titulo ≈ 160px, left=80px(sidebar)
              const clone = miniHeaderRef.current.cloneNode(true);
              clone.style.cssText = `
                position: fixed;
                top: ${rect.top}px;
                left: ${rect.left}px;
                width: ${rect.width}px;
                height: ${rect.height}px;
                z-index: 9999;
                pointer-events: none;
                transform-origin: top left;
                transition: none;
                border-radius: 0;
              `;
              document.body.appendChild(clone);
              requestAnimationFrame(() => {
                const sidebarW = 80;
                const targetLeft = sidebarW;
                const targetTop = 160; // aprox. posição da barra na agenda real
                const targetW = window.innerWidth - sidebarW;
                const scaleX = targetW / rect.width;
                const dx = targetLeft - rect.left;
                const dy = targetTop - rect.top;
                clone.style.transition = 'transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease 0.1s';
                clone.style.transform = `translate(${dx}px, ${dy}px) scaleX(${scaleX})`;
                clone.style.opacity = '0';
                setTimeout(() => clone.remove(), 500);
              });
            }
            setMiniExpanding(true);
            setTimeout(() => navigate('/agenda'), 460);
          };

          return (
          <div
            className={`rounded-2xl overflow-hidden ${miniExpanding ? 'mini-agenda-expanding' : ''}`}
            style={{
              background: 'rgba(255,255,255,0.65)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.6)',
              boxShadow: '0 2px 24px rgba(0,0,0,0.06)',
            }}
          >
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2">
              <Calendar size={16} style={{ color: 'var(--color-primary)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)', letterSpacing: '-0.01em' }}>Agenda de Hoje</h2>
            </div>
            <button
              onClick={handleExpand}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105"
              style={{ background: 'rgba(94,106,210,0.1)', color: 'var(--color-primary)' }}
            >
              Expandir
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="overflow-x-auto" ref={miniHeaderRef ? undefined : undefined}>
            {(() => {
              // Mesma lógica da agenda real: agrupar por cargo → ordenar grupos A-Z → ordenar profs A-Z dentro de cada grupo
              const seen = {};
              [...profissionais]
                .sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'))
                .forEach(p => {
                  const role = normalizeRoleDash(p.especialidade);
                  if (!seen[role]) seen[role] = { role, members: [] };
                  seen[role].members.push(p);
                });
              const groups = Object.values(seen).sort((a,b) => a.role < b.role ? -1 : a.role > b.role ? 1 : 0);
              const profs = groups.flatMap(g => g.members);
              const colW = 96;
              return (
            <div style={{ minWidth: 56 + profs.length * colW }}>
              {/* Barra de cargo */}
              <div className="flex" ref={miniHeaderRef} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="flex-shrink-0" style={{ width: 56 }} />
                {groups.map(({ role, members }) => {
                  const color = getRoleColorDash(role);
                  return (
                    <div key={role} className="flex items-center justify-center" style={{ width: members.length * colW, background: `${color}15`, height: 24, borderLeft: '1px solid rgba(255,255,255,0.4)' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color }}>{role}</span>
                    </div>
                  );
                })}
              </div>
              {/* Header profissionais */}
              <div className="flex sticky top-0" style={{ background: 'rgba(250,250,252,0.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="flex-shrink-0" style={{ width: 56 }} />
                {profs.map((profissional) => {
                  const color = getRoleColorDash(profissional.especialidade);
                  return (
                    <div key={profissional.id} className="flex flex-col items-center justify-center py-2 gap-0.5" style={{ width: colW, minWidth: colW, background: `${color}08`, borderLeft: '1px solid rgba(0,0,0,0.04)' }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${color}20`, border: `1.5px solid ${color}40` }}>
                        <User size={13} style={{ color }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(40,40,60,0.7)', letterSpacing: '-0.01em' }}>{profissional.nome?.split(' ')[0]}</span>
                    </div>
                  );
                })}
              </div>

              <div className="relative" style={{ minHeight: HORARIOS_AGENDA.length * 44, minWidth: 56 + profs.length * colW }}>
                {HORARIOS_AGENDA.map((hora, horaIdx) => (
                  <div key={hora} className="flex" style={{ height: 44, borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <div className="flex-shrink-0 flex items-start justify-end pr-2 pt-1" style={{ width: 56, background: 'rgba(248,248,252,0.6)', borderRight: '1px solid rgba(0,0,0,0.04)' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(50,50,80,0.45)' }}>{hora}</span>
                    </div>
                    {profs.map((profissional) => (
                      <div key={profissional.id} className="agenda-cell relative cursor-pointer"
                        style={{ width: colW, minWidth: colW, borderLeft: '1px solid rgba(0,0,0,0.04)', background: horaIdx % 2 === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(248,248,252,0.2)' }}
                        onClick={handleExpand} />
                    ))}
                  </div>
                ))}

                {profs.map((profissional, profIdx) => {
                  const roleColor = getRoleColorDash(profissional.especialidade);
                  const agendamentosDoProf = agendamentosHoje.filter(a => a.profissionalId === profissional.id);
                  
                  return agendamentosDoProf.map((agend) => {
                    const horaAgend = agend.dataHora.split('T')[1]?.substring(0, 5);
                    const horaIdx = HORARIOS_AGENDA.indexOf(horaAgend);
                    if (horaIdx === -1) return null;
                    
                    const cliente = clientes.find(c => c.id === agend.clienteId);
                    const servico = servicos.find(s => s.id === agend.servicoId);
                    const duracao = servico?.duracao_minutos || servico?.duracao || 30;
                    const slots = Math.ceil(duracao / 30);
                    const top = horaIdx * 44;
                    const height = slots * 44;
                    const left = 56 + profIdx * colW;

                    return (
                      <div
                        key={agend.id}
                        className="absolute p-1.5 rounded-lg text-[10px] cursor-pointer overflow-hidden z-20"
                        style={{
                          top: `${top}px`, left: `${left}px`,
                          width: `${colW}px`, height: `${height}px`,
                          background: `${roleColor}18`,
                          borderLeft: `2.5px solid ${roleColor}80`,
                          backdropFilter: 'blur(8px)',
                        }}
                        onClick={handleExpand}
                      >
                        <div style={{ fontWeight: 600, color: roleColor, fontSize: 10, opacity: 0.9 }} className="truncate">
                          {agend.clienteNome || 'Cliente'}
                        </div>
                        <div style={{ color: roleColor, fontSize: 9, opacity: 0.6 }} className="truncate">
                          {agend.servicoNome || servico?.nome || ''}
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
            );
          })()}
          </div>

          {agendamentosHoje.length === 0 && (
            <div className="py-8 text-center" style={{ color: 'rgba(100,100,130,0.5)' }}>
              <Calendar className="mx-auto mb-2 opacity-30" size={28} />
              <p className="text-xs">Nenhum agendamento para hoje</p>
            </div>
          )}
          </div>
          );
        })()}
        </div>

        {/* Gráfico — order:2 aparece depois da mini-agenda */}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Produtos com Reposição Necessária</h2>
        {produtosEstoqueBaixo.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Produto</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Categoria</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Estoque Atual</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Estoque Mínimo</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Faltam</th>
                </tr>
              </thead>
              <tbody>
                {produtosEstoqueBaixo.map((produto) => {
                  const estoqueAtual = produto.estoque || 0;
                  const estoqueMin = produto.estoqueMinimo || 0;
                  const falta = Math.max(0, estoqueMin - estoqueAtual);
                  return (
                    <tr key={produto.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{produto.nome}</td>
                      <td className="py-3 px-4 text-gray-600">{produto.categoria || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-sm ${
                          estoqueAtual === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {estoqueAtual} {produto.unidade || 'un'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">{estoqueMin} {produto.unidade || 'un'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-1 rounded-full text-sm bg-red-100 text-red-700 font-semibold">
                          {falta} {produto.unidade || 'un'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500">
            <Package size={48} className="mb-3 opacity-50" />
            <p>Todos os produtos estão com estoque adequado!</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Visão Geral do Estoque</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 font-semibold text-gray-600">Produto</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-600">Categoria</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-600">Estoque</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-600">Preço Unit.</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-600">Valor Total</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {todosProdutos.filter(p => p.ativo).slice(0, 15).map((produto) => {
                const estoqueAtual = produto.estoque || 0;
                const valorTotal = estoqueAtual * (produto.precoVenda || 0);
                const statusEstoque = estoqueAtual === 0 ? 'Esgotado' : 
                  estoqueAtual <= (produto.estoqueMinimo || 0) ? 'Baixo' : 'Normal';
                return (
                  <tr key={produto.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{produto.nome}</td>
                    <td className="py-3 px-4 text-gray-600">{produto.categoria || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        estoqueAtual === 0 ? 'bg-red-100 text-red-700' : 
                        estoqueAtual <= (produto.estoqueMinimo || 0) ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-green-100 text-green-700'
                      }`}>
                        {estoqueAtual} {produto.unidade || 'un'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">{formatCurrency(produto.precoVenda)}</td>
                    <td className="py-3 px-4 text-center font-medium">{formatCurrency(valorTotal)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        statusEstoque === 'Esgotado' ? 'bg-red-100 text-red-700' : 
                        statusEstoque === 'Baixo' ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-green-100 text-green-700'
                      }`}>
                        {statusEstoque}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
