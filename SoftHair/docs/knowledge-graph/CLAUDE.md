# CLAUDE.md — Manual de Consulta da IA

> **Atenção, IA (Claude):** este arquivo é seu briefing obrigatório.
> Leia-o **integralmente** antes de qualquer ação que envolva o sistema SoftHair
> (mobile, desktop ou server) ou a vida do usuário (PARA + Periodic).
> Este vault é o **segundo cérebro** do usuário — a fonte de verdade.

---

## 1. O que é este vault

Vault Obsidian dual-uso:

- **Knowledge Graph do SoftHair** — sistema de gestão para salões de beleza, composto por três codebases: `softhair-server` (API Node.js/Express + PostgreSQL), `softhair-desktop` (admin), `softhair-mobile` (Expo/React Native).
- **LifeOS PARA + Periodic** — projetos, áreas, recursos, arquivo, e revisões periódicas (Daily/Weekly/Monthly/Yearly/3-Year).

**Stats atuais:** 233 docs · 704 entidades · 1091 relações · 15 domínios · 673 conceitos canônicos.

---

## 2. Quando consultar este vault (gatilhos automáticos)

Consulte **sempre, sem precisar ser pedido**, quando a mensagem do usuário tocar em qualquer um destes termos:

- Nomes do sistema: SoftHair, agendamento(s), atendimento(s), cliente(s), profissional/profissionais, salão/salões, produto(s), comissão/comissões, venda(s), serviço(s), fechamento, crédito, ponto, perfil.
- Componentes técnicos: rota, route, endpoint, service, model, middleware, schema, store, screen, component, hook.
- Stack: Express, Node, PostgreSQL, Expo, React Native, expo-router, JWT, HMAC, CORS, pool, query, basemodel.
- Conceitos LifeOS: projeto, área, recurso, daily, weekly, monthly, yearly, periodic, PARA.
- Pedidos genéricos como "do sistema", "do SoftHair", "do app", "da api", "do backend", "do mobile", "do desktop".

Se a mensagem **não** tocar nenhum desses, prossiga normalmente sem consulta.

---

## 3. Ordem de leitura (do mais barato pro mais caro)

Sempre nesta ordem — economiza contexto:

1. **`HOME.md`** — mapa geral do vault.
2. **`AI-CONTEXT.md`** — ponto de entrada operacional (domínios + entradas-fonte).
3. **`INDEX.md`** — índice do Knowledge Graph (mobile/desktop/server/entidades).
4. **Domínio relevante** em `domains/<nome>.md` (ex: `domains/agendamentos.md`).
5. **Conceitos canônicos** em `concepts/<slug>.md` (ex: `concepts/agendamento.md`, `concepts/agendamentoservice.md`).
6. **Arquivo-fonte mapeado** em `mobile/`, `desktop/`, `server/` (só se precisar do código real).

> Regra de ouro: nunca abra arquivos-fonte sem ter passado por domínio + conceito antes.

---

## 4. Estrutura do vault

```
knowledge-graph/
├── CLAUDE.md                    ← ESTE ARQUIVO (manual da IA)
├── HOME.md                      ← Dashboard humano
├── AI-CONTEXT.md                ← Mapa operacional (entrada da IA)
├── INDEX.md                     ← Índice do Knowledge Graph (gerado por LightRAG)
│
├── 01-Projects/                 ← PARA: Projetos com prazo
├── 02-Areas/                    ← PARA: Áreas contínuas (SoftHair está aqui)
├── 03-Resources/                ← PARA: Referências
├── 04-Archive/                  ← PARA: Inativos
│
├── Periodic/
│   ├── Daily/   Weekly/   Monthly/   Yearly/   3-Year/
│
├── Templates/                   ← Templates de notas
│
├── domains/                     ← 15 domínios operacionais (alto-nível)
├── concepts/                    ← 673 conceitos canônicos (médio-nível)
│
├── mobile/                      ← Mapa do código softhair-mobile
│   ├── app/  components/  hooks/  store/  services/  root/  entities/
│
├── desktop/                     ← Mapa do código softhair-desktop
│   ├── backend/  frontend/  config/  root/  entities/
│
└── server/                      ← Mapa do código softhair-server
    ├── routes/  models/  services/  config/  root/  entities/
```

---

## 5. Convenções

- **Wikilinks:** `[[concepts/agendamento|Agendamento]]` — siga sempre que aparecer.
- **Slugs:** lowercase, sem acentos, separador `-`. Ex: `agendamento-service` → `agendamentoservice.md`.
- **Frontmatter:** quando criar nota nova, use frontmatter YAML mínimo:
  ```yaml
  ---
  type: concept | domain | project | area | resource | daily | weekly
  created: YYYY-MM-DD
  tags: [softhair, mobile|desktop|server]
  ---
  ```
- **Plugins Obsidian em uso** (não interpretáveis pela IA — leia como markdown puro):
  Tasks, Dataview-like queries, Calendar, Templater. Se ver bloco ` ```dataview `, ignore como código e foque no markdown ao redor.
- **Não edite `INDEX.md`** — é regenerado automaticamente pelo LightRAG.

---

## 6. Como agir em cada tipo de pedido

| Pedido do usuário | O que a IA faz |
|---|---|
| "Ajusta X no sistema" | Lê `domains/X` → `concepts/X*` → arquivo-fonte mapeado → propõe mudança citando as notas. |
| "Como funciona Y?" | Resume a partir de `concepts/Y` + relações citadas. Não abre fonte se a nota basta. |
| "Adiciona uma nota sobre Z" | Cria em `concepts/` ou `03-Resources/` seguindo Templates. Atualiza index relevante. |
| "Daily de hoje" / "Weekly" | Usa `Templates/Daily.md` / `Templates/Weekly.md`. Salva em `Periodic/Daily/YYYY-MM-DD.md`. |
| "Novo projeto" | Usa `Templates/Project.md`, salva em `01-Projects/`, linka em `01-Projects/INDEX.md`. |
| "Pesquisa solta sem trigger SoftHair" | Não consulta vault. Responde direto. |

---

## 7. O que NUNCA fazer

- Nunca inventar nome de entidade/conceito sem checar `concepts/index.md` primeiro.
- Nunca editar `INDEX.md` (auto-gerado).
- Nunca apagar nota sem pedir confirmação.
- Nunca quebrar wikilinks existentes ao renomear (procurar referências antes).
- Nunca alterar arquivos `.obsidian/` (config do app, não conteúdo).

---

## 8. Para uso em Claude Code (terminal)

Se você está rodando como Claude Code dentro do projeto de código (não dentro do vault):

1. Verifique se existe um `CLAUDE.md` na raiz do projeto que aponte para este vault.
2. Caminho absoluto do vault: `C:\Users\guise\Documents\MONEY\SoftHair\docs\knowledge-graph`.
3. Antes de mexer em código, abra a nota de domínio correspondente neste vault.

---

*Última revisão: 2026-04-27 · Mantido por Claude + oGejota.*
