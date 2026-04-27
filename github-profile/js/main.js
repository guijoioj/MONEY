/**
 * BERSERK PROFILE - MAIN ENTRY POINT
 * Importa e inicializa todos os módulos
 */

import { ParticlesSystem } from './particles.js';
import { Terminal } from './terminal.js';
import { SnakeGame } from './snake-game.js';
import { GitHubStats } from './github-stats.js';
import { AnimationsController } from './animations.js';

/**
 * Inicialização do perfil
 * Todos os módulos são auto-inicializáveis, mas importamos
 * para garantir que o bundler inclua todos no build
 */

// Configuração global
window.APP_CONFIG = {
    githubUsername: 'guijoioj',
    theme: 'berserk',
    version: '1.0.0'
};

// Debug mode
const isDebug = window.location.hostname === 'localhost';
if (isDebug) {
    console.log('%c⚔️ BERSERK PROFILE LOADED', 'color: #8B0000; font-size: 20px; font-weight: bold;');
    console.log('Config:', window.APP_CONFIG);
}

// Performance monitoring
if (isDebug && 'performance' in window) {
    window.addEventListener('load', () => {
        setTimeout(() => {
            const perf = performance.getEntriesByType('navigation')[0];
            if (perf) {
                console.log(`Page loaded in ${perf.loadEventEnd.toFixed(2)}ms`);
            }
        }, 1000);
    });
}

// Service Worker registration (optional PWA support)
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW registration failed:', err));
    });
}

// Handle visibility change (pause game when tab hidden)
let isPageVisible = true;
document.addEventListener('visibilitychange', () => {
    isPageVisible = document.visibilityState === 'visible';

    if (!isPageVisible) {
        // Could pause game here if needed
        document.body.classList.add('tab-hidden');
    } else {
        document.body.classList.remove('tab-hidden');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+K to focus terminal
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        const terminalInput = document.getElementById('terminal-input');
        if (terminalInput) {
            terminalInput.focus();
        }
    }
});

// Prevent context menu on canvas (game)
const gameCanvas = document.getElementById('snake-canvas');
if (gameCanvas) {
    gameCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Add loading complete class
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');
});

// Export for external access
export default {
    config: window.APP_CONFIG,
    isDebug
};
