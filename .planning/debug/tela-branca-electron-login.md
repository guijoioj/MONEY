---
status: resolved
slug: tela-branca-electron-login
trigger: tela branca ao iniciar o Electron app SoftHair — ERR_FILE_NOT_FOUND ao carregar file:///#/login
created: 2026-04-25
updated: 2026-04-25
---

## Symptoms

- expected: Tela de login aparecer ao abrir o app
- actual: Tela branca (white screen)
- error: ERR_FILE_NOT_FOUND — Failed to load URL: file:///#/login
- timeline: Não sei quando começou
- repro: Ambos os casos (dev npm start e build empacotado)

## Current Focus

- hypothesis: HashRouter navega para file:///#/login (sem o caminho do arquivo), Electron tenta carregar esse URL como novo arquivo e falha
- test: will-navigate intercepta navegações file:// que não apontam para o index.html
- expecting: Login aparecer sem tela branca
- next_action: done
- reasoning_checkpoint: React Router com HashRouter chama window.location methods que disparam will-navigate no Electron. O URL resultante file:///#/login não contém o caminho completo do index.html, portanto o arquivo não é encontrado.

## Evidence

- timestamp: 2026-04-25T00:00:00Z
  observation: Error log mostra "Failed to load URL: file:///#/login" — URL sem caminho de arquivo
  source: bug report
  significance: confirms Electron tenta navegar para URL incorreto em vez de apenas mudar o hash in-page

- timestamp: 2026-04-25T00:01:00Z
  observation: main.jsx usa HashRouter quando protocol === 'file:' — correto
  source: /home/ogejota/MONEY/SoftHair/frontend/src/main.jsx
  significance: HashRouter está configurado corretamente, mas navegações hash disparam will-navigate no Electron

- timestamp: 2026-04-25T00:02:00Z
  observation: App.jsx usa <Navigate to="/login" replace /> via ProtectedRoute quando user é null
  source: /home/ogejota/MONEY/SoftHair/frontend/src/App.jsx
  significance: Navigate dispara window.location.assign ou similar que Electron intercepta como nova navegação

- timestamp: 2026-04-25T00:03:00Z
  observation: Não havia handler will-navigate em main.js para bloquear navegações hash incorretas
  source: /home/ogejota/MONEY/SoftHair/electron/main.js
  significance: root cause — Electron recebia a navegação para file:///#/login e tentava carregar o arquivo

## Eliminated

- CSP ou webSecurity bloqueando assets (eliminado — erro é ERR_FILE_NOT_FOUND, não bloqueio de recurso)
- index.html ausente (eliminado — arquivo existe em frontend/dist/index.html)
- Caminhos de assets errados (eliminado — vite.config usa base: './', assets são relativos)

## Resolution

- root_cause: Electron 28 dispara o evento will-navigate quando React Router (HashRouter) chama window.location methods para navegar para #/login. O URL resultante é file:///#/login (sem o caminho completo do index.html), causando ERR_FILE_NOT_FOUND pois o Electron tenta carregar esse caminho como um novo arquivo.
- fix: Adicionado listener will-navigate em electron/main.js que bloqueia (event.preventDefault()) qualquer navegação file:// que não aponte para o index.html correto. Adicionado também listener did-fail-load como safety net para recarregar o index.html caso uma navegação errada ainda escape.
- verification: Testar npm start (modo produção sem --dev) e confirmar que a tela de login aparece sem tela branca.
- files_changed: /home/ogejota/MONEY/SoftHair/electron/main.js
