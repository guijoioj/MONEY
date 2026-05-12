import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

export default function ForgotPassword() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
          <Mail className="text-indigo-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Recuperação de Senha</h1>
        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-6">
          Esta funcionalidade não está disponível. Entre em contato com o administrador do sistema.
        </p>
        <Link
          to="/login"
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Voltar para Login
        </Link>
      </div>
    </div>
  );
}
