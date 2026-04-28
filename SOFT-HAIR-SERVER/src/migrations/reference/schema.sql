CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  "resetToken" TEXT,
  "resetTokenExpiry" BIGINT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT NOT NULL,
  cpf TEXT,
  "dataNascimento" TEXT,
  endereco TEXT,
  observacoes TEXT,
  "ultimaVisita" TEXT,
  preferencias TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profissionais (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  especialidade TEXT,
  comissao REAL DEFAULT 0,
  ativo INTEGER DEFAULT 1,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS servicos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  duracao INTEGER NOT NULL,
  preco REAL NOT NULL,
  categoria TEXT,
  ativo INTEGER DEFAULT 1,
  "baseComissao" REAL DEFAULT 0,
  "comissaoPorcentagem" REAL DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  marca TEXT,
  categoria TEXT,
  "precoCusto" REAL,
  "precoVenda" REAL NOT NULL,
  estoque INTEGER DEFAULT 0,
  "estoqueMinimo" INTEGER DEFAULT 0,
  ativo INTEGER DEFAULT 1,
  unidade TEXT DEFAULT 'un',
  "baseComissao" REAL DEFAULT 0,
  "comissaoPorcentagem" REAL DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id TEXT PRIMARY KEY,
  "clienteId" TEXT,
  "servicoId" TEXT,
  "profissionalId" TEXT,
  "auxiliarId" TEXT,
  "dataHora" TEXT NOT NULL,
  duracao INTEGER,
  status TEXT DEFAULT 'agendado',
  observacoes TEXT,
  "atendimentoId" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atendimentos (
  id TEXT PRIMARY KEY,
  "clienteId" TEXT,
  "profissionalId" TEXT,
  "auxiliarId" TEXT,
  data TEXT NOT NULL,
  "horaInicio" TEXT,
  "horaFim" TEXT,
  desconto REAL DEFAULT 0,
  observacoes TEXT,
  "totalProdutos" REAL DEFAULT 0,
  "totalServicos" REAL DEFAULT 0,
  "totalGeral" REAL DEFAULT 0,
  status TEXT DEFAULT 'aberto',
  "formaPagamento" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atendimentos_produtos (
  id TEXT PRIMARY KEY,
  "atendimentoId" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "quantidadeUsada" REAL NOT NULL,
  unidade TEXT DEFAULT 'unidade',
  "precoUnitario" REAL NOT NULL,
  subtotal REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS atendimentos_servicos (
  id TEXT PRIMARY KEY,
  "atendimentoId" TEXT NOT NULL,
  "servicoId" TEXT NOT NULL,
  "horaInicio" TEXT,
  "horaFim" TEXT,
  preco REAL NOT NULL,
  duracao INTEGER
);

CREATE TABLE IF NOT EXISTS vendas (
  id TEXT PRIMARY KEY,
  "clienteId" TEXT,
  "profissionalId" TEXT,
  "vendedorId" TEXT,
  "salonId" TEXT,
  data TEXT NOT NULL,
  total REAL NOT NULL,
  "formaPagamento" TEXT,
  status TEXT DEFAULT 'aberto',
  observacoes TEXT,
  "atendimentoId" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS "salonId" TEXT;

CREATE TABLE IF NOT EXISTS vendas_itens (
  id TEXT PRIMARY KEY,
  "vendaId" TEXT NOT NULL,
  tipo TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  "precoUnitario" REAL NOT NULL,
  subtotal REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS fechamentos (
  id TEXT PRIMARY KEY,
  "clienteId" TEXT,
  "profissionalId" TEXT,
  data TEXT NOT NULL,
  "totalAtendimentos" REAL DEFAULT 0,
  "totalVendas" REAL DEFAULT 0,
  "totalProdutos" REAL DEFAULT 0,
  "descontoGeral" REAL DEFAULT 0,
  "totalGeral" REAL DEFAULT 0,
  "formaPagamento" TEXT,
  observacoes TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fechamentos_atendimentos (
  id TEXT PRIMARY KEY,
  "fechamentoId" TEXT NOT NULL,
  "atendimentoId" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fechamentos_vendas (
  id TEXT PRIMARY KEY,
  "fechamentoId" TEXT NOT NULL,
  "vendaId" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS estornos (
  id TEXT PRIMARY KEY,
  "fechamentoId" TEXT,
  motivo TEXT NOT NULL,
  valor REAL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_metadata (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  size INTEGER,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "syncedToCloud" INTEGER DEFAULT 0,
  "cloudId" TEXT
);

CREATE TABLE IF NOT EXISTS configuracoes (
  id TEXT PRIMARY KEY,
  chave TEXT UNIQUE NOT NULL,
  valor TEXT,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  "clienteId" TEXT,
  lida INTEGER DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cliente_historico (
  id TEXT PRIMARY KEY,
  "clienteId" TEXT NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  "entidadeId" TEXT,
  data TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creditos_cliente (
  id TEXT PRIMARY KEY,
  "clienteId" TEXT NOT NULL,
  tipo TEXT NOT NULL,
  valor REAL NOT NULL,
  descricao TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cliente_favoritos (
  id TEXT PRIMARY KEY,
  "clienteId" TEXT NOT NULL,
  tipo TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  quantidade INTEGER DEFAULT 1,
  "totalGasto" REAL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comissoes_pagas (
  id TEXT PRIMARY KEY,
  "profissionalId" TEXT NOT NULL,
  "fechamentoId" TEXT,
  valor REAL NOT NULL,
  "dataPagamento" TEXT NOT NULL,
  observacoes TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comissoes_estornos (
  id TEXT PRIMARY KEY,
  "comissaoPagaId" TEXT,
  "profissionalId" TEXT NOT NULL,
  valor REAL NOT NULL,
  motivo TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Tabelas do app mobile
CREATE TABLE IF NOT EXISTS saloes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  foto TEXT,
  plano TEXT DEFAULT 'basico',
  ativo INTEGER DEFAULT 1,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes_app (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  telefone TEXT,
  foto TEXT,
  "pushToken" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedidos_agendamento (
  id TEXT PRIMARY KEY,
  "salonId" TEXT NOT NULL,
  "clienteAppId" TEXT NOT NULL,
  "servicoId" TEXT NOT NULL,
  "profissionalId" TEXT,
  "dataDesejada" TEXT NOT NULL,
  "horarioDesejado" TEXT NOT NULL,
  "horarioAlternativo" TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'pendente',
  "agendamentoId" TEXT,
  "atendidoPor" TEXT,
  "motivoRejeicao" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedidos_loja (
  id TEXT PRIMARY KEY,
  "salonId" TEXT NOT NULL,
  "clienteAppId" TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  total REAL NOT NULL,
  "enderecoEntrega" TEXT,
  "formaPagamento" TEXT,
  observacoes TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedidos_loja_itens (
  id TEXT PRIMARY KEY,
  "pedidoId" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  "precoUnitario" REAL NOT NULL,
  subtotal REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ponto_registros (
  id TEXT PRIMARY KEY,
  "salonId" TEXT NOT NULL,
  "profissionalId" TEXT NOT NULL,
  tipo TEXT NOT NULL,
  "atendimentoId" TEXT,
  observacoes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
