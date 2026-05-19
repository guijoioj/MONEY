import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, User, Heart, Scissors, Package, Clock, AlertCircle } from 'lucide-react';
import { clientesAPI, profissionaisAPI } from '../services/api';

function formatBRL(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); }
  catch { return '—'; }
}

function toArr(val) {
  if (Array.isArray(val)) return val;
  // resposta paginada: { data: [...], total: N }
  if (val && Array.isArray(val.data)) return val.data;
  return [];
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
  const profissionais = toArr(profsData?.data?.data);

  // Busca cliente — resposta paginada { data: [...], total: N }
  const { data: clisData } = useQuery({
    queryKey: ['busca-cli-favoritos', searchCli],
    queryFn: () => clientesAPI.getAll({ search: searchCli || undefined }),
    enabled: searchCli.length >= 1,
    placeholderData: (prev) => prev,
  });
  const clientes = toArr(clisData?.data?.data);

  // Carrega favoritos quando ambos selecionados
  const { data: favData, isLoading, isError } = useQuery({
    queryKey: ['favoritos-cliente', selectedProfId, selectedCliId],
    queryFn: () => profissionaisAPI.getClienteFavoritos(selectedProfId, selectedCliId).then(r => r.data?.data),
    enabled: !!selectedProfId && !!selectedCliId,
    retry: 1,
  });

  // Backend tem middleware camelize → converte snake → camel.
  // JSX abaixo usa snake_case. Normaliza pra snake antes de usar.
  const snakeize = (v) => {
    if (Array.isArray(v)) return v.map(snakeize);
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      const out = {};
      for (const k of Object.keys(v)) {
        const snk = k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
        out[snk] = snakeize(v[k]);
      }
      return out;
    }
    return v;
  };

  const cliente             = snakeize(favData?.cliente ?? {});
  // Payload pode vir como profissional_favorito (catch) OU profissionalFavorito (camelize)
  const profissionalFav     = snakeize(favData?.profissional_favorito ?? favData?.profissionalFavorito ?? null);
  const servicosFav         = snakeize(toArr(favData?.servicos_favoritos ?? favData?.servicosFavoritos));
  const produtosFav         = snakeize(toArr(favData?.produtos_favoritos ?? favData?.produtosFavoritos));
  const servicosComProf     = snakeize(toArr(favData?.servicos_com_este_profissional ?? favData?.servicosComEsteProfissional));
  const produtosComProf     = snakeize(toArr(favData?.produtos_com_este_profissional ?? favData?.produtosComEsteProfissional));
  const ultimasVisitas      = snakeize(toArr(
    favData?.ultimas_visitas_com_este_profissional
    ?? favData?.ultimasVisitasComEsteProfissional
    ?? favData?.ultimas_visitas
    ?? favData?.ultimasVisitas
  ));

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 border border-pink-200 dark:border-pink-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-pink-900 dark:text-pink-200 flex items-center gap-2">
          <Heart size={16} /> Favoritos do Cliente
        </h3>
        <p className="text-xs text-pink-700 dark:text-pink-300 mt-1">
          Selecione profissional e cliente para ver serviços e produtos preferidos.
        </p>
      </div>

      {/* Busca profissional */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Profissional</label>
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
          <div className="mt-2 text-xs text-green-700 dark:text-green-400">✓ Profissional selecionado</div>
        )}
      </div>

      {/* Busca cliente */}
      {selectedProfId && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. Cliente</label>
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
                      {c.telefone && <div className="text-xs text-gray-500">{c.telefone}</div>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {selectedCliId && (
            <div className="mt-2 text-xs text-green-700 dark:text-green-400">✓ Cliente selecionado</div>
          )}
        </div>
      )}

      {/* Estados */}
      {selectedProfId && selectedCliId && isLoading && (
        <div className="text-center py-6 text-gray-500">Carregando favoritos...</div>
      )}

      {selectedProfId && selectedCliId && isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">Erro ao carregar favoritos. Tente novamente.</p>
        </div>
      )}

      {/* Resultados */}
      {favData && !isError && (
        <>
          <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4 border border-pink-200 dark:border-pink-800">
            <h3 className="text-lg font-bold text-pink-900 dark:text-pink-200 flex items-center gap-2">
              <User size={20} />
              {cliente.nome || '—'}
            </h3>
            {cliente.telefone && (
              <p className="text-sm text-pink-700 dark:text-pink-300">{cliente.telefone}</p>
            )}
          </div>

          {/* Profissional favorito da cliente (no salão inteiro) */}
          {profissionalFav && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-xs text-amber-700 dark:text-amber-300 uppercase font-semibold mb-1">
                Profissional favorito da cliente (no salão)
              </p>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-amber-900 dark:text-amber-200">
                  {profissionalFav.nome}
                </p>
                <span className="text-sm text-amber-800 dark:text-amber-300">
                  {profissionalFav.qtd_atendimentos}× · último em {formatDate(profissionalFav.ultima_visita)}
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 px-1">
            Favoritos da cliente <strong>no salão inteiro</strong>:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Serviços favoritos */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Scissors size={16} className="text-blue-500" /> Serviços Preferidos
              </h4>
              {servicosFav.length === 0 ? (
                <p className="text-xs text-gray-500">Sem serviços registrados</p>
              ) : (
                <div className="space-y-2">
                  {servicosFav.map((s, i) => (
                    <div key={s.id} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0 pb-2 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{s.nome}</span>
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{s.qtd}× · {formatBRL(s.preco)}</span>
                      </div>
                      {s.categoria && <p className="text-xs text-gray-400 ml-7">{s.categoria}</p>}
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
                <Package size={16} className="text-purple-500" /> Produtos Preferidos
              </h4>
              {produtosFav.length === 0 ? (
                <p className="text-xs text-gray-500">Sem produtos comprados</p>
              ) : (
                <div className="space-y-2">
                  {produtosFav.map((p, i) => (
                    <div key={p.id} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0 pb-2 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.nome}</span>
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{p.qtd_unidades}u · {formatBRL(p.preco_venda)}</span>
                      </div>
                      {p.categoria && <p className="text-xs text-gray-400 ml-7">{p.categoria}</p>}
                      <p className="text-xs text-gray-500 ml-7 flex items-center gap-1">
                        <Clock size={10} /> Última: {formatDate(p.ultima_compra)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Com este profissional específico */}
          {(servicosComProf.length > 0 || produtosComProf.length > 0) && (
            <>
              <p className="text-xs text-gray-500 px-1">
                Histórico da cliente <strong>com este profissional</strong>:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {servicosComProf.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-indigo-500">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <Scissors size={16} className="text-indigo-500" /> Serviços feitos com este profissional
                    </h4>
                    <div className="space-y-1">
                      {servicosComProf.map((s, i) => (
                        <div key={s.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-900 dark:text-gray-100 truncate">{i + 1}. {s.nome}</span>
                          <span className="text-xs text-gray-500 ml-2">{s.qtd}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {produtosComProf.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-indigo-500">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <Package size={16} className="text-indigo-500" /> Produtos vendidos por este profissional
                    </h4>
                    <div className="space-y-1">
                      {produtosComProf.map((p, i) => (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-900 dark:text-gray-100 truncate">{i + 1}. {p.nome}</span>
                          <span className="text-xs text-gray-500 ml-2">{p.qtd_unidades}u</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {ultimasVisitas.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Clock size={16} /> Últimas visitas com este profissional
              </h4>
              <div className="space-y-1">
                {ultimasVisitas.map((v) => (
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
