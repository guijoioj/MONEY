# Graph Report - .  (2026-05-02)

## Corpus Check
- Large corpus: 688 files · ~191,523 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 294 nodes · 388 edges · 32 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_serverApi.js  SoftHairApiClient|serverApi.js / SoftHairApiClient]]
- [[_COMMUNITY_cmd_find()  cmd_index()|cmd_find() / cmd_index()]]
- [[_COMMUNITY_enrich_knowledge_graph.py  collect_notes()|enrich_knowledge_graph.py / collect_notes()]]
- [[_COMMUNITY_syncManager.js  SoftHairSyncManager|syncManager.js / SoftHairSyncManager]]
- [[_COMMUNITY_Administrativo()  CheckOutSection()|Administrativo() / CheckOutSection()]]
- [[_COMMUNITY_cmd_export()  build_index()|cmd_export() / build_index()]]
- [[_COMMUNITY_collect_files_for_repo()  collect_git_history()|collect_files_for_repo() / collect_git_history()]]
- [[_COMMUNITY_App()  ProtectedRoute()|App() / ProtectedRoute()]]
- [[_COMMUNITY_FileSystemEventHandler  watch_and_index.py|FileSystemEventHandler / watch_and_index.py]]
- [[_COMMUNITY_enrich_definitive.py  clean_source_note()|enrich_definitive.py / clean_source_note()]]
- [[_COMMUNITY_enrich_pass2.py  find_source_code()|enrich_pass2.py / find_source_code()]]
- [[_COMMUNITY_Agenda()  ClienteSearchSelect()|Agenda() / ClienteSearchSelect()]]
- [[_COMMUNITY_enrich_nuclear.py  main()|enrich_nuclear.py / main()]]
- [[_COMMUNITY_main.js  createWindow()|main.js / createWindow()]]
- [[_COMMUNITY_Solicitacoes.jsx  formatDateTime()|Solicitacoes.jsx / formatDateTime()]]
- [[_COMMUNITY_Agendamentos()  Agendamentos.jsx|Agendamentos() / Agendamentos.jsx]]
- [[_COMMUNITY_Customizacao()  Customizacao.jsx|Customizacao() / Customizacao.jsx]]
- [[_COMMUNITY_Produtos.jsx  Produtos()|Produtos.jsx / Produtos()]]
- [[_COMMUNITY_Servicos.jsx  Servicos()|Servicos.jsx / Servicos()]]
- [[_COMMUNITY_Backup()  Backup.jsx|Backup() / Backup.jsx]]
- [[_COMMUNITY_Notificacoes.jsx  Notificacoes()|Notificacoes.jsx / Notificacoes()]]
- [[_COMMUNITY_Register.jsx  Register()|Register.jsx / Register()]]
- [[_COMMUNITY_Profissionais.jsx  Profissionais()|Profissionais.jsx / Profissionais()]]
- [[_COMMUNITY_validate-security.js|validate-security.js]]
- [[_COMMUNITY_preload.js|preload.js]]
- [[_COMMUNITY_postcss.config.js|postcss.config.js]]
- [[_COMMUNITY_tailwind.config.js|tailwind.config.js]]
- [[_COMMUNITY_vite.config.js|vite.config.js]]
- [[_COMMUNITY_main.jsx|main.jsx]]
- [[_COMMUNITY_api.js|api.js]]
- [[_COMMUNITY_syncManager.js|syncManager.js]]
- [[_COMMUNITY_config.py|config.py]]

