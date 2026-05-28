// Sistema de temas — por usuário, com cor de fundo e foto de fundo.
// Aplica via CSS variables + background no body. Persiste em localStorage por usuário.

export const DEFAULT_THEME = {
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
  backgroundImage: '', // data URL (foto de fundo). Vazio = sem foto.
};

// Chave por usuário (cada perfil tem o seu tema). Sem usuário → chave global legada.
export function themeKey(userId) {
  return userId ? `theme_config_${userId}` : 'theme_config';
}

// Nome do salão: identidade do salão (global, não por usuário).
// Aparece ao lado da logo no topo. Editável na Personalização.
export const DEFAULT_SALAO_NOME = 'Salão de Beleza';
const SALAO_NOME_KEY = 'salao_nome';

export function loadSalaoNome() {
  try {
    return localStorage.getItem(SALAO_NOME_KEY) || DEFAULT_SALAO_NOME;
  } catch {
    return DEFAULT_SALAO_NOME;
  }
}

export function saveSalaoNome(nome) {
  try {
    const v = (nome && nome.trim()) || DEFAULT_SALAO_NOME;
    localStorage.setItem(SALAO_NOME_KEY, v);
    // Avisa o Layout (mesma aba) pra atualizar na hora.
    window.dispatchEvent(new CustomEvent('salao-nome-changed', { detail: v }));
  } catch {}
}

export function loadTheme(userId) {
  try {
    const s = localStorage.getItem(themeKey(userId)) || localStorage.getItem('theme_config');
    return s ? { ...DEFAULT_THEME, ...JSON.parse(s) } : { ...DEFAULT_THEME };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export function saveTheme(userId, theme) {
  try {
    localStorage.setItem(themeKey(userId), JSON.stringify(theme));
  } catch {}
}

// Aplica o tema no documento (CSS vars + foto de fundo + logo + CSS custom).
export function applyTheme(t = DEFAULT_THEME) {
  const root = document.documentElement;
  const map = {
    '--color-primary': t.primary,
    '--color-primary-light': t.primaryLight,
    '--color-secondary': t.secondary,
    '--color-background': t.background,
    '--color-surface': t.surface,
    '--color-text': t.text,
    '--color-text-light': t.textLight,
    '--color-success': t.success,
    '--color-warning': t.warning,
    '--color-error': t.error,
    '--color-border': t.border,
  };
  Object.entries(map).forEach(([k, v]) => { if (v) root.style.setProperty(k, v); });

  // Foto de fundo: aplica no body. Marca html.has-bg-image pra os containers ficarem
  // transparentes (CSS) e a foto aparecer atrás do app.
  const body = document.body;
  if (t.backgroundImage) {
    body.style.backgroundImage = `url("${t.backgroundImage}")`;
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundAttachment = 'fixed';
    body.style.backgroundRepeat = 'no-repeat';
    root.classList.add('has-bg-image');
  } else {
    body.style.backgroundImage = '';
    root.classList.remove('has-bg-image');
  }

  if (t.logoUrl) {
    document.querySelectorAll('.app-logo').forEach(el => { el.src = t.logoUrl; });
  }

  let el = document.getElementById('custom-theme-css');
  if (t.customCss) {
    if (!el) { el = document.createElement('style'); el.id = 'custom-theme-css'; document.head.appendChild(el); }
    el.textContent = t.customCss;
  } else if (el) {
    el.textContent = '';
  }
}
