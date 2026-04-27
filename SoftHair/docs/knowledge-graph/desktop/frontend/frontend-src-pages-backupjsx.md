# frontend/src/pages/Backup.jsx

**Repository:** Desktop
**File:** `frontend/src/pages/Backup.jsx`
**Language:** `jsx`

---

#desktop #source

## Resumo

Arquivo `frontend/src/pages/Backup.jsx` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/security|security]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```jsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupAPI } from '../services/api';
import { Database, Upload, Download, Cloud, RefreshCw, CheckCircle, X, AlertCircle, Settings, Folder, Key } from 'lucide-react';

export default function Backup() {
  const [activeTab, setActiveTab] = useState('local');
  const [showConfig, setShowConfig] = useState(false);
  const [googleCode, setGoogleCode] = useState('');
  const [driveConfig, setDriveConfig] = useState(() => {
    const saved = localStorage.getItem('google_drive_config');
    return saved ? JSON.parse(saved) : {
      clientId: '',
      clientSecret: '',
      folderName: 'Salao de Beleza Backups',
      folderId: '',
    };
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const queryClient = useQueryClient();

  const { data: localBackups, isLoading: loadingLocal } = useQuery({
    queryKey: ['backups-local'],
    queryFn: () => backupAPI.getLocal(),
  });

  const { data: cloudStatus } = useQuery({
    queryKey: ['backup-cloud-status'],
    queryFn: () => backupAPI.getCloudStatus(),
    enabled: isConfigured,
  });

  const { data: cloudFiles } = useQuery({
    queryKey: ['backup-cloud-files'],
    queryFn: () => backupAPI.getCloudFiles(),
    enabled: cloudStatus?.data?.authenticated,
  });

  const createMutation = useMutation({
    mutationFn: () => backupAPI.create(),
    onSuccess: () => {
      queryClient.invalidateQueries(['backups-local']);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (filename) => backupAPI.restore(filename),
    onSuccess: () => {
      alert('Backup restaurado com sucesso!');
    },
  });

  const syncMutation = useMutation({
    mutationFn: (filename) => backupAPI.syncToCloud(filename),
    onSuccess: () => {
      queryClient.invalidateQueries(['backups-local']);
      alert('Backup sincronizado com sucesso!');
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      localStorage.setItem('google_drive_config', JSON.stringify(driveConfig));
      setIsConfigured(driveConfig.clientId && driveConfig.clientSecret);
      setShowConfig(false);
      return { success: true };
    },
    onSuccess: () => {
      alert('Configurações salvas! Recarregue a página para aplicar.');
    },
  });

  useEffect(() => {
    const saved = localStorage.getItem('google_drive_config');
    if (saved) {
      const config = JSON.parse(saved);
      setIsConfigured(!!(config.clientId && config.clientSecret));
    }
  }, []);

  const handleGoogleAuth = async () => {
    if (!driveConfig.clientId || !driveConfig.clientSecret) {
      alert('Configure o Client ID e Client Secret primeiro!');
      return;
    }
    
    try {
      const response = await backupAPI.getAuthUrl();
      const authUrl = response.data.authUrl;
      window.open(authUrl, '_blank', 'width=600,height=700');
    } catch (error) {
      alert('Erro ao obter URL de autenticação: ' + (error.message || 'Verifique as configurações'));
    }
  };

  const handleCodeSubmit = async () => {
    if (!googleCode) return;
    
    try {
      await backupAPI.googleCallback(googleCode);
      queryClient.invalidateQueries(['backup-cloud-status']);
      queryClient.invalidateQueries(['backup-cloud-files']);
      setGoogleCode('');
      alert('Autenticado com sucesso!');
    } catch (error) {
      alert('Erro ao autenticar: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Backup e Restauração</h1>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${showConfig ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'hover:bg-gray-50'}`}
        >
          <Settings size={18} />
          Configurar Google Drive
        </button>
      </div>

      {showConfig && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-indigo-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Key size={20} className="text-indigo-600" />
              Configurações do Google Drive
            </h2>
            <button onClick={() => setShowConfig(false)} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-800 mb-2">Como obter as credenciais:</h3>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
              <li>Crie um novo projeto ou selecione um existente</li>
              <li>Ative a "Google Drive API"</li>
              <li>Vá em "Credenciais" → "Criar Credenciais" → "ID do cliente OAuth 2.0"</li>
              <li>Tipo: "Aplicativo da Web"</li>
              <li>URIs de redirecionamento: <code className="bg-blue-100 px-1 rounded">http://localhost:3001/auth/google/callback</code></li>
              <li>Copie o "Client ID" e "Client Secret" para os campos abaixo</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client ID *</label>
              <input
                type="text"
                value={driveConfig.clientId}
                onChange={(e) => setDriveConfig({ ...driveConfig, clientId: e.target.value })}
                placeholder="123456789-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret *</label>
              <input
                type="password"
                value={driveConfig.clientSecret}
                onChange={(e) => setDriveConfig({ ...driveConfig, clientSecret: e.target.value })}
                placeholder="GOCSPX-xxxxxxxxxxxxx"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Pasta de Destino</label>
            <div className="flex gap-2">
              <Folder className="text-gray-400 mt-3" size={20} />
              <input
                type="text"
                value={driveConfig.folderName}
                onChange={(e) => setDriveConfig({ ...driveConfig, folderName: e.target.value })}
                placeholder="Salao de Beleza Backups"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              A pasta será criada automaticamente no Google Drive se não existir
            </p>
          </div>

          <button
            onClick={() => saveConfigMutation.mutate()}
            disabled={!driveConfig.clientId || !driveConfig.clientSecret}
            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            Salvar Configurações
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('local')}
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'local' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          <Database size={18} className="inline mr-2" />
          Backups Locais
        </button>
        <button
          onClick={() => setActiveTab('cloud')}
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'cloud' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          <Cloud size={18} className="inline mr-2" />
          Google Drive
        </button>
      </div>

      {activeTab === 'local' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Database className="text-indigo-600" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Backup Local</h2>
                <p className="text-sm text-gray-500">Crie e gerencie backups do banco de dados</p>
              </div>
            </div>

            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 mb-6"
            >
              <Upload size={20} />
              {createMutation.isPending ? 'Criando backup...' : 'Criar Novo Backup'}
            </button>

            {createMutation.isSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                <CheckCircle size={18} />
                Backup criado com sucesso!
              </div>
            )}

            <h3 className="font-medium text-gray-700 mb-3">Backups Disponíveis</h3>
            {loadingLocal ? (
              <div className="text-center py-4 text-gray-500">Carregando...</div>
            ) : localBackups?.data?.data?.length === 0 ? (
              <p className="text-center py-4 text-gray-400">Nenhum backup encontrado</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {localBackups?.data?.data?.map((backup) => (
                  <div key={backup.filename} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-gray-800">{backup.filename}</div>
                        <div className="text-sm text-gray-500">{formatDate(backup.createdAt)}</div>
                      </div>
                      <span className="text-sm text-gray-500">{formatSize(backup.size)}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          if (confirm('Deseja restaurar este backup? Os dados atuais serão substituídos.')) {
                            restoreMutation.mutate(backup.filename);
                          }
                        }}
                        disabled={restoreMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm disabled:opacity-50"
                      >
                        <Download size={16} />
                        Restaurar
                      </button>
                      {isConfigured && cloudStatus?.data?.authenticated && (
                        <button
                          onClick={() => syncMutation.mutate(backup.filename)}
                          disabled={syncMutation.isPending}
                          className="flex items-center justify-center gap-1 px-3 py-2 bg-green-50 text-green-600 rounded hover:bg-green-100 text-sm disabled:opacity-50"
                          title="Enviar para Google Drive"
                        >
                          <Cloud size={16} />
                        </button>
                      )}
                    </div>
                    {backup.syncedToCloud && (
                      <div className="mt-2 flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle size={14} />
                        Sincronizado
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-medium text-gray-700 mb-4">Exportar para Outro Computador</h3>
            <p className="text-sm text-gray-500 mb-4">
              Baixe um backup e restaure em qualquer máquina.
            </p>
            {localBackups?.data?.data?.length > 0 && (
              <a
                href={`data:application/json;base64,${btoa(JSON.stringify(localBackups.data.data[0]))}`}
                download={localBackups.data.data[0].filename}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <Download size={18} />
                Baixar Último Backup
              </a>
            )}
          </div>
        </div>
      )}

      {activeTab === 'cloud' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-3 rounded-lg ${cloudStatus?.data?.authenticated ? 'bg-green-100' : 'bg-yellow-100'}`}>
              <Cloud className={cloudStatus?.data?.authenticated ? 'text-green-600' : 'text-yellow-600'} size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Google Drive</h2>
              <p className="text-sm text-gray-500">
                {cloudStatus?.data?.authenticated ? 'Conectado ✓' : 'Sincronize backups na nuvem'}
              </p>
            </div>
          </div>

          {!isConfigured ? (
            <div className="text-center py-8">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg inline-block mb-4">
                <AlertCircle className="text-yellow-600 mx-auto" size={32} />
              </div>
              <h3 className="font-medium text-gray-800 mb-2">Google Drive não configurado</h3>
              <p className="text-sm text-gray-500 mb-4">
                Clique em "Configurar Google Drive" acima para adicionar suas credenciais
              </p>
            </div>
          ) : cloudStatus?.data?.authenticated ? (
            <div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle size={20} />
                  <span className="font-medium">Google Drive conectado com sucesso!</span>
                </div>
                <p className="text-sm text-green-600">
                  Pasta: <strong>{driveConfig.folderName}</strong>
                </p>
              </div>

              <h3 className="font-medium text-gray-700 mb-3">Backups no Google Drive</h3>
              {cloudFiles?.data?.data?.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {cloudFiles.data.data.map((file) => (
                    <div key={file.id} className="border rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-800">{file.name}</div>
                        <div className="text-sm text-gray-500">{formatSize(file.size)}</div>
                      </div>
                      <a
                        href={`https://drive.google.com/file/d/${file.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm"
                      >
                        Ver no Drive
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-4 text-gray-400">
                  Nenhum backup encontrado no Google Drive.<br />
                  Clique em sincronizar nos backups locais.
                </p>
              )}

              <button
                onClick={() => queryClient.invalidateQueries(['backup-cloud-files'])}
                className="mt-4 flex items-center gap-2 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg"
              >
                <RefreshCw size={18} />
                Atualizar lista
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-yellow-700">
                  Você precisa autorizar o acesso ao Google Drive.
                </div>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-700 mb-2">1. Clique no botão abaixo</h4>
                <button
                  onClick={handleGoogleAuth}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 mb-4"
                >
                  <Cloud size={20} />
                  Autorizar Google Drive
                </button>

                <h4 className="font-medium text-gray-700 mb-2">2. Cole o código de autorização</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Cole o código aqui (4 códigos separados por pontos)"
                    value={googleCode}
                    onChange={(e) => setGoogleCode(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleCodeSubmit}
                    disabled={!googleCode}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  O código será fornecido pelo Google após você autorizar o acesso
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h3 className="font-medium text-gray-700 mb-4">Instruções</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-indigo-600">1.</span>
            Clique em "Criar Novo Backup" para gerar uma cópia do banco de dados
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-600">2.</span>
            Para restaurar um backup, clique em "Restaurar" no backup desejado
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-600">3.</span>
            Configure o Google Drive para sincronizar backups automaticamente
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-600">4.</span>
            Para usar em outro computador, baixe o backup local e restaure nele
          </li>
        </ul>
      </div>
    </div>
  );
}
```
