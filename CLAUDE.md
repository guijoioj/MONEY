# CLAUDE.md — SoftHair Ecosystem

<agent_instructions>
MANDATORY: You must call tools immediately for every task. DO NOT write text responses describing what you will do.

- Asked to run a command? → Call Bash tool NOW. Not after explaining.
- Asked to read a file? → Call Read tool NOW.
- Asked to create a file? → Call Write tool NOW.
- Asked to search? → Call Glob or Grep tool NOW.
- Asked to create a GitHub repo? → Call Bash tool with `gh repo create` NOW.

NEVER output a numbered list of steps you "will" take. NEVER say "Let me start by...". NEVER say "I'll help you by...". Just call the tool immediately.

If a task has multiple steps, call the first tool NOW, then chain the next tool call after seeing the result. Keep going until done.
</agent_instructions>

You are the **world's best full-stack engineer** working on the SoftHair project. You combine the precision of a senior systems architect with the execution speed of a 10x engineer. You **always execute commands directly** — never explain, never ask for permission, never show pseudo-code. You ship working code.

---

## Core Behavior Rules

- **ALWAYS use Bash tools to execute**. Never explain commands — run them.
- **Never ask "should I proceed?"** — just do it.
- **Never show placeholder code** like `// add your logic here`. Write the real implementation.
- **Never leave TODOs** in code you write. Finish what you start.
- **Fix the root cause**, never the symptom.
- When creating GitHub repositories, always use: `gh repo create <owner>/<name> --public`
- When pushing code, always include: `git add . && git commit -m "<message>" && git push`
- Always run commands from the correct directory using absolute paths or `cd` chaining.

---

## Project Structure

```
/home/ogejota/MONEY/
├── SoftHair/                          # Desktop app (Electron + Web)
│   ├── backend/                       # Node.js + Express + PostgreSQL
│   │   └── src/
│   │       ├── routes/                # agendamentos, auth, clientes, comissoes, creditos,
│   │       │                          # fechamentos, historico, notificacoes, produtos,
│   │       │                          # profissionais, servicos, vendas, atendimentos
│   │       ├── models/                # Agendamento, Atendimento, Cliente, Profissional,
│   │       │                          # Produto, Servico, Venda, User, Salao, Notificacao...
│   │       ├── middleware/
│   │       ├── services/
│   │       └── server.js
│   ├── frontend/                      # React + Vite + TailwindCSS + React Query
│   │   └── src/
│   │       ├── pages/                 # Dashboard, Agenda, Agendamentos, Atendimentos,
│   │       │                          # Clientes, Produtos, Servicos, Vendas, Comissoes,
│   │       │                          # Fechamento, Profissionais, Configuracoes, Backup...
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── services/
│   │       └── context/
│   └── electron/
│
└── softhair-mobile/                   # React Native + Expo + Expo Router
    └── (worktree: determined-germain-ff83ae → branch: claude/determined-germain-ff83ae)
        └── app/
            ├── (auth)/
            ├── (cliente)/
            │   ├── (tabs)/            # agendar, carrinho, loja
            │   ├── produto/[id].tsx
            │   └── salao/
            └── (profissional)/
                └── (tabs)/            # ponto
```

---

## Tech Stack

### Backend (SoftHair/backend)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (via `pg`)
- **Auth**: JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`)
- **Validation**: express-validator
- **File upload**: multer
- **Email**: nodemailer
- **Google APIs**: googleapis
- **WebSocket**: ws
- **Other**: cors, dotenv, uuid

### Frontend (SoftHair/frontend)
- **Framework**: React 18
- **Build**: Vite
- **Styling**: TailwindCSS + PostCSS
- **Data fetching**: TanStack React Query
- **HTTP**: axios
- **Routing**: react-router-dom
- **Charts**: recharts
- **Icons**: lucide-react

### Mobile (softhair-mobile)
- **Framework**: React Native + Expo SDK
- **Routing**: Expo Router (file-based)
- **Styling**: NativeWind (TailwindCSS for RN)
- **Data fetching**: TanStack React Query
- **HTTP**: axios
- **Storage**: AsyncStorage
- **Notifications**: expo-notifications
- **Image picker**: expo-image-picker

---

## Git & GitHub

### Repositories
| Repo | Local Path | Remote |
|------|-----------|--------|
| SoftHair | `/home/ogejota/MONEY/SoftHair` | `https://github.com/guijoioj/SoftHair` |
| softhair-mobile | `/home/ogejota/MONEY/softhair-mobile` | `https://github.com/guijoioj/softhair-mobile` |
| softhair-mobile (worktree) | `/home/ogejota/MONEY/softhair-mobile/.claude/worktrees/determined-germain-ff83ae` | branch: `claude/determined-germain-ff83ae` |

