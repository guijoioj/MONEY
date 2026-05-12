import { useState, useEffect, useCallback } from 'react';
import { Save, Upload, RotateCcw, Eye, Code, Palette } from 'lucide-react';

const defaultTheme = {
  primary: '#db2777',
  primaryLight: '#f472b6',
  secondary: '#6366f1',
  background: '#f3f4f6',
  surface: '#ffffff',
  text: '#1f2937',
  textLight: '#6b7280',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  border: '#e5e7eb',
  logoUrl: '',
  customCss: '',
};

export default function Customizacao() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme_config');
    return saved ? JSON.parse(saved) : defaultTheme;
  });
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('colors');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const colorPresets = [
    { name: 'Rosa', primary: '#db2777', secondary: '#ec4899' },
    { name: 'Azul', primary: '#2563eb', secondary: '#3b82f6' },
    { name: 'Roxo', primary: '#7c3aed', secondary: '#8b5cf6' },
    { name: 'Verde', primary: '#059669', secondary: '#10b981' },
    { name: 'Laranja', primary: '#ea580c', secondary: '#f97316' },
    { name: 'Vermelho', primary: '#dc2626', secondary: '#ef4444' },
  ];

  const applyTheme = useCallback((themeConfig) => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', themeConfig.primary);
    root.style.setProperty('--color-primary-light', themeConfig.primaryLight);
    root.style.setProperty('--color-secondary', themeConfig.secondary);
    root.style.setProperty('--color-background', themeConfig.background);
    root.style.setProperty('--color-surface', themeConfig.surface);
    root.style.setProperty('--color-text', themeConfig.text);
    root.style.setProperty('--color-text-light', themeConfig.textLight);
    root.style.setProperty('--color-success', themeConfig.success);
    root.style.setProperty('--color-warning', themeConfig.warning);
    root.style.setProperty('--color-error', themeConfig.error);
    root.style.setProperty('--color-border', themeConfig.border);

    if (themeConfig.logoUrl) {
      const logoElements = document.querySelectorAll('.app-logo');
      logoElements.forEach(el => {
        el.src = themeConfig.logoUrl;
      });
    }

    if (themeConfig.customCss) {
      let customStyleEl = document.getElementById('custom-theme-css');
      if (!customStyleEl) {
        customStyleEl = document.createElement('style');
        customStyleEl.id = 'custom-theme-css';
        document.head.appendChild(customStyleEl);
      }
      customStyleEl.textContent = themeConfig.customCss;
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem('theme_config', JSON.stringify(theme));
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 500);
  };

  const handleReset = () => {
    if (window.confirm('Tem certeza que deseja redefinir o tema para o padrão?')) {
      setTheme(defaultTheme);
      localStorage.removeItem('theme_config');
    }
  };

  const handlePreset = (preset) => {
    setTheme({ ...theme, primary: preset.primary, primaryLight: preset.secondary });
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2MB');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setTheme({ ...theme, logoUrl: event.target.result });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const colorInputs = [
    { key: 'primary', label: 'Cor Primária' },
    { key: 'primaryLight', label: 'Cor Primária Clara' },
    { key: 'secondary', label: 'Cor Secundária' },
    { key: 'background', label: 'Fundo' },
    { key: 'surface', label: 'Superfície' },
    { key: 'text', label: 'Texto Principal' },
    { key: 'textLight', label: 'Texto Secundário' },
    { key: 'success', label: 'Sucesso' },
    { key: 'warning', label: 'Alerta' },
    { key: 'error', label: 'Erro' },
    { key: 'border', label: 'Bordas' },
  ];

  const previewComponent = () => (
    <div className="space-y-4 p-4 bg-[var(--color-background)] rounded-lg">
      <h4 className="font-semibold text-[var(--color-text)]">Preview do Tema</h4>
      
      <nav className="bg-[var(--color-primary)] text-white p-4 rounded-lg">
        <div className="flex items-center gap-4">
          {theme.logoUrl && (
            <img src={theme.logoUrl} alt="Logo" className="h-8 w-auto" />
          )}
          <span className="font-bold">Salão de Beleza</span>
        </div>
      </nav>

      <div className="grid grid-cols-3 gap-2">
        {colorInputs.slice(0, 6).map(({ key }) => (
          <div key={key} className="text-center">
            <div 
              className="w-full h-12 rounded-lg border border-gray-300 dark:border-gray-600" 
              style={{ backgroundColor: theme[key] }}
            />
            <span className="text-xs text-[var(--color-text-light)] mt-1 block">{key}</span>
          </div>
        ))}
      </div>

      <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
        <h5 className="font-medium text-[var(--color-text)] mb-2">Card de Exemplo</h5>
        <p className="text-[var(--color-text-light)] text-sm mb-3">
          Este é um exemplo de como o tema aparece nos componentes.
        </p>
        <button className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg mr-2">
          Botão Primário
        </button>
        <button className="border border-[var(--color-primary)] text-[var(--color-primary)] px-4 py-2 rounded-lg">
          Botão Secundário
        </button>
      </div>

      <div className="flex gap-2">
        <span className="px-2 py-1 bg-[var(--color-success)] text-white text-xs rounded">Sucesso</span>
        <span className="px-2 py-1 bg-[var(--color-warning)] text-white text-xs rounded">Alerta</span>
        <span className="px-2 py-1 bg-[var(--color-error)] text-white text-xs rounded">Erro</span>
      </div>

      <input 
        type="text" 
        placeholder="Input de exemplo"
        className="w-full p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] bg-[var(--color-surface)]"
      />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Customização do Sistema</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${showPreview ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'}`}
          >
            <Eye size={18} />
            {showPreview ? 'Ocultar Preview' : 'Ver Preview'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
          >
            <RotateCcw size={18} />
            Redefinir
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      {showPreview && previewComponent()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex gap-4 border-b mb-6">
            <button
              onClick={() => setActiveTab('colors')}
              className={`pb-2 px-1 flex items-center gap-2 ${activeTab === 'colors' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <Palette size={18} />
              Cores
            </button>
            <button
              onClick={() => setActiveTab('css')}
              className={`pb-2 px-1 flex items-center gap-2 ${activeTab === 'css' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <Code size={18} />
              CSS Custom
            </button>
            <button
              onClick={() => setActiveTab('logo')}
              className={`pb-2 px-1 flex items-center gap-2 ${activeTab === 'logo' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <Upload size={18} />
              Logo
            </button>
          </div>

          {activeTab === 'colors' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3">Predefinições de Tema</h3>
                <div className="flex flex-wrap gap-3">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handlePreset(preset)}
                      className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                    >
                      <div className="flex gap-1">
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: preset.primary }} />
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: preset.secondary }} />
                      </div>
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3">Paleta de Cores</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {colorInputs.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          value={theme[key]}
                          onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
                          className="w-12 h-12 rounded-lg cursor-pointer border-0"
                          style={{ padding: 0 }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>
                        <input
                          type="text"
                          value={theme[key]}
                          onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded mt-1"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'css' && (
            <div>
              <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3">CSS Personalizado</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Adicione CSS customizado para personalizar ainda mais a aparência do sistema.
              </p>
              <textarea
                value={theme.customCss}
                onChange={(e) => setTheme({ ...theme, customCss: e.target.value })}
                className="w-full h-96 p-4 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={`/* Exemplo de CSS customizado */\n\n.btn-special {\n  background: linear-gradient(45deg, var(--color-primary), var(--color-secondary));\n  border-radius: 20px;\n}`}
              />
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">Dicas de CSS</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Use variáveis CSS: <code className="bg-yellow-100 px-1 rounded">var(--color-primary)</code></li>
                  <li>• Sobrescreva estilos existentes para personalização avançada</li>
                  <li>• Use <code className="bg-yellow-100 px-1 rounded">!important</code> para forçar estilos</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'logo' && (
            <div>
              <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-3">Logo do Sistema</h3>
              
              {theme.logoUrl && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <img 
                    src={theme.logoUrl} 
                    alt="Logo atual" 
                    className="max-h-20 mx-auto"
                  />
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">Logo atual</p>
                </div>
              )}

              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600 dark:text-gray-300 mb-4">Arraste uma imagem ou clique para selecionar</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <label
                  htmlFor="logo-upload"
                  className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-indigo-700"
                >
                  {uploading ? 'Enviando...' : 'Selecionar Imagem'}
                </label>
                <p className="text-sm text-gray-400 mt-4">PNG, JPG ou SVG. Máximo 2MB.</p>
              </div>

              {theme.logoUrl && (
                <button
                  onClick={() => setTheme({ ...theme, logoUrl: '' })}
                  className="mt-4 w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  Remover Logo
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-4">Resumo do Tema</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.primary }} />
                <span className="text-sm font-medium">Primária</span>
              </div>
              <input
                type="text"
                value={theme.primary}
                readOnly
                className="w-full px-3 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-900"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.secondary }} />
                <span className="text-sm font-medium">Secundária</span>
              </div>
              <input
                type="text"
                value={theme.secondary}
                readOnly
                className="w-full px-3 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-900"
              />
            </div>

            <div className="pt-4 border-t">
              <div className="grid grid-cols-4 gap-2 mb-4">
                {Object.entries(theme).slice(0, 8).map(([key, value]) => (
                  <div
                    key={key}
                    className="w-full aspect-square rounded"
                    style={{ backgroundColor: value }}
                    title={key}
                  />
                ))}
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Logo:</p>
              {theme.logoUrl ? (
                <img src={theme.logoUrl} alt="Logo" className="h-8 mx-auto" />
              ) : (
                <p className="text-sm text-gray-400 text-center">Nenhum logo definido</p>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              const dataStr = JSON.stringify(theme, null, 2);
              const blob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'tema-personalizado.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="mt-6 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 text-sm"
          >
            Exportar Tema
          </button>

          <div className="mt-4">
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Importar Tema:</label>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const imported = JSON.parse(event.target.result);
                      setTheme(imported);
                    } catch {
                      alert('Arquivo de tema inválido');
                    }
                  };
                  reader.readAsText(file);
                }
              }}
              className="w-full text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
