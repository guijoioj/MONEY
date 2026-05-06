import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { despesasAPI } from '../services/api';
import { Plus, Edit2, Trash2, X, DollarSign } from 'lucide-react';

const CATEGORIAS = ['Aluguel','Energia','Água','Produtos','Equipamentos','Marketing','Salário','Impostos','Outros'];

const formatCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const today = new Date();

function Modal({ despesa, onClose, onSave }) {
  const [form, setForm] = useState(
    despesa || {
      descricao: '', valor: '', categoria: 'Outros',
      data: new Date().toISOString().split('T')[0], recorrente: false, observacoes: ''
    }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{despesa?.id ? 'Editar Despesa' : 'Nova Despesa'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Descrição *</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Ex: Aluguel do salão" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Valor *</label>
              <input type="number" min="0" step="0.01" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Data</label>
              <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.data} onChange={e => set('data', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Categoria</label>
            <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Observações</label>
            <textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.recorrente} onChange={e => set('recorrente', e.target.checked)} className="rounded" />
            Despesa recorrente (mensal)
          </label>
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {despesa?.id ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Despesas() {
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [ano, setAno] = useState(today.getFullYear());
  const [categoria, setCategoria] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | despesaObj

  const params = { mes, ano, ...(categoria ? { categoria } : {}) };

  const { data: listData } = useQuery({
    queryKey: ['despesas', params],
    queryFn: () => despesasAPI.getAll(params).then(r => r.data.data),
  });

  const { data: resumoData } = useQuery({
    queryKey: ['despesas-resumo', { mes, ano }],
    queryFn: () => despesasAPI.getResumo({ mes, ano }).then(r => r.data.data),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['despesas'] });
    queryClient.invalidateQueries({ queryKey: ['despesas-resumo'] });
  };

  const createMut = useMutation({
    mutationFn: (data) => despesasAPI.create(data),
    onSuccess: () => { invalidate(); setModal(null); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => despesasAPI.update(id, data),
    onSuccess: () => { invalidate(); setModal(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => despesasAPI.remove(id),
    onSuccess: () => invalidate(),
  });

  const handleSave = (form) => {
    if (modal?.id) updateMut.mutate({ id: modal.id, data: form });
    else createMut.mutate(form);
  };

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Controle de Despesas</h1>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Nova Despesa
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select className="border rounded-lg px-3 py-2 text-sm" value={mes} onChange={e => setMes(+e.target.value)}>
          {meses.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={ano} onChange={e => setAno(+e.target.value)}>
          {[ano-1, ano, ano+1].map(y => <option key={y}>{y}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={categoria} onChange={e => setCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Resumo total */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
        <div className="bg-red-100 rounded-full p-3">
          <DollarSign className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <p className="text-sm text-red-600 font-medium">Total do mês</p>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(resumoData?.total)}</p>
        </div>
      </div>

      {/* Cards por categoria */}
      {resumoData?.categorias?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {resumoData.categorias.map(c => (
            <div key={c.categoria} className="bg-white border rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.categoria}</p>
              <p className="text-lg font-bold text-gray-800 mt-1">{formatCurrency(c.total)}</p>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-400 rounded-full"
                  style={{ width: resumoData.total > 0 ? `${(c.total / resumoData.total * 100).toFixed(0)}%` : '0%' }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{c.quantidade} registro(s)</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Descrição</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Categoria</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Data</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Valor</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(listData || []).length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nenhuma despesa encontrada</td></tr>
            ) : (listData || []).map(d => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{d.descricao}</p>
                  {d.recorrente && <span className="text-xs text-blue-500">Recorrente</span>}
                  {d.observacoes && <p className="text-xs text-gray-400 mt-0.5">{d.observacoes}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs">{d.categoria}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(d.valor)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => setModal(d)} className="text-gray-400 hover:text-blue-600 p-1 rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if (confirm('Excluir despesa?')) deleteMut.mutate(d.id); }}
                      className="text-gray-400 hover:text-red-600 p-1 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          despesa={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
