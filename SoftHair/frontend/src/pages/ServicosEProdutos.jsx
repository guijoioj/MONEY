import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { servicosAPI, produtosAPI } from '../services/api';
import {
  Search, Plus, Edit2, Trash2, X, Clock, DollarSign,
  AlertCircle, Package, AlertTriangle, Scissors, Percent
} from 'lucide-react';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatDuration = (minutes) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

// ─── Serviços ────────────────────────────────────────────────────────────────

function AbaServicos() {
  // Acesso controlado por role no roteamento (admin/recepção podem editar).
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServico, setEditingServico] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, servico: null });
  const [formData, setFormData] = useState({
    nome: '', descricao: '', duracao: 30, preco: '',
    categoria: '', baseComissao: '', comissaoPorcentagem: '', ativo: true,
  });
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['servicos', search, categoria],
    queryFn: () => servicosAPI.getAll({ search, categoria }),
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (d) => servicosAPI.create(d),
    onSuccess: () => { queryClient.invalidateQueries(['servicos']); closeModal(); },
    onError: (err) => setFormError(err.response?.data?.error || err.message || 'Erro ao criar serviço'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }) => servicosAPI.update(id, d),
    onSuccess: () => { queryClient.invalidateQueries(['servicos']); closeModal(); },
    onError: (err) => setFormError(err.response?.data?.error || err.message || 'Erro ao atualizar serviço'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => servicosAPI.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(['servicos']); setDeleteModal({ open: false, servico: null }); },
    onError: (err) => alert(err.response?.data?.error || 'Erro ao excluir serviço'),
  });

  const openModal = async (servico = null) => {
    if (servico) {
      setEditingServico(servico);
      setFormData({
        nome: servico.nome || '',
        descricao: servico.descricao || '',
        duracao: servico.duracao || servico.duracao_minutos || 30,
        preco: servico.preco || '',
        categoria: servico.categoria || '',
        baseComissao: servico.baseComissao || '',
        comissaoPorcentagem: servico.comissaoPorcentagem || '',
        ativo: servico.ativo !== undefined ? servico.ativo : true,
      });
    } else {
      setEditingServico(null);
      setFormData({ nome: '', descricao: '', duracao: 30, preco: '', categoria: '', baseComissao: '', comissaoPorcentagem: '', ativo: true });
    }
    setIsModalOpen(true);
  };

  const handleDeleteServico = (servico) => {
    // Backend retorna 403 se não-admin tentar deletar.
    setDeleteModal({ open: true, servico });
  };

  const closeModal = () => { setIsModalOpen(false); setEditingServico(null); setFormError(''); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      nome: formData.nome,
      descricao: formData.descricao,
      categoria: formData.categoria,
      preco: parseFloat(formData.preco) || 0,
      duracao_minutos: parseInt(formData.duracao) || null,
      ativo: formData.ativo,
    };
    if (editingServico) {
      updateMutation.mutate({ id: editingServico.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const comissaoValor = (s) => {
    const base = parseFloat(s.baseComissao) || 0;
    const pct = parseFloat(s.comissaoPorcentagem) || 0;
    return base * pct / 100;
  };

  return (
    <div>
      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text" placeholder="Buscar serviços..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="">Todas categorias</option>
            {data?.data?.categorias?.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <button onClick={() => openModal()}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            <Plus size={18} /> Novo Serviço
          </button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.data?.data?.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">Nenhum serviço encontrado</div>
          ) : (
            [...(data?.data?.data || [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((servico) => (
              <div key={servico.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow p-5 ${!servico.ativo ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">{servico.nome}</h3>
                    {servico.categoria && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                        {servico.categoria}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openModal(servico)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30 rounded"><Edit2 size={16} /></button>
                    <button onClick={() => handleDeleteServico(servico)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/30 rounded"><Trash2 size={16} /></button>
                  </div>
                </div>
                {servico.descricao && <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm mb-3">{servico.descricao}</p>}
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-1"><Clock size={14} />{formatDuration(servico.duracao)}</div>
                    <div className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                      <DollarSign size={14} />{formatCurrency(servico.preco)}
                    </div>
                  </div>
                  {(servico.baseComissao > 0 || servico.comissaoPorcentagem > 0) && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <span>Base: {formatCurrency(servico.baseComissao)} × {servico.comissaoPorcentagem}%</span>
                      <span className="font-medium text-green-700">= {formatCurrency(comissaoValor(servico))}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Formulário */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">{editingServico ? 'Editar Serviço' : 'Novo Serviço'}</h2>
              <button onClick={closeModal} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nome *</label>
                <input type="text" value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Descrição</label>
                <textarea value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Duração (min) *</label>
                  <input type="number" min="1" value={formData.duracao}
                    onChange={(e) => setFormData({ ...formData, duracao: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Valor Tabela (R$) *</label>
                  <input type="number" step="0.01" min="0" value={formData.preco}
                    onChange={(e) => setFormData({ ...formData, preco: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Categoria</label>
                <input type="text" value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Cabelo, Unhas, Estética" />
              </div>

              {/* Comissão */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <Percent size={14} /> Comissão
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Base Comissão (R$)</label>
                    <input type="number" step="0.01" min="0" value={formData.baseComissao}
                      onChange={(e) => setFormData({ ...formData, baseComissao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">% Comissão</label>
                    <input type="number" step="0.01" min="0" max="100" value={formData.comissaoPorcentagem}
                      onChange={(e) => setFormData({ ...formData, comissaoPorcentagem: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
                  </div>
                </div>
                {formData.baseComissao > 0 && formData.comissaoPorcentagem > 0 && (
                  <p className="text-xs text-green-700 font-medium">
                    Comissão calculada: {formatCurrency(parseFloat(formData.baseComissao) * parseFloat(formData.comissaoPorcentagem) / 100)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="ativo-s" checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 dark:text-indigo-400 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500" />
                <label htmlFor="ativo-s" className="text-sm text-gray-700 dark:text-gray-200">Serviço ativo</label>
              </div>
              {formError && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{formError}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">Cancelar</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Exclusão */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
              <AlertCircle className="text-red-600 dark:text-red-400" size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">Confirmar Exclusão</h2>
            <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
              Excluir o serviço <strong>{deleteModal.servico?.nome}</strong>?<br />
              <span className="text-sm text-red-500">Esta ação não pode ser desfeita.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ open: false, servico: null })}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 font-medium">Cancelar</button>
              <button onClick={() => deleteMutation.mutate(deleteModal.servico.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50">
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Produtos ─────────────────────────────────────────────────────────────────

function AbaProdutos() {
  // Acesso controlado por role no roteamento (admin/recepção podem editar).
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [estoqueBaixo, setEstoqueBaixo] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [_sp] = useSearchParams();
  useEffect(() => { if (_sp.get('new') === 'produto') setTimeout(() => setIsModalOpen(true), 100); }, []);
  const [editingProduto, setEditingProduto] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, produto: null });
  const [formData, setFormData] = useState({
    nome: '', descricao: '', marca: '', categoria: '',
    precoVenda: '', baseComissao: '', comissaoPorcentagem: '',
    estoque: 0, estoqueMinimo: 0, unidade: 'un', ativo: true,
  });
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['produtos', search, categoria, estoqueBaixo],
    queryFn: () => produtosAPI.getAll({ search, categoria, estoqueBaixo: estoqueBaixo || undefined }),
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (d) => produtosAPI.create(d),
    onSuccess: () => { queryClient.invalidateQueries(['produtos']); closeModal(); },
    onError: (err) => setFormError(err.response?.data?.error || err.message || 'Erro ao criar produto'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }) => produtosAPI.update(id, d),
    onSuccess: () => { queryClient.invalidateQueries(['produtos']); closeModal(); },
    onError: (err) => setFormError(err.response?.data?.error || err.message || 'Erro ao atualizar produto'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => produtosAPI.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(['produtos']); setDeleteModal({ open: false, produto: null }); },
    onError: (err) => alert(err.response?.data?.error || 'Erro ao excluir produto'),
  });

  const openModal = async (produto = null) => {
    if (produto) {
      setEditingProduto(produto);
      setFormData({
        nome: produto.nome || '',
        descricao: produto.descricao || '',
        marca: produto.marca || '',
        categoria: produto.categoria || '',
        precoVenda: produto.precoVenda ?? produto.preco_venda ?? '',
        baseComissao: produto.baseComissao ?? produto.base_comissao ?? '',
        comissaoPorcentagem: produto.comissaoPorcentagem ?? produto.comissao_porcentagem ?? '',
        estoque: produto.estoque ?? produto.quantidade_estoque ?? 0,
        estoqueMinimo: produto.estoqueMinimo ?? produto.quantidade_minima ?? 0,
        unidade: produto.unidade || 'un',
        ativo: produto.ativo !== undefined ? produto.ativo : true,
      });
    } else {
      setEditingProduto(null);
      setFormData({ nome: '', descricao: '', marca: '', categoria: '', precoVenda: '', baseComissao: '', comissaoPorcentagem: '', estoque: 0, estoqueMinimo: 0, unidade: 'un', ativo: true });
    }
    setIsModalOpen(true);
  };

  const handleDeleteProduto = (produto) => {
    // Backend retorna 403 se não-admin tentar deletar.
    setDeleteModal({ open: true, produto });
  };

  const closeModal = () => { setIsModalOpen(false); setEditingProduto(null); setFormError(''); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      nome: formData.nome,
      descricao: formData.descricao,
      marca: formData.marca,
      categoria: formData.categoria,
      preco_venda: parseFloat(formData.precoVenda) || 0,
      quantidade_estoque: parseFloat(formData.estoque) || 0,
      quantidade_minima: parseFloat(formData.estoqueMinimo) || 0,
      unidade: formData.unidade,
      ativo: formData.ativo,
    };
    if (editingProduto) {
      updateMutation.mutate({ id: editingProduto.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div>
      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input type="text" placeholder="Buscar produtos..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="">Todas categorias</option>
            {data?.data?.categorias?.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <button onClick={() => setEstoqueBaixo(!estoqueBaixo)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${estoqueBaixo ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-400 text-yellow-700' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'}`}>
            <AlertTriangle size={18} /> Estoque Baixo
          </button>
          <button onClick={() => openModal()}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            <Plus size={18} /> Novo Produto
          </button>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">Carregando...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Produto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Marca</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Valor Tabela</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Base Comissão</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">% / Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Estoque</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data?.data?.data?.length === 0 ? (
                <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">Nenhum produto encontrado</td></tr>
              ) : (
                [...(data?.data?.data || [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((produto) => {
                  const comissaoValor = (parseFloat(produto.baseComissao) || 0) * (parseFloat(produto.comissaoPorcentagem) || 0) / 100;
                  return (
                    <tr key={produto.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 ${!produto.ativo ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><Package className="text-indigo-600 dark:text-indigo-400" size={20} /></div>
                          <div>
                            <div className="font-medium text-gray-800 dark:text-gray-100">{produto.nome}</div>
                            {produto.descricao && <div className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate max-w-xs">{produto.descricao}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{produto.marca || '-'}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{produto.categoria || '-'}</td>
                      <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">{formatCurrency(produto.preco_venda ?? produto.precoVenda)}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">-</td>
                      <td className="px-6 py-4 text-sm">-</td>
                      <td className="px-6 py-4">
                        {(() => { const est = produto.quantidade_estoque ?? produto.estoque ?? 0; const min = produto.quantidade_minima ?? produto.estoqueMinimo ?? 0; return (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded ${est <= min ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {est <= min && <AlertTriangle size={14} />}
                          {est} / {min}
                        </span>
                        ); })()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => openModal(produto)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30 rounded"><Edit2 size={18} /></button>
                          <button onClick={() => handleDeleteProduto(produto)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/30 rounded"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Formulário */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">{editingProduto ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={closeModal} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nome *</label>
                <input type="text" value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Descrição</label>
                <textarea value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Marca</label>
                  <input type="text" value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Categoria</label>
                  <input type="text" value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Valor Tabela (R$) *</label>
                <input type="number" step="0.01" min="0" value={formData.precoVenda}
                  onChange={(e) => setFormData({ ...formData, precoVenda: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
              </div>

              {/* Comissão */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2"><Percent size={14} /> Comissão</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Base Comissão (R$)</label>
                    <input type="number" step="0.01" min="0" value={formData.baseComissao}
                      onChange={(e) => setFormData({ ...formData, baseComissao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">% Comissão</label>
                    <input type="number" step="0.01" min="0" max="100" value={formData.comissaoPorcentagem}
                      onChange={(e) => setFormData({ ...formData, comissaoPorcentagem: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
                  </div>
                </div>
                {formData.baseComissao > 0 && formData.comissaoPorcentagem > 0 && (
                  <p className="text-xs text-green-700 font-medium">
                    Comissão calculada: {formatCurrency(parseFloat(formData.baseComissao) * parseFloat(formData.comissaoPorcentagem) / 100)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Estoque</label>
                  <input type="number" min="0" step="0.01" value={formData.estoque}
                    onChange={(e) => setFormData({ ...formData, estoque: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Unidade</label>
                  <select value={formData.unidade}
                    onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="un">un</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="m">m</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Est. Mínimo</label>
                  <input type="number" min="0" step="0.01" value={formData.estoqueMinimo}
                    onChange={(e) => setFormData({ ...formData, estoqueMinimo: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ativo-p" checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 dark:text-indigo-400 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500" />
                <label htmlFor="ativo-p" className="text-sm text-gray-700 dark:text-gray-200">Produto ativo</label>
              </div>
              {formError && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{formError}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">Cancelar</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Exclusão */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
              <AlertCircle className="text-red-600 dark:text-red-400" size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">Confirmar Exclusão</h2>
            <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
              Excluir o produto <strong>{deleteModal.produto?.nome}</strong>?<br />
              <span className="text-sm text-red-500">Esta ação não pode ser desfeita.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ open: false, produto: null })}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 font-medium">Cancelar</button>
              <button onClick={() => deleteMutation.mutate(deleteModal.produto.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50">
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function ServicosEProdutos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [aba, setAba] = useState(() => searchParams.get('new') === 'produto' ? 'produtos' : 'servicos');
  useEffect(() => {
    if (searchParams.get('new') === 'produto' || searchParams.get('new') === 'servico') setSearchParams({});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Serviços e Produtos</h1>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setAba('servicos')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            aba === 'servicos'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200'
          }`}
        >
          <Scissors size={16} /> Serviços
        </button>
        <button
          onClick={() => setAba('produtos')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            aba === 'produtos'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200'
          }`}
        >
          <Package size={16} /> Produtos
        </button>
      </div>

      {aba === 'servicos' ? <AbaServicos /> : <AbaProdutos />}
    </div>
  );
}
