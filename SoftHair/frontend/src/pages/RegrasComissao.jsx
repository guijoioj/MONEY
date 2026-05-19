import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Copy, Trash2, X } from 'lucide-react';
import { regrasComissaoAPI, comissoesV2API, profissionaisAPI, servicosAPI, produtosAPI } from '../services/api';

function toArr(v) {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.data)) return v.data;
  if (Array.isArray(v?.data?.data)) return v.data.data;
  return [];
}

const TIPOS = [
  { v: 'global', l: 'Global do salão' },
  { v: 'profissional', l: 'Por profissional' },
  { v: 'servico', l: 'Por serviço' },
  { v: 'produto', l: 'Por produto' },
  { v: 'categoria_servico', l: 'Categoria de serviço' },
  { v: 'categoria_produto', l: 'Categoria de produto' },
  { v: 'profissional_servico', l: 'Profissional + Serviço' },
  { v: 'profissional_produto', l: 'Profissional + Produto' },
  { v: 'assistente', l: 'Assistente' },
  { v: 'meta', l: 'Meta escalonada' },
  { v: 'dia_semana', l: 'Por dia da semana' },
  { v: 'horario', l: 'Por horário' },
];

const BASES = [
  { v: 'valor_bruto', l: 'Valor bruto' },
  { v: 'valor_com_desconto', l: 'Com desconto' },
  { v: 'valor_liquido', l: 'Líquido (após taxa)' },
  { v: 'valor_liquido_sem_taxas', l: 'Líquido sem taxas' },
  { v: 'lucro_bruto', l: 'Lucro bruto (produto)' },
];

