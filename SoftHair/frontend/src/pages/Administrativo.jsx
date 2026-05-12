import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  DollarSign, Receipt, Users, Package, Calculator, Calendar, 
  TrendingUp, CreditCard, FileText, ArrowLeft, Filter,
  ChevronDown, ChevronRight, Check, X, RefreshCw, Printer,
  AlertTriangle, Coins, BarChart3, ClipboardList, Gift, Edit3,
  RotateCcw
} from 'lucide-react';
import { 
  fechamentosAPI, atendimentosAPI, vendasAPI, clientesAPI, 
  profissionaisAPI, produtosAPI, agendamentosAPI, creditosAPI,
  comissoesAPI 
} from '../services/api';

export default function Administrativo() {
  const [activeSection, setActiveSection] = useState('checkouts');
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Administrativo</h1>
        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Gerenciamento financeiro e relatórios</p>
      </div>

      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <nav className="space-y-1">
              <MenuItem 
                active={activeSection === 'checkouts'} 
                onClick={() => setActiveSection('checkouts')}
                icon={<DollarSign size={18} />}
                title="Check Out"
              />
              <MenuItem 
                active={activeSection === 'faturamento'} 
                onClick={() => setActiveSection('faturamento')}
                icon={<TrendingUp size={18} />}
                title="Faturamento"
              />
              <MenuItem 
                active={activeSection === 'comissoes'} 
                onClick={() => setActiveSection('comissoes')}
                icon={<Coins size={18} />}
                title="Comissões"
              />
              <MenuItem 
                active={activeSection === 'relatorios'} 
                onClick={() => setActiveSection('relatorios')}
                icon={<BarChart3 size={18} />}
                title="Relatórios Gerais"
              />
            </nav>
          </div>
        </div>

        <div className="flex-1">
          {activeSection === 'checkouts' && <CheckOutSection />}
          {activeSection === 'faturamento' && <FaturamentoSection />}
          {activeSection === 'comissoes' && <ComissoesSection />}
          {activeSection === 'relatorios' && <RelatoriosSection />}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ active, onClick, icon, title }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
        active 
          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 font-medium' 
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'
      }`}
    >
      {icon}
      <span>{title}</span>
    </button>
  );
}

function CheckOutSection() {
  const [activeTab, setActiveTab] = useState('checkouts');
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [showEstornoModal, setShowEstornoModal] = useState(false);
  const [selectedFechamento, setSelectedFechamento] = useState(null);
  const [estornadosSession, setEstornadosSession] = useState([]);

  const { data: fechamentosData, isLoading, refetch } = useQuery({
    queryKey: ['checkouts', dataFiltro],
    queryFn: () => fechamentosAPI.getAll({ data: dataFiltro }),
  });

  const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

  const fechamentos = (fechamentosData?.data?.data || []).filter(f => !estornadosSession.some(e => e.id === f.id));

  const totalFechamentos = useMemo(() => {
    return fechamentos.reduce((sum, f) => sum + (f.totalGeral || 0), 0);
  }, [fechamentos]);

  const handleEstornar = (fechamento) => {
    setSelectedFechamento(fechamento);
    setShowEstornoModal(true);
  };

  const handleEstornoSuccess = () => {
    if (selectedFechamento) {
      setEstornadosSession(prev => [...prev, selectedFechamento]);
    }
    refetch();
    setShowEstornoModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DollarSign className="text-green-600" size={24} />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Controle de Caixas</h2>
          </div>
          <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg">
            <RefreshCw size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('checkouts')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'checkouts' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Check Out
          </button>
          <button
            onClick={() => setActiveTab('estornos')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'estornos' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Estornos ({estornadosSession.length})
          </button>
        </div>

        {activeTab === 'checkouts' && (
          <>
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Data</label>
                <input
                  type="date"
                  value={dataFiltro}
                  onChange={(e) => setDataFiltro(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Total do Dia</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(totalFechamentos)}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Fechamentos</p>
                <p className="text-2xl font-bold text-blue-700">{fechamentos.length}</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                <p className="text-sm text-purple-600 font-medium">Em Atendimentos</p>
                <p className="text-2xl font-bold text-purple-700">
                  {formatCurrency(fechamentos.reduce((sum, f) => sum + (f.totalAtendimentos || 0), 0))}
                </p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
                <p className="text-sm text-orange-600 font-medium">Em Vendas</p>
                <p className="text-2xl font-bold text-orange-700">
                  {formatCurrency(fechamentos.reduce((sum, f) => sum + (f.totalVendas || 0), 0))}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Profissional</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Atendimentos</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Vendas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">Carregando...</td>
                    </tr>
                  ) : fechamentos.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">Nenhum fechamento encontrado</td>
                    </tr>
                  ) : (
                    fechamentos.map((f) => (
                      <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{f.clienteNome || 'Consumidor Final'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(f.data)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{f.profissionalNome || '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(f.totalAtendimentos)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(f.totalVendas)}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(f.totalGeral)}</td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => handleEstornar(f)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:bg-red-900/30 rounded-lg"
                            title="Estornar"
                          >
                            <X size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'estornos' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Data</label>
              <input
                type="date"
                value={dataFiltro}
                onChange={(e) => setDataFiltro(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled
              />
            </div>

            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-600 font-medium">Total Estornado</p>
              <p className="text-2xl font-bold text-red-700">
                {formatCurrency(estornadosSession.reduce((sum, f) => sum + (f.totalGeral || 0), 0))}
              </p>
            </div>

            {estornadosSession.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400 dark:text-gray-500">
                <X size={48} className="mx-auto mb-4 opacity-50" />
                <p>Nenhum fechamento estornado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Profissional</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {estornadosSession.map((f) => (
                      <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 bg-red-50 dark:bg-red-900/30">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{f.clienteNome || 'Consumidor Final'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(f.data)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{f.profissionalNome || '-'}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(f.totalGeral)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {showEstornoModal && selectedFechamento && (
        <EstornoModal 
          fechamento={selectedFechamento} 
          onClose={() => setShowEstornoModal(false)} 
          onSuccess={handleEstornoSuccess}
        />
      )}
    </div>
  );
}

function EstornoModal({ fechamento, onClose, onSuccess }) {
  const [motivo, setMotivo] = useState('');
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const handleEstornar = async () => {
    if (!motivo.trim()) {
      alert('Informe o motivo do estorno');
      return;
    }
    if (!window.confirm('Tem certeza que deseja estornar este fechamento?')) {
      return;
    }
    onSuccess();
  };

  const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md">
        <div className="p-6 border-b flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Estornar Fechamento</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 font-medium">Atenção! Esta ação não pode ser desfeita.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Cliente</p>
              <p className="font-medium">{fechamento.clienteNome || 'Consumidor Final'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Total</p>
              <p className="font-bold text-red-600">{formatCurrency(fechamento.totalGeral)}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Motivo do Estorno *</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="Informe o motivo do estorno..."
            />
          </div>
        </div>

        <div className="p-6 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
          >
            Cancelar
          </button>
          <button
            onClick={handleEstornar}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Estornando...' : 'Confirmar Estorno'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FaturamentoSection() {
  const [activeReport, setActiveReport] = useState('analitico');
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);

  const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

  const { data: fechamentosData, isLoading: loadingFechamentos } = useQuery({
    queryKey: ['faturamento-fechamentos', dataInicio, dataFim],
    queryFn: () => fechamentosAPI.getAll({ dataInicio, dataFim }),
    enabled: !!dataInicio && !!dataFim,
  });

  const { data: atendimentosData, isLoading: loadingAtendimentos } = useQuery({
    queryKey: ['faturamento-atendimentos', dataInicio, dataFim],
    queryFn: () => atendimentosAPI.getAll({ dataInicio, dataFim }),
    enabled: !!dataInicio && !!dataFim,
  });

  const { data: vendasData, isLoading: loadingVendas } = useQuery({
    queryKey: ['faturamento-vendas', dataInicio, dataFim],
    queryFn: () => vendasAPI.getAll({ dataInicio, dataFim }),
    enabled: !!dataInicio && !!dataFim,
  });

  const fechamentos = fechamentosData?.data?.data || [];
  const atendimentos = atendimentosData?.data?.data || [];
  const vendas = vendasData?.data?.data || [];

  const totalFaturamento = useMemo(() => {
    return fechamentos.reduce((sum, f) => sum + (f.totalGeral || 0), 0);
  }, [fechamentos]);

  const totalServicos = useMemo(() => {
    return fechamentos.reduce((sum, f) => sum + (f.totalAtendimentos || 0), 0);
  }, [fechamentos]);

  const totalProdutos = useMemo(() => {
    return fechamentos.reduce((sum, f) => sum + (f.totalVendas || 0), 0);
  }, [fechamentos]);

  const porFormaPagamento = useMemo(() => {
    const map = {};
    fechamentos.forEach(f => {
      const forma = f.formaPagamento || 'não informado';
      map[forma] = (map[forma] || 0) + (f.totalGeral || 0);
    });
    return map;
  }, [fechamentos]);

  const porProfissional = useMemo(() => {
    const map = {};
    fechamentos.forEach(f => {
      const nome = f.profissionalNome || 'Não identificado';
      map[nome] = (map[nome] || 0) + (f.totalGeral || 0);
    });
    return map;
  }, [fechamentos]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="text-purple-600" size={24} />
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Faturamento</h2>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveReport('analitico')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'analitico' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Analítico
          </button>
          <button
            onClick={() => setActiveReport('profissional')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'profissional' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Por Profissional
          </button>
          <button
            onClick={() => setActiveReport('pagamento')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'pagamento' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Por Forma de Pagamento
          </button>
          <button
            onClick={() => setActiveReport('creditos')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'creditos' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Créditos na Casa
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium">Total Faturado</p>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(totalFaturamento)}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium">Serviços</p>
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalServicos)}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
            <p className="text-sm text-orange-600 font-medium">Produtos</p>
            <p className="text-2xl font-bold text-orange-700">{formatCurrency(totalProdutos)}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
            <p className="text-sm text-purple-600 font-medium">Fechamentos</p>
            <p className="text-2xl font-bold text-purple-700">{fechamentos.length}</p>
          </div>
        </div>

        {activeReport === 'analitico' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Profissional</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Forma Pagamento</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {fechamentos.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">Nenhum registro encontrado</td>
                  </tr>
                ) : (
                  fechamentos.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(f.data)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{f.clienteNome || 'Consumidor Final'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{f.profissionalNome || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 capitalize">{f.formaPagamento?.replace('_', ' ') || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(f.totalGeral)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 'profissional' && (
          <div className="space-y-4">
            {Object.entries(porProfissional).map(([nome, valor]) => (
              <div key={nome} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="font-medium text-gray-800 dark:text-gray-100">{nome}</span>
                <span className="font-bold text-indigo-600">{formatCurrency(valor)}</span>
              </div>
            ))}
          </div>
        )}

        {activeReport === 'pagamento' && (
          <div className="space-y-4">
            {Object.entries(porFormaPagamento).map(([forma, valor]) => (
              <div key={forma} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="font-medium text-gray-800 dark:text-gray-100 capitalize">{forma.replace('_', ' ')}</span>
                <span className="font-bold text-green-600">{formatCurrency(valor)}</span>
              </div>
            ))}
          </div>
        )}

        {activeReport === 'creditos' && (
          <CreditosNaCasaSection />
        )}
      </div>
    </div>
  );
}

function CreditosNaCasaSection() {
  const [showModal, setShowModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [creditoForm, setCreditoForm] = useState({ tipo: 'credito', valor: '', descricao: '' });

  const { data: creditosData, isLoading, refetch } = useQuery({
    queryKey: ['creditos-todos-com-saldo'],
    queryFn: () => creditosAPI.getTodosComSaldo(),
  });

  const { data: clientesData } = useQuery({
    queryKey: ['creditos-clientes-all'],
    queryFn: () => clientesAPI.getAll({ limit: 1000 }),
  });

  const creditosMutation = useMutation({
    mutationFn: (data) => creditosAPI.create(data),
    onSuccess: () => {
      refetch();
      setShowModal(false);
      setCreditoForm({ tipo: 'credito', valor: '', descricao: '' });
      setSelectedCliente(null);
    },
  });


  const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const clientesComSaldo = creditosData?.data?.data || [];
  const todosClientes = clientesData?.data?.data || [];

  const totalCreditos = useMemo(() => {
    return clientesComSaldo.reduce((sum, c) => sum + (c.saldo > 0 ? c.saldo : 0), 0);
  }, [clientesComSaldo]);

  const handleAdicionarCredito = (cliente) => {
    setSelectedCliente(cliente);
    setCreditoForm({ tipo: 'credito', valor: '', descricao: '' });
    setShowModal(true);
  };

  const handleSalvarCredito = () => {
    if (!selectedCliente?.id) {
      alert('Selecione um cliente');
      return;
    }
    if (!creditoForm.valor || parseFloat(creditoForm.valor) <= 0) {
      alert('Informe um valor válido');
      return;
    }
    creditosMutation.mutate({
      clienteId: selectedCliente.id,
      tipo: creditoForm.tipo,
      valor: parseFloat(creditoForm.valor),
      descricao: creditoForm.descricao || `${creditoForm.tipo === 'credito' ? 'Crédito' : 'Débito'} manual`
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">Clientes com Saldo de Créditos</h3>
        <button
          onClick={() => {
            setSelectedCliente({ id: null, nome: 'Selecione...' });
            setCreditoForm({ tipo: 'credito', valor: '', descricao: '' });
            setShowModal(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <Gift size={18} />
          Novo Crédito
        </button>
      </div>

      <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-green-600 font-medium">Total de Créditos na Casa</p>
        <p className="text-2xl font-bold text-green-700">{formatCurrency(totalCreditos)}</p>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">Carregando...</p>
      ) : clientesComSaldo.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 dark:text-gray-500">
          <Gift size={48} className="mx-auto mb-4 opacity-50" />
          <p>Nenhum crédito registrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clientesComSaldo.map((cliente) => (
            <div key={cliente.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100">{cliente.nome}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{cliente.telefone}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`font-bold ${cliente.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(cliente.saldo)}
                </span>
                <button
                  onClick={() => handleAdicionarCredito(cliente)}
                  className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-sm"
                >
                  +/- Crédito
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Gerenciar Crédito</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Cliente</label>
                <select
                  value={selectedCliente?.id || ''}
                  onChange={(e) => {
                    const cliente = todosClientes.find(c => c.id === e.target.value);
                    setSelectedCliente(cliente || null);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  <option value="">Selecione o cliente</option>
                  {todosClientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} - {c.telefone || 'Sem telefone'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Tipo</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setCreditoForm({ ...creditoForm, tipo: 'credito' })}
                    className={`flex-1 py-2 rounded-lg border ${
                      creditoForm.tipo === 'credito' 
                        ? 'bg-green-100 border-green-500 text-green-700' 
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    Crédito (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditoForm({ ...creditoForm, tipo: 'debito' })}
                    className={`flex-1 py-2 rounded-lg border ${
                      creditoForm.tipo === 'debito' 
                        ? 'bg-red-100 border-red-500 text-red-700' 
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    Débito (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={creditoForm.valor}
                  onChange={(e) => setCreditoForm({ ...creditoForm, valor: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Descrição</label>
                <input
                  type="text"
                  value={creditoForm.descricao}
                  onChange={(e) => setCreditoForm({ ...creditoForm, descricao: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  placeholder="Ex: Presente de aniversário"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarCredito}
                disabled={creditosMutation.isPending}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {creditosMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ComissoesSection() {
  const [activeReport, setActiveReport] = useState('realizadas');
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [showEditarComissoes, setShowEditarComissoes] = useState(false);
  const [comissoesEdit, setComissoesEdit] = useState({});
  const [pagarModal, setPagarModal] = useState(null);
  const [estornoModal, setEstornoModal] = useState(null);
  const [estornoMotivo, setEstornoMotivo] = useState('');
  const [pagosSession, setPagosSession] = useState(new Set());
  const [estornosSession, setEstornosSession] = useState([]);

  const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

  const queryClient = useQueryClient();

  const { data: profissionaisComissaoData, refetch: refetchProfissionais } = useQuery({
    queryKey: ['profissionais-comissoes-edit'],
    queryFn: () => profissionaisAPI.getAll({ ativo: true }),
  });

  const { data: comissoesPagasData, refetch: refetchPagas } = useQuery({
    queryKey: ['comissoes-pagas'],
    queryFn: () => comissoesAPI.getPagas(),
  });

  const { data: comissoesEstornosData, refetch: refetchEstornos } = useQuery({
    queryKey: ['comissoes-estornos'],
    queryFn: () => comissoesAPI.getEstornos(),
  });

  const updateComissaoMutation = useMutation({
    mutationFn: ({ id, comissao }) => profissionaisAPI.update(id, { comissao }),
    onSuccess: () => {
      refetchProfissionais();
      queryClient.invalidateQueries(['profissionais-comissoes']);
    },
  });


  const profissionaisLista = profissionaisComissaoData?.data?.data || [];
  
  const comissoesPagas = (comissoesPagasData?.data?.data || []).filter(c => 
    !estornosSession.some(e => e.id === c.id)
  );
  
  const comissoesEstornos = [
    ...(comissoesEstornosData?.data?.data || []),
    ...estornosSession
  ];

  const openEditarComissoes = () => {
    const initial = {};
    profissionaisLista.forEach(p => {
      initial[p.id] = p.comissao || 0;
    });
    setComissoesEdit(initial);
    setShowEditarComissoes(true);
  };

  const saveComissoes = () => {
    Object.entries(comissoesEdit).forEach(([id, comissao]) => {
      const prof = profissionaisLista.find(p => p.id === id);
      if (prof && prof.comissao !== comissao) {
        updateComissaoMutation.mutate({ id, comissao });
      }
    });
    setShowEditarComissoes(false);
  };

  const { data: profissionaisData } = useQuery({
    queryKey: ['profissionais-comissoes'],
    queryFn: () => profissionaisAPI.getAll({ ativo: true }),
  });

  const { data: fechamentosData } = useQuery({
    queryKey: ['comissoes-fechamentos', dataFiltro],
    queryFn: () => fechamentosAPI.getAll({ data: dataFiltro }),
  });

  const profissionais = profissionaisData?.data?.data || [];
  const fechamentos = fechamentosData?.data?.data || [];

  const comissoesPorProfissional = useMemo(() => {
    const map = {};
    fechamentos.forEach(f => {
      if (!f.profissionalId) return;
      const prof = profissionais.find(p => p.id === f.profissionalId);
      if (!map[f.profissionalId]) {
        map[f.profissionalId] = {
          profissionalId: f.profissionalId,
          nome: f.profissionalNome || prof?.nome || 'Não identificado',
          comissao: prof?.comissao || 10,
          totalVendido: 0,
          totalComissao: 0,
        };
      }
      map[f.profissionalId].totalVendido += (f.totalAtendimentos || 0);
      map[f.profissionalId].totalComissao = map[f.profissionalId].totalVendido * (map[f.profissionalId].comissao / 100);
    });
    return Object.values(map);
  }, [fechamentos, profissionais]);

  const totalComissoes = useMemo(() => {
    return comissoesPorProfissional.reduce((sum, c) => sum + c.totalComissao, 0);
  }, [comissoesPorProfissional]);

  const totalPagas = useMemo(() => {
    return comissoesPagas.reduce((sum, c) => sum + (c.valor || 0), 0);
  }, [comissoesPagas]);

  const totalEstornos = useMemo(() => {
    return comissoesEstornos.reduce((sum, e) => sum + (e.valor || 0), 0);
  }, [comissoesEstornos]);

  const handlePagar = (comissao) => {
    setPagarModal(comissao);
  };

  const handleEstornar = (comissaoPaga) => {
    setEstornoModal(comissaoPaga);
    setEstornoMotivo('');
  };

  const confirmarPagamento = () => {
    if (!pagarModal) return;
    setPagosSession(prev => new Set([...prev, pagarModal.profissionalId]));
    setPagarModal(null);
  };

  const confirmarEstorno = () => {
    if (!estornoModal || !estornoMotivo.trim()) {
      alert('Informe o motivo do estorno');
      return;
    }
    setEstornosSession(prev => [...prev, { ...estornoModal, motivo: estornoMotivo, createdAt: new Date().toISOString() }]);
    setEstornoModal(null);
    setEstornoMotivo('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Coins className="text-yellow-600" size={24} />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Comissões</h2>
          </div>
          <button
            onClick={openEditarComissoes}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
          >
            <Edit3 size={18} />
            Editar Comissões
          </button>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveReport('realizadas')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'realizadas' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Realizadas
          </button>
          <button
            onClick={() => setActiveReport('pagar')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'pagar' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            A Pagar
          </button>
          <button
            onClick={() => setActiveReport('pagas')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'pagas' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Pagas
          </button>
          <button
            onClick={() => setActiveReport('estornar')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'estornar' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Estorno de Pagamento ({comissoesEstornos.length})
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Data</label>
            <input
              type="date"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {activeReport === 'realizadas' && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
                <p className="text-sm text-yellow-600 font-medium">Total em Comissões</p>
                <p className="text-2xl font-bold text-yellow-700">{formatCurrency(totalComissoes)}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Profissionais</p>
                <p className="text-2xl font-bold text-blue-700">{comissoesPorProfissional.length}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Fechamentos</p>
                <p className="text-2xl font-bold text-green-700">{fechamentos.length}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Profissional</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Comissão %</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Total Vendido</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Valor Comissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {comissoesPorProfissional.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">Nenhum registro encontrado</td>
                    </tr>
                  ) : (
                    comissoesPorProfissional.map((c) => (
                      <tr key={c.profissionalId} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{c.nome}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{c.comissao}%</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(c.totalVendido)}</td>
                        <td className="px-4 py-3 text-right font-bold text-yellow-600">{formatCurrency(c.totalComissao)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeReport === 'pagar' && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
                <p className="text-sm text-orange-600 font-medium">Total a Pagar</p>
                <p className="text-2xl font-bold text-orange-700">{formatCurrency(totalComissoes)}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Profissionais</p>
                <p className="text-2xl font-bold text-blue-700">{comissoesPorProfissional.length}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Profissional</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Valor Comissão</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {comissoesPorProfissional.filter(c => !pagosSession.has(c.profissionalId)).length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">Nenhuma comissão pendente</td>
                    </tr>
                  ) : (
                    comissoesPorProfissional
                      .filter(c => !pagosSession.has(c.profissionalId))
                      .map((c) => (
                        <tr key={c.profissionalId} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                          <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{c.nome}</td>
                          <td className="px-4 py-3 text-right font-bold text-yellow-600">{formatCurrency(c.totalComissao)}</td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              onClick={() => handlePagar(c)}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              Pagar
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeReport === 'pagas' && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Total Pago</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPagas)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
                <p className="text-sm text-red-600 font-medium">Total Estornado</p>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(totalEstornos)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Profissional</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Valor</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {comissoesPagas.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">Nenhum pagamento registrado</td>
                    </tr>
                  ) : (
                    comissoesPagas.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{c.profissionalNome}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(c.dataPagamento)}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(c.valor)}</td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => handleEstornar(c)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-1"
                          >
                            <RotateCcw size={14} />
                            Estornar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeReport === 'estornar' && (
          <>
            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-600 font-medium">Total Estornado</p>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(totalEstornos)}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Profissional</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {comissoesEstornos.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">Nenhum estorno registrado</td>
                    </tr>
                  ) : (
                    comissoesEstornos.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{e.profissionalNome}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(e.createdAt)}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(e.valor)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{e.motivo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {showEditarComissoes && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Edit3 className="text-yellow-600" size={20} />
                  Editar Comissões dos Profissionais
                </h3>
                <button onClick={() => setShowEditarComissoes(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">
                  Altere o percentual de comissão de cada profissional. Este valor é usado para calcular o valor de comissão a pagar.
                </p>
                
                <div className="space-y-3">
                  {profissionaisLista.map((prof) => (
                    <div key={prof.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-100">{prof.nome}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{prof.especialidade || 'Sem especialidade'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={comissoesEdit[prof.id] ?? prof.comissao ?? 0}
                          onChange={(e) => setComissoesEdit({
                            ...comissoesEdit,
                            [prof.id]: parseFloat(e.target.value) || 0
                          })}
                          className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center"
                        />
                        <span className="text-gray-600 dark:text-gray-300 font-medium">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t flex gap-3">
                <button
                  onClick={() => setShowEditarComissoes(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveComissoes}
                  className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        )}

        {pagarModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md">
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Registrar Pagamento</h3>
                <button onClick={() => setPagarModal(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Profissional</p>
                  <p className="font-bold text-gray-800 dark:text-gray-100">{pagarModal.nome}</p>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Valor da Comissão</p>
                  <p className="text-2xl font-bold text-yellow-600">{formatCurrency(pagarModal.totalComissao)}</p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Data do Pagamento</p>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{formatDate(new Date().toISOString())}</p>
                </div>
              </div>

              <div className="p-6 border-t flex gap-3">
                <button
                  onClick={() => setPagarModal(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarPagamento}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </div>
          </div>
        )}

        {estornoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md">
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <RotateCcw className="text-red-600" size={20} />
                  Estornar Pagamento
                </h3>
                <button onClick={() => setEstornoModal(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 font-medium">Atenção! Esta ação não pode ser desfeita.</p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Profissional</p>
                  <p className="font-bold text-gray-800 dark:text-gray-100">{estornoModal.profissionalNome}</p>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Valor a Estornar</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(estornoModal.valor)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Motivo do Estorno *</label>
                  <textarea
                    value={estornoMotivo}
                    onChange={(e) => setEstornoMotivo(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    placeholder="Informe o motivo do estorno..."
                  />
                </div>
              </div>

              <div className="p-6 border-t flex gap-3">
                <button
                  onClick={() => setEstornoModal(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarEstorno}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Confirmar Estorno
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RelatoriosSection() {
  const [activeReport, setActiveReport] = useState('agenda');
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

  const { data: agendamentosData } = useQuery({
    queryKey: ['relatorio-agenda', dataFiltro],
    queryFn: () => agendamentosAPI.getAll({ data: dataFiltro }),
  });

  const { data: clientesData } = useQuery({
    queryKey: ['relatorio-clientes'],
    queryFn: () => clientesAPI.getAll({ limit: 1000 }),
  });

  const { data: profissionaisData } = useQuery({
    queryKey: ['relatorio-profissionais'],
    queryFn: () => profissionaisAPI.getAll({ ativo: true }),
  });

  const { data: produtosData } = useQuery({
    queryKey: ['relatorio-produtos'],
    queryFn: () => produtosAPI.getAll({ ativo: true }),
  });

  const agendamentos = agendamentosData?.data?.data || [];
  const clientes = clientesData?.data?.data || [];
  const profissionais = profissionaisData?.data?.data || [];
  const produtos = produtosData?.data?.data || [];

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const aniversariantes = useMemo(() => {
    return clientes.filter(c => {
      if (!c.dataNascimento) return false;
      const dt = new Date(c.dataNascimento);
      return dt.getMonth() === mesAtual;
    });
  }, [clientes, mesAtual]);

  const produtosEstoqueBaixo = useMemo(() => {
    return produtos.filter(p => p.estoque <= (p.estoqueMinimo || 0));
  }, [produtos]);

  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="text-blue-600" size={24} />
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Relatórios Gerais</h2>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveReport('agenda')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'agenda' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Agenda/Serviços
          </button>
          <button
            onClick={() => setActiveReport('aniversariantes')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'aniversariantes' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Aniversariantes
          </button>
          <button
            onClick={() => setActiveReport('profissionais')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'profissionais' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Profissionais
          </button>
          <button
            onClick={() => setActiveReport('estoque')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'estoque' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Estoque
          </button>
          <button
            onClick={() => setActiveReport('movimentacoes')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'movimentacoes' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Movimentações no Estoque
          </button>
          <button
            onClick={() => setActiveReport('precos')}
            className={`px-4 py-2 rounded-lg ${activeReport === 'precos' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
          >
            Tabela de Preços
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Data</label>
            <input
              type="date"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {activeReport === 'agenda' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Data/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Serviço</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Profissional</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {agendamentos.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">Nenhum agendamento encontrado</td>
                  </tr>
                ) : (
                  agendamentos.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(a.dataHora)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{a.clienteNome || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{a.servicoNome || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{a.profissionalNome || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          a.status === 'agendado' ? 'bg-blue-100 text-blue-700' :
                          a.status === 'confirmado' ? 'bg-green-100 text-green-700' :
                          a.status === 'cancelado' ? 'bg-red-100 text-red-700' :
                          a.status === 'convertido' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 'aniversariantes' && (
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Aniversariantes de {MESES[mesAtual]}</h3>
            {aniversariantes.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center py-8">Nenhum aniversariante neste mês</p>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {aniversariantes.map((c) => (
                  <div key={c.id} className="bg-pink-50 dark:bg-pink-900/30 rounded-lg p-4">
                    <p className="font-medium text-gray-800 dark:text-gray-100">{c.nome}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{c.telefone}</p>
                    <p className="text-sm text-pink-600 mt-1">
                      {new Date(c.dataNascimento).getDate()} de {MESES[new Date(c.dataNascimento).getMonth()]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeReport === 'profissionais' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Telefone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Especialidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {profissionais.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{p.nome}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.telefone || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.email || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.especialidade || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 'estoque' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">Produtos em Estoque</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{produtos.length} produtos</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Categoria</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Estoque</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Mínimo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Preço</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {produtos.map((p) => {
                    const estoqueBaixo = p.estoque <= (p.estoqueMinimo || 0);
                    return (
                      <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 ${estoqueBaixo ? 'bg-red-50 dark:bg-red-900/30' : ''}`}>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{p.nome}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.categoria || '-'}</td>
                        <td className={`px-4 py-3 text-right ${estoqueBaixo ? 'text-red-600 font-bold' : 'text-gray-600 dark:text-gray-300'}`}>
                          {p.estoque}
                          {estoqueBaixo && ' ⚠️'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{p.estoqueMinimo || 0}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.precoVenda)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'movimentacoes' && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">
            <Package size={48} className="mx-auto mb-4 opacity-50" />
            <p>Relatório de Movimentações em Desenvolvimento</p>
          </div>
        )}

        {activeReport === 'precos' && (
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Tabela de Preços - Serviços</h3>
            <div className="overflow-x-auto mb-8">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Serviço</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Categoria</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Duração</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Preço</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {produtosData?.data?.data?.filter(p => p.tipo === 'servico').map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{s.nome}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{s.categoria || '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{s.duracao || 30} min</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.preco)}
                      </td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan="4" className="px-4 py-4 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">Nenhum serviço cadastrado</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Tabela de Preços - Produtos</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Marca</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Custo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Venda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {produtos.filter(p => p.tipo === 'produto').map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{p.nome}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.marca || '-'}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.precoCusto || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.precoVenda)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
