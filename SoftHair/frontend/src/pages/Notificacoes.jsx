import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificacoesAPI } from '../services/api';
import { Bell, BellOff, User, AlertCircle, Calendar, Package } from 'lucide-react';

export default function Notificacoes() {
  const [filtro, setFiltro] = useState('todas');

  const { data, isLoading } = useQuery({
    queryKey: ['notificacoes', filtro],
    queryFn: async () => {
      const params = {};
      if (filtro === 'nao-lidas') params.lida = false;
      const res = await notificacoesAPI.getAll(params);
      return res.data;
    },
  });

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  const getIcon = (tipo) => {
    switch (tipo) {
      case 'cliente_inativo': return <User size={18} className="text-orange-500" />;
      case 'agendamento': return <Calendar size={18} className="text-blue-500" />;
      case 'produto': return <Package size={18} className="text-purple-500" />;
      case 'alerta': return <AlertCircle size={18} className="text-red-500" />;
      default: return <Bell size={18} className="text-gray-500" />;
    }
  };

  const notificacoes = data?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Notificações</h1>
      </div>

      <div className="flex gap-2 bg-white rounded-lg p-2 shadow">
        {[{ value: 'todas', label: 'Todas' }, { value: 'nao-lidas', label: 'Não lidas' }].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFiltro(opt.value)}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              filtro === opt.value ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Carregando notificações...</div>
      ) : notificacoes.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <BellOff size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhuma notificação</h3>
          <p className="text-gray-400">
            {filtro === 'nao-lidas' ? 'Todas as notificações foram visualizadas' : 'Você está em dia com tudo!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notificacoes.map((notif) => (
            <div
              key={notif.id}
              className={`bg-white rounded-xl shadow p-4 transition-all ${notif.lida ? 'opacity-60' : 'border-l-4 border-indigo-500'}`}
            >
              <div className="flex items-start gap-4">
                <div className="p-2 bg-gray-100 rounded-lg">{getIcon(notif.tipo)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-800">{notif.titulo}</h3>
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(notif.createdAt)}</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">{notif.mensagem}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
