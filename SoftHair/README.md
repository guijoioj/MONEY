# Sistema de Administração de Salão de Beleza

Sistema completo para gerenciamento de salão de beleza com interface web executável em desktop.

## Inicialização Rápida (1 clique!)

### Linux
1. Dê permissão de execução:
   ```bash
    chmod +x "Iniciar Sistema.sh"
   ```
2. Clique duas vezes no arquivo **"Iniciar Sistema.sh"** (ou execute `./iniciar-sistema.sh`)

### Windows
1. Clique duas vezes no arquivo **"Iniciar Sistema.bat"**
2. O sistema abrirá automaticamente no navegador

### macOS
1. Clique duas vezes em **"Iniciar Sistema.sh"** (se não funcionar, use Terminal)

> No Linux também existe `iniciar-sistema.sh` (sem espaço) e `iniciar-servidores.sh` como atalhos alternativos.

## Opções de Inicialização

| Arquivo | Plataforma | Descrição |
|---------|------------|-----------|
| `Iniciar Sistema.sh` | Linux/Mac | Script shell - inicia backend + frontend |
| `Iniciar Sistema.bat` | Windows | Script batch - inicia backend + frontend |
| `Salão de Beleza.desktop` | Linux | Lançador para menu de aplicativos |
| `npm start` | Todas | Executar via Electron (requer `npm install electron`) |

## Funcionalidades

### Gestão Completa
- **Clientes**: Cadastro, busca e histórico de clientes
- **Serviços**: Cadastro de serviços com preço e duração
- **Produtos**: Controle de estoque com alertas
- **Agendamentos**: Sistema de agendamento por data
- **Vendas**: Registro de vendas de produtos e serviços

### Customização Total
- **Cores**: Seletor visual com 11 cores customizáveis
- **Logo**: Upload de logo personalizado
- **CSS**: Editor de CSS personalizado
- **Temas**: Predefinições prontas (Rosa, Azul, Roxo, Verde)
- **Preview**: Visualização em tempo real

### Segurança e Backup
- **Autenticação**: Login seguro com JWT
- **Backup Local**: Exportação como JSON
- **Google Drive**: Sincronização na nuvem
- **Restauração**: Importar em qualquer máquina

## Instalação Manual (se os scripts não funcionarem)

```bash
# Backend
cd backend
npm install
cp .env.example .env # se desejar personalizar segredos e credenciais
npm run create-admin
npm run dev

# Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

**Acesse:** http://localhost:3000

**Login padrão (ambiente de primeiro acesso):**
- Email: `admin@salao.com`
- Senha: `admin123`

> Esses valores são usados apenas se você não alterar `SOFTHAIR_DEFAULT_ADMIN_*` e se não existir nenhum usuário no banco.

### Variáveis úteis
- `JWT_SECRET` (obrigatório em produção)
- `JWT_EXPIRES_IN`
- `SOFTHAIR_ROOT_DIR` (força o diretório de dados)
- `SOFTHAIR_DEFAULT_ADMIN_EMAIL`
- `SOFTHAIR_DEFAULT_ADMIN_PASSWORD`

## Estrutura

```
salao-beleza/
├── Iniciar Sistema.sh      # Iniciar no Linux/Mac
├── Iniciar Sistema.bat     # Iniciar no Windows
├── Salão de Beleza.desktop # Lançador Linux
├── backend/                 # API Node.js
├── frontend/               # Interface React
├── electron/               # Wrapper Desktop
└── README.md
```

## Requisitos

- **Node.js**: 20+ (recomendado: v20.x, v22.x ou v25.x)
- **SO**: Windows 10+, Linux, macOS 10.15+
- **RAM**: 4GB+
- **Disco**: 500MB+
