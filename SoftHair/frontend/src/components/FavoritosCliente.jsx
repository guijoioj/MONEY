import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, User, Heart, Scissors, Package, Clock } from 'lucide-react';
import { clientesAPI, profissionaisAPI } from '../services/api';

function formatBRL(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(value));
}

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); }
  catch { return '—'; }
}

export default function FavoritosCliente() {
  const [searchProf, setSearchProf] = useState('');
  const [selectedProfId, setSelectedProfId] = useState(null);
  const [searchCli, setSearchCli] = useState('');
  const [selectedCliId, setSelectedCliId] = useState(null);

  // Busca profissional
  const { data: profsData } = useQuery({
    queryKey: ['busca-prof-favoritos', searchProf],
    queryFn: () => profissionaisAPI.getAll({ search: searchProf || undefined, ativo: true }),
    enabled: searchProf.length >= 1,
    placeholderData: (prev) => prev,
  });
  const profissionais = profsData?.data?.data || profsData?.data || [];

  // Busca cliente
  const { data: clisData } = useQuery({
    queryKey: ['busca-cli-favoritos', searchCli],
    queryFn: () => clientesAPI.getAll({ search: searchCli || undefined }),
    enabled: searchCli.length >= 1,
    placeholderData: (prev) => prev,
  });
  const clientes = clisData?.data?.data || clisData?.data || [];

  // Carrega favoritos quando ambos selecionados
  const { data: favData, isLoading } = useQuery({
    queryKey: ['favoritos-cliente', selectedProfId, selectedCliId],
    queryFn: () => profissionaisAPI.getClienteFavoritos(selectedProfId, selectedCliId).then(r => r.data?.data),
    enabled: !!selectedProfId && !!selectedCliId,
  });

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 border border-pink-200 dark:border-pink-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-pink-900 dark:text-pink-200 flex items-center gap-2">
          <Heart size={16} /> Favoritos do Cliente
        </h3>
        <p className="text-xs text-pink-700 dark:text-pink-300 mt-1">
          Busca o profissional + cliente. Mostra serviços e produtos preferidos da cliente.
        </p>
      </div>

      {/* Busca profissional */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          1. Profissional
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchProf}
            onChange={(e) => { setSearchProf(e.target.value); setSelectedProfId(null); }}
            placeholder="Nome do profissional..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
          />
        </div>
        {searchProf && !selectedProfId && profissionais.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            {profissionais.slice(0, 15).map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedProfId(p.id); setSearchProf(p.nome); }}
                className="w-full px-3 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <User size={14} className="text-indigo-600" />
                  <span className="text-sm">{p.nome}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        {selectedProfId && (
          <div className="mt-2 text-xs text-green-700 dark:text-green-400">
            ✓ Profissional selecionado
          </div>
        )}
      </div>

      {/* Busca cliente (só aparece após profissional selecionado) */}
      {selectedProfId && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            2. Cliente
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchCli}
              onChange={(e) => { setSearchCli(e.target.value); setSelectedCliId(null); }}
              placeholder="Nome do cliente..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            />
          </div>
          {searchCli && !selectedCliId && clientes.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              {clientes.slice(0, 15).map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCliId(c.id); setSearchCli(c.nome); }}
                  className="w-full px-3 py-2 text-left hover:bg-pink-50 dark:hover:bg-pink-900/20 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <Heart size={14} className="text-pink-600" />
                    <div>
                      <div className="text-sm font-medium">{c.nome}</div>
                      {c.telefone && (
                        <div className="text-xs text-gray-500">{c.telefone}</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resultados */}
      {selectedProfId && selectedCliId && isLoading && (
        <div className="text-center py-6 text-gray-500">Carregando favoritos...</div>
      )}

      {favData && (
        <>
          <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4 border border-pink-200 dark:border-pink-800">
            <h3 className="text-lg font-bold text-pink-900 dark:text-pink-200 flex items-center gap-2">
              <User size={20} />
              {favData.cliente.nome}
            </h3>
            {favData.cliente.telefone && (
              <p className="text-sm text-pink-700 dark:text-pink-300">{favData.cliente.telefone}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Serviços favoritos */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Scissors size={16} className="text-blue-500" />
                Serviços Preferidos
              </h4>
              {!favData.servicos_favoritos?.length ? (
                <p className="text-xs text-gray-500">Sem serviços registrados</p>
              ) : (
                <div className="space-y-2">
                  {favData.servicos_favoritos.map((s, i) => (
                    <div key={s.id} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0 pb-2 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {s.nome}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          {s.qtd}× · {formatBRL(s.preco)}
                        </span>
                      </div>
                      {s.categoria && (
                        <p className="text-xs text-gray-400 ml-7">{s.categoria}</p>
                      )}
                      <p className="text-xs text-gray-500 ml-7 flex items-center gap-1">
                        <Clock size={10} /> Último: {formatDate(s.ultimo_uso)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Produtos favoritos */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Package size={16} className="text-purple-500" />
                Produtos Preferidos
              </h4>
              {!favData.produtos_favoritos?.length ? (
                <p className="text-xs text-gray-500">Sem produtos comprados</p>
              ) : (
                <div className="space-y-2">
                  {favData.produtos_favoritos.map((p, i) => (
                    <div key={p.id} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0 pb-2 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {p.nome}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          {p.qtd_unidades}u · {formatBRL(p.preco_venda)}
                        </span>
                      </div>
                      {p.categoria && (
                        <p className="text-xs text-gray-400 ml-7">{p.categoria}</p>
                      )}
                      <p className="text-xs text-gray-500 ml-7 flex items-center gap-1">
                        <Clock size={10} /> Última: {formatDate(p.ultima_compra)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Últimas visitas */}
          {favData.ultimas_visitas?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Clock size={16} />
                Últimas visitas com você
              </h4>
              <div className="space-y-1">
                {favData.ultimas_visitas.map((v) => (
                  <div key={v.id} className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0 pb-1 last:pb-0">
                    <span className="text-gray-700 dark:text-gray-300">{formatDate(v.created_at)}</span>
                    <span className="text-xs text-gray-500">{v.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
