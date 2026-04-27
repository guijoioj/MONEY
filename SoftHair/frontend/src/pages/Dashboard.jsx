import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Treemap } from 'recharts';
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
  const [profissionais, setProfissionais] = useState([]);
  const [agendamentosHoje, setAgendamentosHoje] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [servicos, setServicos] = useState([]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [clientesRes, servicosRes, produtosRes, agendamentosRes, atendimentosRes, profissionaisRes] = await Promise.all([
        api.get('/clientes'),
        api.get('/servicos'),
        api.get('/produtos'),
        api.get('/agendamentos'),
        api.get('/atendimentos'),
        api.get('/profissionais', { params: { ativo: true } })
      ]);

      const clientesData = Array.isArray(clientesRes.data?.data) ? clientesRes.data.data : [];
      const servicosRaw = Array.isArray(servicosRes.data?.data) ? servicosRes.data.data : [];
      const servicosData = servicosRaw.filter(s => s.ativo);
      const produtos = Array.isArray(produtosRes.data?.data) ? produtosRes.data.data : [];
      const produtosAtivos = produtos.filter(p => p.ativo);
      const agendamentos = Array.isArray(agendamentosRes.data?.data) ? agendamentosRes.data.data : [];
      const atendimentos = Array.isArray(atendimentosRes.data?.data) ? atendimentosRes.data.data : [];
      const profissionaisLista = Array.isArray(profissionaisRes.data?.data) ? profissionaisRes.data.data : [];

      const produtosBaixoEstoque = produtos.filter(p => p.ativo && p.estoque <= p.estoqueMinimo && p.estoqueMinimo > 0);
      
      const hoje = new Date().toISOString().split('T')[0];
      const agendamentosHojeData = agendamentos.filter(a => a.dataHora && a.dataHora.startsWith(hoje));

      const totalAtendimentosMes = atendimentos.filter(a => {
        const dataAtendimento = new Date(a.data);
        const agora = new Date();
        return dataAtendimento.getMonth() === agora.getMonth() && dataAtendimento.getFullYear() === agora.getFullYear();
      });

      const receitaTotalMes = totalAtendimentosMes.reduce((sum, a) => sum + (a.totalGeral || 0), 0);

      const categoriaCount = {};
      produtosAtivos.forEach(p => {
        const cat = p.categoria || 'Sem Categoria';
        categoriaCount[cat] = (categoriaCount[cat] || 0) + 1;
      });
      const produtosPorCat = Object.entries(categoriaCount).map(([name, value]) => ({ name, value }));

      const valorTotalEstoque = produtosAtivos.reduce((sum, p) => sum + ((p.estoque || 0) * (p.precoVenda || 0)), 0);

      setStats({
        totalClientes: clientesData.length,
        totalServicos: servicosData.length,
        totalProdutos: produtosAtivos.length,
        produtosEstoqueBaixo: produtosBaixoEstoque.length,
        agendamentosHoje: agendamentosHojeData.length,
        atendimentosMes: totalAtendimentosMes.length,
        vendasMes: receitaTotalMes,
        valorTotalEstoque
      });

      setProdutosEstoqueBaixo(produtosBaixoEstoque);
      setProdutosPorCategoria(produtosPorCat);
      setTodosProdutos(produtos);
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
      loadDashboardData();
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Produtos por Categoria</h2>
              {produtosPorCategoria.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {produtosPorCategoria.length} {produtosPorCategoria.length === 1 ? 'categoria' : 'categorias'}
                  {!chartManual && <span className="ml-1 text-pink-400">(automático)</span>}
                </p>
              )}
            </div>
            {produtosPorCategoria.length > 0 && (
              <div className="flex gap-1">
                {CHART_TYPES.map(ct => (
                  <button
                    key={ct.id}
                    onClick={() => { setChartType(ct.id); setChartManual(true); }}
                    title={ct.label}
                    className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                      chartType === ct.id
                        ? 'bg-pink-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span className="mr-1">{ct.icon}</span>{ct.label}
                  </button>
                ))}
                {chartManual && (
                  <button
                    onClick={() => { setChartManual(false); setChartType(getAutoChartType(produtosPorCategoria.length)); }}
                    title="Voltar ao automático"
                    className="px-2 py-1 rounded text-xs text-gray-400 hover:text-pink-500 transition-colors"
                  >
                    auto
                  </button>
                )}
              </div>
            )}
          </div>

          {produtosPorCategoria.length > 0 ? (
            <ResponsiveContainer width="100%" height={chartType === 'barra-h' ? Math.max(250, produtosPorCategoria.length * 36) : 300}>
              {chartType === 'pizza' ? (
                <PieChart>
                  <Pie
                    data={produtosPorCategoria}
                    cx="50%"
                    cy="50%"
                    innerRadius={produtosPorCategoria.length > 3 ? 50 : 0}
                    outerRadius={100}
                    labelLine={produtosPorCategoria.length <= 6}
                    label={produtosPorCategoria.length <= 6
                      ? ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`
                      : false
                    }
                    dataKey="value"
                  >
                    {produtosPorCategoria.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                  <Legend />
                </PieChart>
              ) : chartType === 'barra-v' ? (
                <BarChart data={produtosPorCategoria} margin={{ top: 5, right: 20, left: 0, bottom: produtosPorCategoria.length > 5 ? 60 : 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={produtosPorCategoria.length > 5 ? -35 : 0} textAnchor={produtosPorCategoria.length > 5 ? 'end' : 'middle'} interval={0} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Produtos" radius={[4, 4, 0, 0]}>
                    {produtosPorCategoria.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : chartType === 'barra-h' ? (
                <BarChart data={produtosPorCategoria} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Produtos" radius={[0, 4, 4, 0]}>
                    {produtosPorCategoria.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <Treemap
                  data={produtosPorCategoria.map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }))}
                  dataKey="value"
                  aspectRatio={4 / 3}
                  content={({ x, y, width, height, name, value, fill }) => {
                    const showText = width > 40 && height > 30;
                    return (
                      <g>
                        <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={4} />
                        {showText && (
                          <>
                            <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={Math.min(13, width / 7)} fontWeight="600">
                              {name.length > 14 ? name.slice(0, 13) + '…' : name}
                            </text>
                            <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="#fff" fontSize={11}>
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

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between" style={{ backgroundColor: 'var(--color-primary)' }}>
            <div className="flex items-center gap-2">
              <Calendar className="text-white" size={18} />
              <h2 className="text-lg font-semibold text-white">Mini-Agenda</h2>
            </div>
            <button 
              onClick={() => navigate('/agenda')}
              className="flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg text-indigo-600 hover:bg-pink-50 text-sm font-medium transition-colors"
            >
              Expandir
              <ArrowUpRight size={14} />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="flex border-b bg-gray-50">
                <div className="w-16 flex-shrink-0 p-2" />
                {profissionais.slice(0, 4).map((profissional, idx) => {
                  const color = PROFISSIONAL_COLORS[idx % PROFISSIONAL_COLORS.length];
                  return (
                    <div key={profissional.id} className="flex-1 min-w-[120px] p-3 text-center border-l">
                      <div className={`w-10 h-10 rounded-full ${color.bg} flex items-center justify-center mx-auto mb-1`}>
                        <User size={18} className={color.text} />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{profissional.nome?.split(' ')[0]}</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="relative" style={{ minHeight: HORARIOS_AGENDA.length * 44, minWidth: 64 + profissionais.slice(0, 4).length * 120 }}>
                {HORARIOS_AGENDA.map((hora, horaIdx) => (
                  <div 
                    key={hora} 
                    className="flex border-b border-r" 
                    style={{ height: 44 }}
                  >
                    <div className="w-16 flex-shrink-0 p-2 text-right border-r bg-gray-50">
                      <span className="text-xs font-medium text-gray-600">{hora}</span>
                    </div>
                    {profissionais.slice(0, 4).map((profissional, profIdx) => {
                      return (
                        <div 
                          key={profissional.id} 
                          className={`flex-1 min-w-[120px] border-r relative ${horaIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                          onClick={() => navigate('/agenda')}
                        />
                      );
                    })}
                  </div>
                ))}
                
                {profissionais.slice(0, 4).map((profissional, profIdx) => {
                  const color = PROFISSIONAL_COLORS[profIdx % PROFISSIONAL_COLORS.length];
                  const agendamentosDoProf = agendamentosHoje.filter(a => a.profissionalId === profissional.id);
                  
                  return agendamentosDoProf.map((agend) => {
                    const horaAgend = agend.dataHora.split('T')[1]?.substring(0, 5);
                    const horaIdx = HORARIOS_AGENDA.indexOf(horaAgend);
                    if (horaIdx === -1) return null;
                    
                    const cliente = clientes.find(c => c.id === agend.clienteId);
                    const servico = servicos.find(s => s.id === agend.servicoId);
                    const duracao = servico?.duracao || 30;
                    const slots = Math.ceil(duracao / 30);
                    const top = horaIdx * 44;
                    const height = slots * 44;
                    const left = 64 + profIdx * 120;
                    
                    return (
                      <div
                        key={agend.id}
                        className={`absolute ${color.bg} border-l-2 ${color.border} p-1 rounded-r text-[10px] cursor-pointer hover:opacity-80 transition-opacity overflow-hidden z-20`}
                        style={{
                          top: `${top}px`,
                          left: `${left}px`,
                          width: '120px',
                          height: `${height}px`,
                        }}
                        onClick={() => navigate('/agenda')}
                      >
                        <div className={`font-semibold ${color.text} truncate text-[10px]`}>
                          {cliente?.nome || 'Cliente'}
                        </div>
                        <div className={`${color.text} opacity-75 truncate text-[9px]`}>
                          {servico?.nome || 'Serviço'}
                        </div>
                        {slots > 1 && (
                          <div className={`${color.text} opacity-60 text-[8px]`}>
                            ({duracao}min)
                          </div>
                        )}
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          </div>
          
          {agendamentosHoje.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Calendar className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">Nenhum agendamento para hoje</p>
            </div>
          )}
        </div>
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
