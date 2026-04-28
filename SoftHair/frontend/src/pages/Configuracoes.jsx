import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, CheckCircle } from 'lucide-react';

export default function Configuracoes() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Configurações</h1>

      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle size={18} />
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-indigo-100 rounded-lg">
            <User className="text-indigo-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Perfil</h2>
            <p className="text-sm text-gray-500">Suas informações pessoais</p>
          </div>
        </div>
        <div className="space-y-2 text-sm text-gray-700">
          <p><span className="font-medium">Nome:</span> {user?.nome || user?.name || '—'}</p>
          <p><span className="font-medium">Email:</span> {user?.email || '—'}</p>
        </div>
      </div>
    </div>
  );
}
