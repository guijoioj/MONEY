import { useQuery } from '@tanstack/react-query';
import { User, Heart, Scissors, Package, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { clientesAPI } from '../services/api';

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

/**
 * PerfilCliente — cards de visão geral do cliente.
 * Calculado server-side em /api/clientes/:id/perfil.
 *
 * Resiliente: se endpoint quebrar, mostra mensagem leve sem derrubar a tela.
 */
export default function PerfilCliente({ clienteId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cliente-perfil', clienteId],
    queryFn: () => clientesAPI.getPerfil(clienteId).then(r => r.data?.data),
    enabled: !!clienteId,
    retry: 1,
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-sm text-gray-500 py-4">Carregando perfil...</div>;
  if (isError || !data) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-3 text-sm flex items-center gap-2">
        <AlertCircle size={16} className="text-amber-600" />
        <span className="text-amber-800 dark:text-amber-300">Perfil indisponível agora.</span>
      </div>
    );
  }

  const resumo = data.resumo || {};
  const fav = data.favoritos || {};

  return (
    <div className="space-y-3">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 text-center">
          <p className="text-xs text-gray-500 uppercase">Atendimentos</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{resumo.total_atendimentos || 0}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-3 text-center">
          <p className="text-xs text-gray-500 uppercase">Compras</p>
          <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{resumo.total_vendas || 0}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded p-3 text-center">
          <p className="text-xs text-gray-500 uppercase">Total gasto</p>
          <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatBRL(resumo.total_gasto)}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded p-3 text-center">
          <p className="text-xs text-gray-500 uppercase">Ticket médio</p>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatBRL(resumo.ticket_medio)}</p>
        </div>
      </div>

      {/* Última visita + frequência */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 text-sm flex flex-wrap gap-4">
        <span><Calendar size={14} className="inline mr-1" /> Última visita: <strong>{formatDate(resumo.ultima_visita)}</strong></span>
        {resumo.frequencia_dias_media != null && (
          <span><TrendingUp size={14} className="inline mr-1" /> Frequência média: <strong>{resumo.frequencia_dias_media} dias</strong></span>
        )}
      </div>

      {/* Favoritos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="bg-white dark:bg-gray-800 border border-pink-200 dark:border-pink-800 rounded p-3">
          <div className="flex items-center gap-2 mb-1">
            <User size={14} className="text-pink-600" />
            <span className="text-xs text-gray-500 uppercase">Profissional favorito</span>
          </div>
          {fav.profissional ? (
            <>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{fav.profissional.nome}</p>
              <p className="text-xs text-gray-500">{fav.profissional.qtd_atendimentos}× · último em {formatDate(fav.profissional.ultima_visita)}</p>
            </>
          ) : <p className="text-sm text-gray-500">Sem dados</p>}
        </div>

        <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded p-3">
          <div className="flex items-center gap-2 mb-1">
            <Scissors size={14} className="text-blue-600" />
            <span className="text-xs text-gray-500 uppercase">Serviço favorito</span>
          </div>
          {fav.servico ? (
            <>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{fav.servico.nome}</p>
              <p className="text-xs text-gray-500">{fav.servico.qtd}× · {formatBRL(fav.servico.preco)}</p>
            </>
          ) : <p className="text-sm text-gray-500">Sem dados</p>}
        </div>

        <div className="bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 rounded p-3">
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-purple-600" />
            <span className="text-xs text-gray-500 uppercase">Produto favorito</span>
          </div>
          {fav.produto ? (
            <>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{fav.produto.nome}</p>
              <p className="text-xs text-gray-500">{fav.produto.qtd_unidades}u · {formatBRL(fav.produto.preco_venda)}</p>
            </>
          ) : <p className="text-sm text-gray-500">Sem dados</p>}
        </div>
      </div>
    </div>
  );
}
