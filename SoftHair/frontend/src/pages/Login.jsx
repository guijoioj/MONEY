import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Scissors, UserPlus, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../services/api';

/**
 * P3-C1: setup wizard inline na primeira utilização.
 *  - GET /api/auth/needs-setup → se true, mostra form de bootstrap-admin
 *  - POST /api/auth/bootstrap-admin para criar primeiro admin com senha forte
 *  - Após sucesso, mostra mensagem e volta para login
 *
 * P3-M1: removido link "Cadastre-se" e Register page (não há multi-signup público).
 * P3-M2: link "Esqueceu a senha?" removido — não há email server local.
 */
function isStrongPasswordClient(senha) {
  if (typeof senha !== 'string' || senha.length < 8) return false;
  if (!/[a-z]/.test(senha)) return false;
  if (!/[A-Z]/.test(senha)) return false;
  if (!/\d/.test(senha)) return false;
  return true;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // P3-C1: estado de setup wizard
  const [needsSetup, setNeedsSetup] = useState(null); // null = unknown, true/false = decided
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  // P3-C1: detectar primeira instalação
  useEffect(() => {
    let alive = true;
    api.get('/auth/needs-setup')
      .then((res) => {
        if (!alive) return;
        setNeedsSetup(!!res.data?.data?.needsSetup);
      })
      .catch(() => {
        if (!alive) return;
        setNeedsSetup(false);
      });
    return () => { alive = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/clientes');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isStrongPasswordClient(setupPassword)) {
      setError('Senha fraca: use 8+ caracteres com maiúscula, minúscula e número.');
      return;
    }
    if (setupPassword !== setupPasswordConfirm) {
      setError('Senhas não coincidem.');
      return;
    }
    setSetupLoading(true);
    try {
      await api.post('/auth/bootstrap-admin', {
        nome: setupName,
        email: setupEmail,
        senha: setupPassword,
      });
      setSetupSuccess(true);
      setEmail(setupEmail);
      // Pré-preenche login com o email recém criado
      setTimeout(() => {
        setNeedsSetup(false);
        setSetupSuccess(false);
      }, 1800);
    } catch (err) {
      const errs = err.response?.data?.errors;
      if (Array.isArray(errs) && errs.length > 0) {
        setError(errs.map((e) => e.msg).join(' · '));
      } else {
        setError(err.response?.data?.error || 'Erro ao criar admin');
      }
    } finally {
      setSetupLoading(false);
    }
  };

  if (needsSetup === null) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // P3-C1: tela de setup wizard
  if (needsSetup) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md w-full max-w-md p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg mb-4">
              <UserPlus className="text-indigo-600 dark:text-indigo-400" size={28} />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Primeiro Acesso</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Crie a conta de administrador deste salão
            </p>
          </div>

          {setupSuccess && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 text-green-700 dark:text-green-300 px-4 py-2.5 rounded-md text-sm mb-4 flex items-center gap-2">
              <CheckCircle size={18} />
              Admin criado com sucesso! Faça login abaixo.
            </div>
          )}

          {error && !setupSuccess && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-md text-sm mb-4 flex items-start gap-2">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSetupSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Seu nome</label>
              <input
                type="text"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                placeholder="Administrador"
                required
                disabled={setupLoading || setupSuccess}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
              <input
                type="email"
                value={setupEmail}
                onChange={(e) => setSetupEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                placeholder="seu@email.com"
                required
                disabled={setupLoading || setupSuccess}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Senha</label>
              <input
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                placeholder="Mínimo 8 caracteres, maiúscula, minúscula e número"
                required
                minLength={8}
                disabled={setupLoading || setupSuccess}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Mínimo 8 caracteres com pelo menos uma maiúscula, uma minúscula e um número.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Confirme a senha</label>
              <input
                type="password"
                value={setupPasswordConfirm}
                onChange={(e) => setSetupPasswordConfirm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                required
                minLength={8}
                disabled={setupLoading || setupSuccess}
              />
            </div>
            <button
              type="submit"
              disabled={setupLoading || setupSuccess}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-md font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {setupLoading ? 'Criando...' : 'Criar conta admin'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg mb-4">
            <Scissors className="text-indigo-600 dark:text-indigo-400" size={28} />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Salão de Beleza</h1>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1 text-sm">Sistema de Administração</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-md font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
