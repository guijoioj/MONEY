import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usuariosAPI, profissionaisAPI } from '../services/api';
import {
  Users, Plus, Edit2, Key, ShieldOff, ShieldCheck,
  User as UserIcon, X, Loader2, AlertCircle, Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  admin: { label: 'Administrador', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  recepcao: { label: 'Recepção', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  profissional: { label: 'Profissional', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
};

export default function Usuarios() {
  const qc = useQueryClient();
  const { user: meUser } = useAuth();
  const [editing, setEditing] = useState(null); // null | 'new' | { ...user }
  const [search, setSearch] = useState('');
  const [pwdModal, setPwdModal] = useState(null);

  const { data: listResp, isLoading, error } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => usuariosAPI.getAll(),
  });

  const { data: profsResp } = useQuery({
    queryKey: ['profissionais-ativos-dropdown'],
    queryFn: () => profissionaisAPI.getAll({ ativo: true }),
  });

  const usuarios = listResp?.data?.data || [];
  const profissionais = profsResp?.data?.data || [];

  const filtered = usuarios.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.nome || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }) => usuariosAPI.update(id, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Usuários</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie acessos e perfis de quem usa o sistema.</p>
          </div>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-sm"
        >
          <Plus size={18} /> Novo usuário
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <Loader2 className="animate-spin mx-auto text-indigo-600" size={36} />
          <p className="text-gray-500 dark:text-gray-400 mt-3">Carregando usuários…</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-2 text-red-700 dark:text-red-300">
          <AlertCircle size={18} />
          Erro ao carregar usuários: {error.response?.data?.error || error.message}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 text-center">
          <UserIcon className="mx-auto text-gray-400 mb-3" size={48} />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Nenhum usuário</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Crie o primeiro acesso para sua equipe.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((u) => {
          const role = ROLE_LABELS[u.tipo] || { label: u.tipo, color: 'bg-gray-100 text-gray-700' };
          const isMe = meUser && Number(meUser.id) === Number(u.id);
          return (
            <div
              key={u.id}
              className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border ${u.ativo ? 'border-gray-100 dark:border-gray-700' : 'border-red-200 dark:border-red-800 opacity-75'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold">
                    {(u.nome || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {u.nome} {isMe && <span className="text-xs text-indigo-600">(você)</span>}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{u.email}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${role.color}`}>
                  {role.label}
                </span>
                {u.profissional_nome && (
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                    {u.profissional_nome}
                  </span>
                )}
                {!u.ativo && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                    Inativo
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(u)}
                  className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Edit2 size={14} /> Editar
                </button>
                <button
                  onClick={() => setPwdModal(u)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium flex items-center justify-center transition-colors"
                  title="Trocar senha"
                >
                  <Key size={14} />
                </button>
                {!isMe && (
                  <button
                    onClick={() => toggleAtivoMutation.mutate({ id: u.id, ativo: !u.ativo })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${u.ativo ? 'bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400' : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'}`}
                    title={u.ativo ? 'Desativar' : 'Reativar'}
                  >
                    {u.ativo ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <UsuarioForm
          mode={editing === 'new' ? 'create' : 'edit'}
          initial={editing === 'new' ? null : editing}
          profissionais={profissionais}
          onClose={() => setEditing(null)}
        />
      )}

      {pwdModal && (
        <SenhaForm
          user={pwdModal}
          onClose={() => setPwdModal(null)}
        />
      )}
    </div>
  );
}

function UsuarioForm({ mode, initial, profissionais, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nome: initial?.nome || '',
    email: initial?.email || '',
    tipo: initial?.tipo || 'recepcao',
    profissional_id: initial?.profissional_id || '',
    senha: '',
    ativo: initial?.ativo ?? true,
  });
  const [err, setErr] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === 'create') {
        const payload = {
          nome: form.nome.trim(),
          email: form.email.trim(),
          tipo: form.tipo,
          senha: form.senha,
          ativo: form.ativo,
        };
        if (form.tipo === 'profissional') payload.profissional_id = Number(form.profissional_id);
        return usuariosAPI.create(payload);
      }
      const payload = {
        nome: form.nome.trim(),
        email: form.email.trim(),
        tipo: form.tipo,
        ativo: form.ativo,
      };
      if (form.tipo === 'profissional') payload.profissional_id = Number(form.profissional_id);
      else payload.profissional_id = null;
      return usuariosAPI.update(initial.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
    onError: (e) => {
      const data = e.response?.data;
      setErr(data?.error || data?.errors?.[0]?.msg || 'Erro ao salvar');
    },
  });

  const submit = (e) => {
    e.preventDefault();
    setErr('');
    if (!form.nome.trim() || !form.email.trim()) {
      setErr('Nome e email obrigatórios');
      return;
    }
    if (mode === 'create' && form.senha.length < 6) {
      setErr('Senha mínimo 6 caracteres');
      return;
    }
    if (form.tipo === 'profissional' && !form.profissional_id) {
      setErr('Selecione o profissional vinculado');
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl"
      >
        <div className="p-5 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {mode === 'create' ? 'Novo usuário' : 'Editar usuário'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Nome">
            <input
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <Field label="Perfil">
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500"
            >
              <option value="admin">Administrador (vê tudo)</option>
              <option value="recepcao">Recepção (agenda, clientes, vendas)</option>
              <option value="profissional">Profissional (próprios dados)</option>
            </select>
          </Field>

          {form.tipo === 'profissional' && (
            <Field label="Profissional vinculado">
              <select
                required
                value={form.profissional_id}
                onChange={(e) => setForm({ ...form, profissional_id: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— escolha —</option>
                {profissionais.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </Field>
          )}

          {mode === 'create' && (
            <Field label="Senha inicial (mín 6)">
              <input
                type="password"
                required
                minLength={6}
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-200">Usuário ativo</span>
          </label>

          {err && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle size={16} /> {err}
            </div>
          )}
        </div>

        <div className="p-5 border-t dark:border-gray-700 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium disabled:opacity-50"
          >
            {mutation.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SenhaForm({ user, onClose }) {
  const [senha, setSenha] = useState('');
  const [err, setErr] = useState('');
  const mutation = useMutation({
    mutationFn: () => usuariosAPI.updateSenha(user.id, senha),
    onSuccess: onClose,
    onError: (e) => setErr(e.response?.data?.error || 'Erro ao alterar senha'),
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (senha.length < 6) { setErr('Mínimo 6 caracteres'); return; } mutation.mutate(); }}
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-xl"
      >
        <div className="p-5 border-b dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Trocar senha</h2>
          <p className="text-sm text-gray-500">{user.nome} ({user.email})</p>
        </div>
        <div className="p-5 space-y-3">
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Nova senha (mín 6)"
            minLength={6}
            required
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          {err && (
            <div className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={14} /> {err}
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ao trocar a senha, os tokens antigos do usuário ficam inválidos. Ele precisará entrar novamente.
          </p>
        </div>
        <div className="p-5 border-t dark:border-gray-700 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium disabled:opacity-50">
            {mutation.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