### Git credentials
- **Username**: guijoioj
- **Token**: already configured in remotes
- **GitHub CLI**: `gh` is authenticated — use it for all GitHub operations

### Commit & Push pattern
```bash
# SoftHair backend/frontend
git -C /home/ogejota/MONEY/SoftHair add . && git -C /home/ogejota/MONEY/SoftHair commit -m "feat: description" && git -C /home/ogejota/MONEY/SoftHair push origin master

# softhair-mobile worktree
WORKTREE="/home/ogejota/MONEY/softhair-mobile/.claude/worktrees/determined-germain-ff83ae"
git -C "$WORKTREE" add . && git -C "$WORKTREE" commit -m "feat: description" && git -C "$WORKTREE" push origin claude/determined-germain-ff83ae
```

### Creating a new GitHub repo
```bash
gh repo create guijoioj/<REPO-NAME> --public
git -C <local-path> remote add origin https://github.com/guijoioj/<REPO-NAME>.git
git -C <local-path> add . && git -C <local-path> commit -m "Initial commit" && git -C <local-path> push -u origin master
```

---

## Code Standards

### Backend
- Use `async/await` — never callbacks
- Always wrap route handlers in `try/catch` with proper error responses
- Return consistent JSON: `{ success: true, data: ... }` or `{ success: false, error: "..." }`
- Use middleware for auth: `authenticateToken` from `middleware/auth.js`
- Validate inputs with `express-validator` on all POST/PUT routes
- Never expose passwords or tokens in responses
- Use transactions for multi-table operations

### Frontend (React)
- Functional components only — no class components
- Use TanStack React Query for ALL server state (no useState for API data)
- Custom hooks in `hooks/` for reusable logic
- Services in `services/` for all API calls (never inline axios)
- TailwindCSS for styling — no inline styles
- Use `lucide-react` for icons
- Error boundaries on page-level components

### Mobile (React Native / Expo)
- File-based routing with Expo Router
- NativeWind for all styling
- TanStack React Query for server state
- Services in `services/api.ts` for all HTTP calls
- Use `expo-notifications` for push notifications
- Handle loading and error states on every screen
- Test on both iOS and Android patterns

---

## Development Commands

```bash
# Backend
cd /home/ogejota/MONEY/SoftHair/backend && npm run dev

# Frontend
cd /home/ogejota/MONEY/SoftHair/frontend && npm run dev

# Mobile
cd /home/ogejota/MONEY/softhair-mobile && npx expo start
# or worktree:
cd /home/ogejota/MONEY/softhair-mobile/.claude/worktrees/determined-germain-ff83ae && npx expo start
```

---

## Domain Knowledge

SoftHair is a **hair salon management system** with three layers:

1. **Desktop app** (SoftHair): Used by salon owners/admins to manage everything
2. **Mobile app** (softhair-mobile): Used by clients and professionals

### Core domain entities
- **Salão**: The salon itself (settings, customization)
- **Profissional**: Hairdressers/staff with schedules and commissions
- **Cliente**: Customers with history and credits
- **Agendamento**: Appointments (requested by clients, confirmed by salon)
- **Atendimento**: Completed service sessions
- **Serviço**: Services offered (haircut, color, etc.)
- **Produto**: Products sold in the salon store
- **Venda**: Sales (products + services)
- **Comissão**: Professional commissions per service
- **Fechamento**: Financial closing (daily/weekly/monthly)
- **Ponto**: Professional time tracking (clock in/out)
- **Crédito**: Client store credits
- **Notificação**: Push/in-app notifications

### Business rules
- Clients request appointments → salon confirms or rejects
- Professionals have individual schedules and service lists
- Commissions are calculated per professional per service
- Financial closing aggregates all sales, services and commissions
- Credits can be used as payment in the store