## God Nodes (most connected - your core abstractions)
1. `SoftHairApiClient` - 45 edges
2. `SoftHairSyncManager` - 25 edges
3. `build_index()` - 21 edges
4. `formatCurrency()` - 13 edges
5. `run_index()` - 11 edges
6. `enrich_source_note()` - 10 edges
7. `run()` - 7 edges
8. `useAuth()` - 6 edges
9. `collect_files_for_repo()` - 6 edges
10. `get_rag()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `cmd_index()` --calls--> `run_index()`  [INFERRED]
  tools/lightrag/lightrag_kg/cli.py → tools/lightrag/lightrag_kg/index.py
- `test_slugify()` --calls--> `slugify()`  [INFERRED]
  tools/lightrag/tests/test_smoke.py → tools/lightrag/lightrag_kg/to_obsidian.py
- `ProtectedRoute()` --calls--> `useAuth()`  [INFERRED]
  frontend/src/App.jsx → frontend/src/context/AuthContext.jsx
- `PublicRoute()` --calls--> `useAuth()`  [INFERRED]
  frontend/src/App.jsx → frontend/src/context/AuthContext.jsx
- `Login()` --calls--> `useAuth()`  [INFERRED]
  frontend/src/pages/Login.jsx → frontend/src/context/AuthContext.jsx

## Communities

### Community 0 - "serverApi.js / SoftHairApiClient"
Cohesion: 0.05
Nodes (1): SoftHairApiClient

### Community 1 - "cmd_find() / cmd_index()"
Cohesion: 0.11
Nodes (20): cmd_find(), cmd_index(), cmd_insert(), cmd_search(), cmd_shell(), cmd_show(), cmd_stats(), cmd_top() (+12 more)

### Community 2 - "enrich_knowledge_graph.py / collect_notes()"
Cohesion: 0.11
Nodes (27): collect_notes(), detect_domains(), detect_entities(), enrich_concept_note(), enrich_domain_note(), enrich_source_note(), extract_file_path(), extract_repo() (+19 more)

### Community 3 - "syncManager.js / SoftHairSyncManager"
Cohesion: 0.15
Nodes (1): SoftHairSyncManager

### Community 4 - "Administrativo() / CheckOutSection()"
Cohesion: 0.1
Nodes (13): CheckOutSection(), ComissoesSection(), CreditosNaCasaSection(), EstornoModal(), FaturamentoSection(), Atendimentos(), Clientes(), Dashboard() (+5 more)

### Community 5 - "cmd_export() / build_index()"
Cohesion: 0.17
Nodes (23): cmd_export(), build_index(), canonical_entity_name(), classify_domains(), classify_entity(), classify_entity_kind(), doc_note_link(), folder_for_doc() (+15 more)

### Community 6 - "collect_files_for_repo() / collect_git_history()"
Cohesion: 0.15
Nodes (18): collect_files_for_repo(), collect_git_history(), _doc_id(), _is_excluded(), _lang_for(), load_manifest(), main(), Returns list of (file_path, rel_path, doc_id, repo_label). (+10 more)

### Community 7 - "App() / ProtectedRoute()"
Cohesion: 0.13
Nodes (7): ProtectedRoute(), PublicRoute(), useAuth(), Configuracoes(), Layout(), Login(), useWebSocket()

### Community 8 - "FileSystemEventHandler / watch_and_index.py"
Cohesion: 0.22
Nodes (5): FileSystemEventHandler, ChangeHandler, DebouncedIndexer, main(), SoftHair Knowledge Graph — File Watcher Detecta mudanças nos 3 repos, acumula po

### Community 9 - "enrich_definitive.py / clean_source_note()"
Cohesion: 0.27
Nodes (8): clean_source_note(), enrich_entity_note(), generate_entity_resumo(), process(), Enriquece uma entity note., Limpa boilerplate restante de source notes., Processa qualquer nota., Gera resumo inteligente para entity notes baseado no nome e conexões.

### Community 10 - "enrich_pass2.py / find_source_code()"
Cohesion: 0.32
Nodes (6): find_source_code(), generate_smart_resumo(), process_note(), Encontra e lê o código fonte., Processa uma nota genérica., Gera resumo inteligente baseado no path e código.

### Community 11 - "Agenda() / ClienteSearchSelect()"
Cohesion: 0.29
Nodes (0): 

### Community 12 - "enrich_nuclear.py / main()"
Cohesion: 0.4
Nodes (4): process_note(), Processa qualquer nota — substituição in-place., Gera resumo para qualquer entidade baseado no nome., smart_entity_resumo()

### Community 13 - "main.js / createWindow()"
Cohesion: 0.6
Nodes (3): createWindow(), getResourcePath(), startBackend()

### Community 14 - "Solicitacoes.jsx / formatDateTime()"
Cohesion: 0.5
Nodes (2): formatDateTime(), PedidoCard()

### Community 15 - "Agendamentos() / Agendamentos.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Customizacao() / Customizacao.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Produtos.jsx / Produtos()"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Servicos.jsx / Servicos()"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Backup() / Backup.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Notificacoes.jsx / Notificacoes()"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Register.jsx / Register()"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Profissionais.jsx / Profissionais()"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "validate-security.js"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "preload.js"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "postcss.config.js"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "tailwind.config.js"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "vite.config.js"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "main.jsx"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "api.js"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "syncManager.js"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "config.py"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **25 isolated node(s):** `Gera resumo inteligente para entity notes baseado no nome e conexões.`, `Enriquece uma entity note.`, `Limpa boilerplate restante de source notes.`, `Processa qualquer nota.`, `Extrai o path do arquivo fonte da nota.` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Agendamentos() / Agendamentos.jsx`** (2 nodes): `Agendamentos()`, `Agendamentos.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Customizacao() / Customizacao.jsx`** (2 nodes): `Customizacao()`, `Customizacao.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Produtos.jsx / Produtos()`** (2 nodes): `Produtos.jsx`, `Produtos()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Servicos.jsx / Servicos()`** (2 nodes): `Servicos.jsx`, `Servicos()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Backup() / Backup.jsx`** (2 nodes): `Backup()`, `Backup.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Notificacoes.jsx / Notificacoes()`** (2 nodes): `Notificacoes.jsx`, `Notificacoes()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Register.jsx / Register()`** (2 nodes): `Register.jsx`, `Register()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profissionais.jsx / Profissionais()`** (2 nodes): `Profissionais.jsx`, `Profissionais()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `validate-security.js`** (1 nodes): `validate-security.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `preload.js`** (1 nodes): `preload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `postcss.config.js`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `tailwind.config.js`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `vite.config.js`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `main.jsx`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `api.js`** (1 nodes): `api.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `syncManager.js`** (1 nodes): `syncManager.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `config.py`** (1 nodes): `config.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run()` connect `cmd_find() / cmd_index()` to `FileSystemEventHandler / watch_and_index.py`, `cmd_export() / build_index()`, `collect_files_for_repo() / collect_git_history()`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `build_index()` (e.g. with `collect_files_for_repo()` and `_wrap()`) actually correct?**
  _`build_index()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `formatCurrency()` (e.g. with `Atendimentos()` and `Vendas()`) actually correct?**
  _`formatCurrency()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `run_index()` (e.g. with `cmd_index()` and `get_rag()`) actually correct?**
  _`run_index()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Gera resumo inteligente para entity notes baseado no nome e conexões.`, `Enriquece uma entity note.`, `Limpa boilerplate restante de source notes.` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `serverApi.js / SoftHairApiClient` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `cmd_find() / cmd_index()` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._