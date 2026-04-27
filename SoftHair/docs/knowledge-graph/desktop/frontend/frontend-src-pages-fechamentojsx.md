# frontend/src/pages/Fechamento.jsx

**Repository:** Desktop
**File:** `frontend/src/pages/Fechamento.jsx`
**Language:** `jsx`

---

#desktop #source

## Resumo

Arquivo `frontend/src/pages/Fechamento.jsx` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
- [[domains/produtos|produtos]]
- [[domains/vendas|vendas]]
- [[domains/database|database]]
- [[domains/security|security]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```jsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fechamentosAPI, clientesAPI, profissionaisAPI, configuracoesAPI, creditosAPI } from '../services/api';
import { 
  Search, User, Package, Scissors, CreditCard, QrCode, Building, CheckCircle, 
  X, ChevronDown, ChevronUp, Clock, Phone, ShoppingBag, Receipt, DollarSign,
  Calendar, AlertCircle, Gift, Minus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro', icon: Building },
  { value: 'pix', label: 'PIX', icon: QrCode },
  { value: 'cartao_credito', label: 'Cartão Crédito', icon: CreditCard },
  { value: 'cartao_debito', label: 'Cartão Débito', icon: CreditCard },
];

export default function Fechamento() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('cliente');
  const [searchCliente, setSearchCliente] = useState('');
  const [selectedProfissional, setSelectedProfissional] = useState('');
  const [expandedBox, setExpandedBox] = useState(null);
  const [pagamentoModal, setPagamentoModal] = useState(null);
  const [sucesso, setSucesso] = useState(null);
  const [chavePix, setChavePix] = useState('');
  const [creditoDisponivel, setCreditoDisponivel] = useState(0);

  // Buscar saldo de crédito quando abre modal de pagamento
  const { data: creditoData } = useQuery({
    queryKey: ['credito-saldo', pagamentoModal?.clienteId],
    queryFn: () => {
      if (!pagamentoModal?.clienteId) return 0;
      return creditosAPI.getSaldo(pagamentoModal.clienteId);
    },
    enabled: !!pagamentoModal?.clienteId,
    onSuccess: (res) => {
      setCreditoDisponivel(res.data?.data?.saldo || 0);
    },
  });

  useEffect(() => {
    if (creditoData?.data?.data?.saldo !== undefined) {
      setCreditoDisponivel(creditoData.data.data.saldo);
    }
  }, [creditoData]);

  const { data: configData } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: () => configuracoesAPI.getAll(),
    onSuccess: (res) => {
      if (res.data?.chavePix) {
        setChavePix(res.data.chavePix);
      }
    },
  });

  useEffect(() => {
    if (configData?.data?.chavePix) {
      setChavePix(configData.data.chavePix);
    }
  }, [configData]);

  const { data: profissionaisData } = useQuery({
    queryKey: ['profissionais-dropdown'],
    queryFn: () => profissionaisAPI.getAll({ ativo: true }),
  });

  const { data: clientesData } = useQuery({
    queryKey: ['clientes-search'],
    queryFn: () => clientesAPI.getAll({ limit: 1000 }),
    enabled: searchCliente.length >= 2,
  });

  const { data: emAbertoData, isLoading } = useQuery({
    queryKey: ['fechamentos-em-aberto', activeTab, searchCliente, selectedProfissional],
    queryFn: () => {
      const params = {};
      if (activeTab === 'cliente' && searchCliente) {
        params.clienteNome = searchCliente;
      }
      if (activeTab === 'profissional' && selectedProfissional) {
        params.profissionalId = selectedProfissional;
      }
      return fechamentosAPI.getEmAberto(params);
    },
  });

  const fechamentoMutation = useMutation({
    mutationFn: (data) => fechamentosAPI.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['fechamentos-em-aberto']);
      queryClient.invalidateQueries(['atendimentos']);
      queryClient.invalidateQueries(['vendas']);
      queryClient.invalidateQueries(['agendamentos-calendario']);
      queryClient.invalidateQueries(['credito-saldo']);
      setPagamentoModal(null);
      setSucesso(res.data);
    },
  });

  const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    return timeStr;
  };

  const clientesEmAberto = Array.isArray(emAbertoData?.data?.data) ? emAbertoData.data.data : [];

  const handleFechar = (cliente) => {
    setPagamentoModal({
      ...cliente,
      formaPagamento: 'dinheiro',
      descontoGeral: 0,
      observacoes: ''
    });
  };

  const confirmarFechamento = () => {
    if (!pagamentoModal?.formaPagamento) {
      alert('Selecione a forma de pagamento');
      return;
    }

    const atendimentoIds = pagamentoModal.atendimentos?.map(a => a.id) || [];
    const vendaIds = pagamentoModal.vendas?.map(v => v.id) || [];

    if (atendimentoIds.length === 0 && vendaIds.length === 0) {
      alert('Não há atendimentos ou vendas para fechar');
      return;
    }

    const totalAtendimentos = pagamentoModal.atendimentos?.reduce((sum, a) => sum + (a.totalGeral || 0), 0) || 0;
    const totalVendas = pagamentoModal.vendas?.reduce((sum, v) => sum + (v.total || 0), 0) || 0;
    const totalProdutos = pagamentoModal.atendimentos?.reduce((sum, a) => sum + (a.totalProdutosCalc || 0), 0) || 0;
    const desconto = parseFloat(pagamentoModal.descontoGeral) || 0;
    const creditoUsado = pagamentoModal.usarCredito ? Math.min(creditoDisponivel, totalAtendimentos + totalVendas - desconto) : 0;
    const totalGeral = Math.max(0, totalAtendimentos + totalVendas - desconto - creditoUsado);

    const profissionalId = pagamentoModal.atendimentos?.[0]?.profissionalId || 
                          pagamentoModal.vendas?.[0]?.vendedorId || null;

    fechamentoMutation.mutate({
      clienteId: pagamentoModal.clienteId,
      profissionalId,
      data: new Date().toISOString().split('T')[0],
      totalAtendimentos,
      totalVendas,
      totalProdutos,
      descontoGeral: desconto + creditoUsado,
      totalGeral,
      formaPagamento: pagamentoModal.formaPagamento,
      observacoes: pagamentoModal.observacoes || null,
      atendimentoIds,
      vendaIds,
      creditoUtilizado: creditoUsado > 0 ? creditoUsado : null
    });
  };

  if (sucesso) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="bg-white rounded-2xl shadow-lg p-10">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-500" size={48} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Fechamento Realizado!</h2>
          <p className="text-gray-500 mb-6">O fechamento foi registrado com sucesso.</p>
          
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 flex items-center gap-2">
                <Scissors size={16} /> Atendimentos:
              </span>
              <span className="font-medium">{formatCurrency(sucesso.totalAtendimentos)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 flex items-center gap-2">
                <ShoppingBag size={16} /> Vendas:
              </span>
              <span className="font-medium">{formatCurrency(sucesso.totalVendas)}</span>
            </div>
            {sucesso.descontoGeral > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Desconto:</span>
                <span>-{formatCurrency(sucesso.descontoGeral)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xl border-t pt-3">
              <span>Total Pago:</span>
              <span className="text-indigo-600">{formatCurrency(sucesso.totalGeral)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500 pt-2 border-t">
              <span>Forma de Pagamento:</span>
              <span className="font-medium capitalize">
                {sucesso.formaPagamento?.replace('_', ' ') || '-'}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => { setSucesso(null); setSearchCliente(''); setSelectedProfissional(''); }}
              className="flex-1 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 font-medium transition-colors"
            >
              Novo Fechamento
            </button>
            <button 
              onClick={() => navigate('/atendimentos')}
              className="flex-1 border border-gray-300 py-3 rounded-xl hover:bg-gray-50 font-medium transition-colors"
            >
              Ver Atendimentos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Fechamentos</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-1 inline-flex">
        <button
          onClick={() => { setActiveTab('cliente'); setSelectedProfissional(''); }}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
            activeTab === 'cliente' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <User size={18} />
          Buscar por Cliente
        </button>
        <button
          onClick={() => { setActiveTab('profissional'); setSearchCliente(''); }}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
            activeTab === 'profissional' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Scissors size={18} />
          Buscar por Profissional
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        {activeTab === 'cliente' ? (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Digite o nome da cliente para buscar..."
              value={searchCliente}
              onChange={(e) => setSearchCliente(e.target.value)}
              className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
            />
            {searchCliente.length >= 2 && clientesData?.data?.data?.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
                {clientesData.data.data
                  .filter(c => c.nome.toLowerCase().includes(searchCliente.toLowerCase()))
                  .slice(0, 10)
                  .map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSearchCliente(c.nome); }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0 flex items-center gap-3"
                    >
                      <User size={16} className="text-gray-400" />
                      <div>
                        <p className="font-medium">{c.nome}</p>
                        <p className="text-sm text-gray-500">{c.telefone}</p>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Selecione o Profissional</label>
            <select
              value={selectedProfissional}
              onChange={(e) => setSelectedProfissional(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Selecione um profissional</option>
              {profissionaisData?.data?.data?.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Carregando fechamentos...</p>
          </div>
        ) : clientesEmAberto.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Nenhum fechamento pendente</h3>
            <p className="text-gray-500">
              {activeTab === 'cliente' 
                ? 'Digite o nome de uma cliente para buscar atendimentos e vendas em aberto.'
                : 'Selecione um profissional para ver os fechamentos pendentes.'}
            </p>
          </div>
        ) : (
          clientesEmAberto.map((cliente) => (
            <div 
              key={cliente.clienteId || 'sem-cliente'}
              className="bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300"
            >
              <button
                onClick={() => setExpandedBox(expandedBox === cliente.clienteId ? null : cliente.clienteId)}
                className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white">
                    <User size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-gray-800">{cliente.clienteNome}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {cliente.clienteTelefone && (
                        <span className="flex items-center gap-1">
                          <Phone size={14} /> {cliente.clienteTelefone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Scissors size={14} /> {cliente.atendimentos?.length || 0} atendimento(s)
                      </span>
                      <span className="flex items-center gap-1">
                        <ShoppingBag size={14} /> {cliente.vendas?.length || 0} venda(s)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-indigo-600">{formatCurrency(cliente.totalGeral)}</p>
                    <p className="text-sm text-gray-500">Total em aberto</p>
                  </div>
                  {expandedBox === cliente.clienteId ? (
                    <ChevronUp className="text-gray-400" size={24} />
                  ) : (
                    <ChevronDown className="text-gray-400" size={24} />
                  )}
                </div>
              </button>

              {expandedBox === cliente.clienteId && (
                <div className="border-t bg-gray-50 p-6 space-y-4">
                  {cliente.atendimentos?.map((atendimento, idx) => (
                    <div key={atendimento.id} className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Scissors size={16} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">Atendimento #{idx + 1}</p>
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                              <Calendar size={12} /> {formatDate(atendimento.data)}
                              <Clock size={12} /> {formatTime(atendimento.horaInicio)} - {formatTime(atendimento.horaFim)}
                            </p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-blue-600">{formatCurrency(atendimento.totalGeral)}</span>
                      </div>
                      
                      {atendimento.servicos?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Serviços</p>
                          <div className="flex flex-wrap gap-2">
                            {atendimento.servicos.map((s, si) => (
                              <span key={si} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                                {s.servicoNome}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {atendimento.produtos?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Produtos Utilizados</p>
                          <div className="space-y-1">
                            {atendimento.produtos.map((p, pi) => (
                              <div key={pi} className="flex justify-between text-sm">
                                <span className="text-gray-600">{p.produtoNome}</span>
                                <span className="text-gray-500">{p.quantidadeUsada} un × {formatCurrency(p.precoUnitario)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {atendimento.profissionalNome && (
                        <p className="text-xs text-gray-400 mt-2 pt-2 border-t">
                          Profissional: {atendimento.profissionalNome}
                        </p>
                      )}
                    </div>
                  ))}

                  {cliente.vendas?.map((venda, idx) => (
                    <div key={venda.id} className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <ShoppingBag size={16} className="text-green-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">Venda #{idx + 1}</p>
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                              <Calendar size={12} /> {formatDate(venda.data)}
                            </p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-green-600">{formatCurrency(venda.total)}</span>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">Produtos</p>
                        <div className="space-y-1">
                          {venda.itens?.map((item, ii) => (
                            <div key={ii} className="flex justify-between text-sm">
                              <span className="text-gray-600">{item.itemNome}</span>
                              <span className="text-gray-500">{item.quantidade} × {formatCurrency(item.precoUnitario)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {venda.vendedorNome && (
                        <p className="text-xs text-gray-400 mt-2 pt-2 border-t">
                          Vendedor: {venda.vendedorNome}
                        </p>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={() => handleFechar(cliente)}
                    className="w-full mt-4 bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <DollarSign size={20} />
                    Fechar Conta · {formatCurrency(cliente.totalGeral)}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {pagamentoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Finalizar Pagamento</h2>
                <p className="text-gray-500">{pagamentoModal.clienteNome}</p>
              </div>
              <button onClick={() => setPagamentoModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Atendimentos:</span>
                  <span className="font-medium">{formatCurrency(
                    pagamentoModal.atendimentos?.reduce((s, a) => s + (a.totalGeral || 0), 0) || 0
                  )}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Vendas:</span>
                  <span className="font-medium">{formatCurrency(
                    pagamentoModal.vendas?.reduce((s, v) => s + (v.total || 0), 0) || 0
                  )}</span>
                </div>
              </div>

              {creditoDisponivel > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="text-yellow-600" size={20} />
                      <span className="font-medium text-gray-700">Crédito disponível:</span>
                    </div>
                    <span className="text-lg font-bold text-yellow-700">{formatCurrency(creditoDisponivel)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="usarCredito"
                      checked={pagamentoModal.usarCredito || false}
                      onChange={(e) => setPagamentoModal({ ...pagamentoModal, usarCredito: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <label htmlFor="usarCredito" className="text-sm text-gray-600">
                      Usar crédito como desconto
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Desconto (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pagamentoModal.descontoGeral}
                  onChange={(e) => setPagamentoModal({ ...pagamentoModal, descontoGeral: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Forma de Pagamento</label>
                <div className="grid grid-cols-2 gap-3">
                  {FORMAS_PAGAMENTO.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPagamentoModal({ ...pagamentoModal, formaPagamento: value })}
                      className={`flex items-center justify-center gap-2 py-4 rounded-xl border-2 font-medium transition-all ${
                        pagamentoModal.formaPagamento === value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Icon size={20} />
                      {label}
                    </button>
                  ))}
                </div>
                {pagamentoModal.formaPagamento === 'pix' && chavePix && (
                  <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-sm font-medium text-purple-700 mb-2">Chave PIX para transferência:</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-purple-800 flex-1">{chavePix}</p>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(chavePix)}
                        className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                      >
                        Copiar
                      </button>
                    </div>
                    <p className="text-xs text-purple-600 mt-2">Copie e cole no app do banco para pagar</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                <textarea
                  value={pagamentoModal.observacoes}
                  onChange={(e) => setPagamentoModal({ ...pagamentoModal, observacoes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Observações sobre o fechamento..."
                />
              </div>

              <div className="bg-indigo-50 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-gray-700">Total a Pagar:</span>
                  <span className="text-2xl font-bold text-indigo-600">
                    {formatCurrency(
                      Math.max(0, 
                        (pagamentoModal.atendimentos?.reduce((s, a) => s + (a.totalGeral || 0), 0) || 0) +
                        (pagamentoModal.vendas?.reduce((s, v) => s + (v.total || 0), 0) || 0) -
                        (parseFloat(pagamentoModal.descontoGeral) || 0)
                      )
                    )}
                  </span>
                </div>
              </div>

              {fechamentoMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle size={18} />
                  Erro ao finalizar: {fechamentoMutation.error?.response?.data?.error || 'Tente novamente'}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setPagamentoModal(null)}
                  className="flex-1 py-4 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarFechamento}
                  disabled={fechamentoMutation.isPending}
                  className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <CheckCircle size={20} />
                  {fechamentoMutation.isPending ? 'Processando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```
