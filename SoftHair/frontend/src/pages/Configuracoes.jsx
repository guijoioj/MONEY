import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Globe, CheckCircle, RefreshCw, Calendar, QrCode } from 'lucide-react';
import api from '../services/api';

export default function Configuracoes() {
  const { user, changePassword } = useAuth();
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [browsers, setBrowsers] = useState([]);
  const [selectedBrowser, setSelectedBrowser] = useState('firefox');
  const [browserLoading, setBrowserLoading] = useState(true);
  const [conversaoAutomatica, setConversaoAutomatica] = useState(false);
  const [chavePix, setChavePix] = useState('');
  const [chavePixLoading, setChavePixLoading] = useState(false);

  useEffect(() => {
    loadBrowsers();
    loadSettings();
  }, []);

  const loadBrowsers = async () => {
    try {
      const res = await api.get('/configuracoes/navegadores');
      setBrowsers(res.data);
      if (res.data.length > 0) {
        const defaultOrder = ['Firefox', 'Chromium', 'Chrome', 'Brave', 'Opera'];
        const preferred = res.data.find(b => defaultOrder.includes(b.name));
        if (preferred) setSelectedBrowser(preferred.command);
      }
    } catch (err) {
      setBrowsers([{ name: 'Firefox', command: 'firefox', path: '/usr/bin/firefox' }]);
    } finally {
      setBrowserLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await api.get('/configuracoes');
      if (res.data.navegador) setSelectedBrowser(res.data.navegador);
      setConversaoAutomatica(res.data.conversao_automatica === 'true');
      if (res.data.chavePix) setChavePix(res.data.chavePix);
    } catch (err) {
      console.error('Erro ao carregar configurações');
    }
  };

  const saveConversaoAutomatica = async (value) => {
    setConversaoAutomatica(value);
    try {
      await api.put('/configuracoes', { chave: 'conversao_automatica', valor: String(value) });
      setMessage('Configuração salva com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Erro ao salvar configuração');
    }
  };

  const saveBrowser = async () => {
    try {
      await api.put('/configuracoes', { chave: 'navegador', valor: selectedBrowser });
      setMessage('Navegador padrão alterado com sucesso!');
    } catch (err) {
      setError('Erro ao salvar navegação');
    }
  };

  const saveChavePix = async () => {
    setChavePixLoading(true);
    try {
      await api.put('/configuracoes', { chave: 'chavePix', valor: chavePix });
      setMessage('Chave PIX salva com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Erro ao salvar chave PIX');
    } finally {
      setChavePixLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      setMessage('Senha alterada com sucesso!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Configurações</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-100 rounded-lg">
            <User className="text-indigo-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Perfil</h2>
            <p className="text-sm text-gray-500">Suas informações pessoais</p>
</div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-purple-100 rounded-lg">
            <QrCode className="text-purple-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">PIX</h2>
            <p className="text-sm text-gray-500">Chave PIX para receber pagamentos</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chave PIX</label>
            <input
              type="text"
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="CPF, telefone, e-mail ou chave aleatória"
            />
          </div>
          <button
            onClick={saveChavePix}
            disabled={chavePixLoading}
            className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {chavePixLoading ? 'Salvando...' : 'Salvar Chave PIX'}
          </button>
        </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Lock className="text-indigo-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Alterar Senha</h2>
              <p className="text-sm text-gray-500">Atualize sua senha de acesso</p>
            </div>
          </div>

          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <CheckCircle size={18} />
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha Atual</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
