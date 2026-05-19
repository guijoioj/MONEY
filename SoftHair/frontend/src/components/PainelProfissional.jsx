import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, User, DollarSign, TrendingUp, Users, Scissors, Package, Calendar, AlertCircle } from 'lucide-react';
import { profissionaisAPI } from '../services/api';

function formatBRL(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function formatCents(cents) {
  if (cents == null) return 'R$ 0,00';
  return formatBRL(Number(cents) / 100);
}

function StatusBadge({ ativo }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      ativo
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }`}>
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}

const COMISSOES_VAZIO = { qtd_total: 0, qtd_validas: 0, qtd_pendente: 0, qtd_paga: 0, qtd_estornada: 0, pendente_cents: 0, pago_cents: 0, estornada_cents: 0, total_cents: 0, ultima_comissao_em: null };
const VENDAS_VAZIO    = { qtd: 0, total_faturado: 0 };
const ATEND_VAZIO     = { qtd: 0, qtd_finalizados: 0, clientes_unicos: 0 };

export default function PainelProfissional() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [periodo, setPeriodo] = useState(() => {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return {
      data_inicio: inicio.toISOString().slice(0, 10),
      data_fim: hoje.toISOString().slice(0, 10),
    };
  });

  const { data: lista } = useQuery({
    queryKey: ['profissionais-busca', search],
    queryFn: () => profissionaisAPI.getAll({ search: search || undefined, ativo: true }),
    enabled: search.length >= 1,
    placeholderData: (prev) => prev,
  });

  const raw = lista?.data?.data;
  const profissionais = Array.isArray(raw) ? raw : [];

  const { data: painelData, isLoading: loadingPainel, isError: painelError } = useQuery({
    queryKey: ['profissional-painel', selectedId, periodo],
    queryFn: () => profissionaisAPI.getPainel(selectedId, periodo).then(r => r.data?.data),
    enabled: !!selectedId,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  // Acesso dual: backend tem middleware camelize, mas .catch fallback retorna
  // snake_case literal. Helper pega em qualquer um dos 2 formatos.
  const g = (obj, snake) => {
    if (!obj) return undefined;
    if (obj[snake] !== undefined) return obj[snake];
    const camel = snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return obj[camel];
  };

  const prof      = painelData?.profissional ?? {};
  const rawCom    = painelData?.resumoComissoes ?? painelData?.resumo_comissoes ?? COMISSOES_VAZIO;
  const rawVendas = painelData?.vendas ?? VENDAS_VAZIO;
  const rawAtend  = painelData?.atendimentos ?? ATEND_VAZIO;
  // Normaliza pra snake_case (forma usada no JSX)
  const comissoes = {
    qtd_total:        g(rawCom, 'qtd_total') ?? 0,
    qtd_validas:      g(rawCom, 'qtd_validas') ?? 0,
    qtd_pendente:     g(rawCom, 'qtd_pendente') ?? 0,
    qtd_paga:         g(rawCom, 'qtd_paga') ?? 0,
    qtd_estornada:    g(rawCom, 'qtd_estornada') ?? 0,
    pendente_cents:   g(rawCom, 'pendente_cents') ?? 0,
    pago_cents:       g(rawCom, 'pago_cents') ?? 0,
    estornada_cents:  g(rawCom, 'estornada_cents') ?? 0,
    total_cents:      g(rawCom, 'total_cents') ?? 0,
    ultima_comissao_em: g(rawCom, 'ultima_comissao_em') ?? null,
  };
  const vendas = {
    qtd: g(rawVendas, 'qtd') ?? 0,
    total_faturado: g(rawVendas, 'total_faturado') ?? 0,
  };
  const atend = {
    qtd: g(rawAtend, 'qtd') ?? 0,
    qtd_finalizados: g(rawAtend, 'qtd_finalizados') ?? 0,
    clientes_unicos: g(rawAtend, 'clientes_unicos') ?? 0,
  };
  const topCli    = Array.isArray(painelData?.topClientes)  ? painelData.topClientes  : (Array.isArray(painelData?.top_clientes)  ? painelData.top_clientes  : []);
  const topSrv    = Array.isArray(painelData?.topServicos)  ? painelData.topServicos  : (Array.isArray(painelData?.top_servicos)  ? painelData.top_servicos  : []);
  const topProd   = Array.isArray(painelData?.topProdutos)  ? painelData.topProdutos  : (Array.isArray(painelData?.top_produtos)  ? painelData.top_produtos  : []);

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Buscar profissional por nome
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Digite o nome..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {search && profissionais.length > 0 && (
          <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            {profissionais.slice(0, 20).map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedId(p.id); setSearch(p.nome); }}
                className={`w-full px-4 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center justify-between ${
                  selectedId === p.id ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <User size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{p.nome}</div>
                    {p.especialidade && <div className="text-xs text-gray-500">{p.especialidade}</div>}
                  </div>
                </div>
                <StatusBadge ativo={p.ativo} />
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedId && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
          Comece digitando o nome de um profissional acima para ver o painel completo.
        </div>
      )}

      {selectedId && loadingPainel && (
        <div className="text-center py-8 text-gray-500">Carregando painel...</div>
      )}

      {selectedId && painelError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">Erro ao carregar painel. Tente novamente.</p>
        </div>
      )}

      {selectedId && painelData && !painelError && (
        <>
          {/* Filtro de período */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">De</label>
              <input
                type="date"
                value={periodo.data_inicio}
                onChange={(e) => setPeriodo(p => ({ ...p, data_inicio: e.target.value }))}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Até</label>
              <input
                type="date"
                value={periodo.data_fim}
                onChange={(e) => setPeriodo(p => ({ ...p, data_fim: e.target.value }))}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm"
              />
            </div>
          </div>

          {/* Cabeçalho do profissional */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                  <User size={24} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{prof.nome || '—'}</h3>
                  {prof.especialidade && <p className="text-sm text-gray-500">{prof.especialidade}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge ativo={prof.ativo} />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Comissão padrão: <strong>{Number(prof.comissao_percentual || 0).toFixed(2)}%</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Cards de comissões */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-amber-500">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-amber-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">Pendente</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCents(comissoes.pendente_cents)}</p>
              <p className="text-xs text-gray-500">{comissoes.qtd_pendente} comissões</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-green-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">Pago</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCents(comissoes.pago_cents)}</p>
              <p className="text-xs text-gray-500">{comissoes.qtd_paga} comissões</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-red-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">Estornado</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCents(comissoes.estornada_cents)}</p>
              <p className="text-xs text-gray-500">{comissoes.qtd_estornada} comissões</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-indigo-500">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-indigo-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">Total</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCents(comissoes.total_cents)}</p>
              <p className="text-xs text-gray-500">{comissoes.qtd_total} comissões</p>
            </div>
          </div>

          {/* Vendas + Atendimentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <TrendingUp size={16} /> Vendas
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Quantidade</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{vendas.qtd}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Faturado</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatBRL(vendas.total_faturado)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Calendar size={16} /> Atendimentos
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{atend.qtd}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Finalizados</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{atend.qtd_finalizados}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Clientes únicos</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{atend.clientes_unicos}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Top clientes / serviços / produtos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Users size={16} className="text-pink-500" /> Top Clientes
              </h4>
              {topCli.length === 0 ? (
                <p className="text-xs text-gray-500">Sem atendimentos no período</p>
              ) : (
                <div className="space-y-2">
                  {topCli.map((c, i) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                        <span className="text-gray-900 dark:text-gray-100 truncate" title={c.nome}>{c.nome}</span>
                      </div>
                      <span className="text-xs text-gray-500">{c.qtd_atendimentos}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Scissors size={16} className="text-blue-500" /> Top Serviços
              </h4>
              {topSrv.length === 0 ? (
                <p className="text-xs text-gray-500">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {topSrv.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                        <span className="text-gray-900 dark:text-gray-100 truncate" title={s.nome}>{s.nome}</span>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">{s.qtd}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Package size={16} className="text-purple-500" /> Top Produtos
              </h4>
              {topProd.length === 0 ? (
                <p className="text-xs text-gray-500">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {topProd.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                        <span className="text-gray-900 dark:text-gray-100 truncate" title={p.nome}>{p.nome}</span>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">{p.qtd_unidades}u</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
