import { Database, AlertCircle } from 'lucide-react';

export default function Backup() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Database size={24} className="text-gray-600 dark:text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Backup e Restauração</h1>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 rounded-xl p-8 text-center">
        <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
        <h2 className="text-lg font-semibold text-yellow-800 mb-2">Funcionalidade não disponível</h2>
        <p className="text-yellow-700 text-sm">
          O módulo de backup não está disponível nesta versão do servidor.
        </p>
      </div>
    </div>
  );
}
