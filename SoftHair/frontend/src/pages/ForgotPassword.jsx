import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

// P3-M2: app desktop single-user — não há email server local nem multi-user.
// Senão a senha, mostrar instruções concretas para reset manual.
export default function ForgotPassword() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
          <ShieldAlert className="text-indigo-600 dark:text-indigo-400" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Recuperação de Senha</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
          O SoftHair é um app desktop single-user — não há serviço de email para enviar reset.
        </p>
        <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">
          Para resetar, apague o arquivo <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">secrets.json</code> e
          <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded ml-1">local.db</code> em
          <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded ml-1">%APPDATA%\SoftHair</code> (Windows) ou
          <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded ml-1">~/.config/SoftHair</code> (Linux) e
          reinstale. Faça backup dos dados antes.
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