function FormModal({ open, onClose, regra, onSave }) {
  const [form, setForm] = useState(regra || {
    nome: '',
    tipo: 'global',
    base_calculo: 'valor_bruto',
    percentual: 30,
    valor_fixo_cents: null,
    ativo: true,
    prioridade: 0,
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim: null,
    profissional_id: null,
    servico_id: null,
    produto_id: null,
    categoria: null,
    condicoes_json: {},
  });
  const [usaFixo, setUsaFixo] = useState(!!regra?.valor_fixo_cents);

  // Carrega listas para os selects (só quando modal abre)
  const { data: profsData } = useQuery({
    queryKey: ['regras-modal-profs'],
    queryFn: () => profissionaisAPI.getAll({ ativo: true }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const { data: servsData } = useQuery({
    queryKey: ['regras-modal-servs'],
    queryFn: () => servicosAPI.getAll(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const { data: prodsData } = useQuery({
    queryKey: ['regras-modal-prods'],
    queryFn: () => produtosAPI.getAll(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const profissionais = toArr(profsData?.data).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  const servicos      = toArr(servsData?.data).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  const produtos      = toArr(prodsData?.data).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  // Lista de categorias únicas baseadas em serviços/produtos
  const categoriasServico = [...new Set(servicos.map(s => s.categoria).filter(Boolean))].sort();
  const categoriasProduto = [...new Set(produtos.map(p => p.categoria).filter(Boolean))].sort();

  if (!open) return null;

  const handleSave = () => {
    const payload = { ...form };
    if (usaFixo) {
      payload.percentual = null;
      payload.valor_fixo_cents = Number(payload.valor_fixo_cents);
    } else {
      payload.valor_fixo_cents = null;
      payload.percentual = Number(payload.percentual);
    }
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {regra ? 'Editar regra' : 'Nova regra'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
            <input
              type="text"
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
              placeholder="Ex: Comissão padrão de cortes"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
              >
                {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base de cálculo</label>
              <select
                value={form.base_calculo}
                onChange={e => setForm(f => ({ ...f, base_calculo: e.target.value }))}
                className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
              >
                {BASES.map(b => <option key={b.v} value={b.v}>{b.l}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!usaFixo}
                onChange={() => setUsaFixo(false)}
              />
              <span className="text-sm">Percentual</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={usaFixo}
                onChange={() => setUsaFixo(true)}
              />
              <span className="text-sm">Valor fixo</span>
            </label>
          </div>

          {!usaFixo ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Percentual (0-100)</label>
              <input
                type="number"
                min="0" max="100" step="0.01"
                value={form.percentual ?? ''}
                onChange={e => setForm(f => ({ ...f, percentual: e.target.value }))}
                className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor fixo (centavos)</label>
              <input
                type="number"
                min="0" step="1"
                value={form.valor_fixo_cents ?? ''}
                onChange={e => setForm(f => ({ ...f, valor_fixo_cents: e.target.value }))}
                className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
                placeholder="2500 = R$ 25,00"
              />
            </div>
          )}

          {(form.tipo === 'profissional' || form.tipo === 'profissional_servico' || form.tipo === 'profissional_produto' || form.tipo === 'assistente') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profissional</label>
              <select
                value={form.profissional_id ?? ''}
                onChange={e => setForm(f => ({ ...f, profissional_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
              >
                <option value="">— Selecione —</option>
                {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}{p.especialidade ? ` · ${p.especialidade}` : ''}</option>)}
              </select>
            </div>
          )}

          {(form.tipo === 'servico' || form.tipo === 'profissional_servico') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serviço</label>
              <select
                value={form.servico_id ?? ''}
                onChange={e => setForm(f => ({ ...f, servico_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
              >
                <option value="">— Selecione —</option>
                {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}{s.categoria ? ` · ${s.categoria}` : ''}</option>)}
              </select>
            </div>
          )}

          {(form.tipo === 'produto' || form.tipo === 'profissional_produto') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Produto</label>
              <select
                value={form.produto_id ?? ''}
                onChange={e => setForm(f => ({ ...f, produto_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
              >
                <option value="">— Selecione —</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}{p.categoria ? ` · ${p.categoria}` : ''}</option>)}
              </select>
            </div>
          )}

          {form.tipo === 'categoria_servico' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria de serviço</label>
              {categoriasServico.length > 0 ? (
                <select
                  value={form.categoria ?? ''}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value || null }))}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
                >
                  <option value="">— Selecione —</option>
                  {categoriasServico.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.categoria ?? ''}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value || null }))}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
                  placeholder="Ex: Corte, Coloração"
                />
              )}
            </div>
          )}

          {form.tipo === 'categoria_produto' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria de produto</label>
              {categoriasProduto.length > 0 ? (
                <select
                  value={form.categoria ?? ''}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value || null }))}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
                >
                  <option value="">— Selecione —</option>
                  {categoriasProduto.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.categoria ?? ''}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value || null }))}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
                  placeholder="Ex: Shampoo, Esmalte"
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data início</label>
              <input
                type="date"
                value={form.data_inicio}
                onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data fim (opcional)</label>
              <input
                type="date"
                value={form.data_fim || ''}
                onChange={e => setForm(f => ({ ...f, data_fim: e.target.value || null }))}
                className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
              />
              <span className="text-sm">Ativo</span>
            </label>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400">Prioridade</label>
              <input
                type="number"
                value={form.prioridade}
                onChange={e => setForm(f => ({ ...f, prioridade: Number(e.target.value) || 0 }))}
                className="w-full px-2 py-1 border rounded dark:bg-gray-900 dark:border-gray-600 text-sm"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm">Cancelar</button>
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm">Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function RegrasComissao() {
  const qc = useQueryClient();
  const [filtros, setFiltros] = useState({ ativo: 'true', tipo: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: regras, isLoading } = useQuery({
    queryKey: ['regras-comissao', filtros],
    queryFn: () => regrasComissaoAPI.list(filtros).then(r => r.data?.data || []),
  });

  const create = useMutation({
    mutationFn: (data) => regrasComissaoAPI.create(data),
    onSuccess: () => { qc.invalidateQueries(['regras-comissao']); setModalOpen(false); setEditing(null); },
    onError: (e) => alert(`Erro: ${e?.response?.data?.error || e.message}`),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => regrasComissaoAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['regras-comissao']); setModalOpen(false); setEditing(null); },
    onError: (e) => alert(`Erro: ${e?.response?.data?.error || e.message}`),
  });

  const remove = useMutation({
    mutationFn: (id) => regrasComissaoAPI.delete(id),
    onSuccess: () => qc.invalidateQueries(['regras-comissao']),
  });

  const clone = useMutation({
    mutationFn: (id) => regrasComissaoAPI.clonar(id),
    onSuccess: () => qc.invalidateQueries(['regras-comissao']),
  });

  const handleSave = (payload) => {
    if (editing) update.mutate({ id: editing.id, data: payload });
    else create.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Regras de Comissão</h1>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nova Regra
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filtros.ativo}
          onChange={e => setFiltros(f => ({ ...f, ativo: e.target.value }))}
          className="px-3 py-1.5 border rounded dark:bg-gray-900 dark:border-gray-600 text-sm"
        >
          <option value="true">Ativas</option>
          <option value="false">Inativas</option>
          <option value="">Todas</option>
        </select>
        <select
          value={filtros.tipo}
          onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}
          className="px-3 py-1.5 border rounded dark:bg-gray-900 dark:border-gray-600 text-sm"
        >
          <option value="">Todos os tipos</option>
          {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Base</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Vigência</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ativo</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">Carregando...</td></tr>
              ) : !regras?.length ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">Nenhuma regra cadastrada</td></tr>
              ) : (
                regras.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{r.nome}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{TIPOS.find(t => t.v === r.tipo)?.l || r.tipo}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{BASES.find(b => b.v === r.base_calculo)?.l || r.base_calculo}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300 font-mono">
                      {r.valor_fixo_cents
                        ? `R$ ${(r.valor_fixo_cents / 100).toFixed(2)}`
                        : r.percentual != null ? `${Number(r.percentual).toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-center text-gray-700 dark:text-gray-300">
                      {r.data_inicio} {r.data_fim ? `→ ${r.data_fim}` : '→ ∞'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${r.ativo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {r.ativo ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(r); setModalOpen(true); }}
                          className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => clone.mutate(r.id)}
                          className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded text-purple-600 dark:text-purple-400">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if (confirm('Desativar regra?')) remove.mutate(r.id); }}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <FormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        regra={editing}
        onSave={handleSave}
      />
    </div>
  );
}
