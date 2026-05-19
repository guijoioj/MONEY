const { spawn } = require('child_process');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const DEFAULT_DATABASE_URL = 'process.env.DATABASE_URL_TEST_FALLBACK or use env';

const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const port = process.env.JEST_SMOKE_PORT || String(4500 + (process.pid % 1000));
const baseUrl = `http://127.0.0.1:${port}/api`;
const runId = `jest-smoke-${Date.now()}-${process.pid}`;
const emailDomain = 'example.test';

let serverProcess;
let token;
let salaoId;
let clienteId;
let profissionalId;
let servicoId;
let produtoId;
let appToken;
let profissionalToken;

function serverEnv() {
  return {
    ...process.env,
    PORT: port,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    DATABASE_SSL: process.env.DATABASE_SSL || 'true',
    JWT_SECRET: process.env.JWT_SECRET || 'jest-smoke-secret-with-at-least-32-chars',
    ALLOWED_ORIGINS: '*',
    WS_ENABLED: 'false'
  };
}

async function waitForHealth(timeoutMs = 30000) {
  const started = Date.now();
  let lastError;

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
      lastError = new Error(`Health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw lastError || new Error('Server did not become healthy');
}

async function request(name, method, path, body, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (options.auth !== false && token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  const expected = options.expect || [];
  const ok = expected.length
    ? expected.includes(response.status)
    : response.status >= 200 && response.status < 300;

  if (!ok) {
    throw new Error(`${name} failed with ${response.status}: ${text}`);
  }

  return data;
}

async function cleanupSmokeData() {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    await pool.query('BEGIN');

    const saloes = await pool.query('SELECT id FROM saloes WHERE nome LIKE $1 OR email LIKE $1', [`${runId}%`]);
    const salaoIds = saloes.rows.map(row => row.id);
    const clientes = await pool.query('SELECT id FROM clientes WHERE email LIKE $1 OR nome LIKE $2', [`%${runId}%`, `${runId}%`]);
    const clienteIds = clientes.rows.map(row => row.id);
    const profissionais = await pool.query('SELECT id FROM profissionais WHERE email LIKE $1 OR nome LIKE $2', [`%${runId}%`, `${runId}%`]);
    const profissionalIds = profissionais.rows.map(row => row.id);
    const servicos = await pool.query('SELECT id FROM servicos WHERE nome LIKE $1', [`${runId}%`]);
    const servicoIds = servicos.rows.map(row => row.id);
    const produtos = await pool.query('SELECT id FROM produtos WHERE nome LIKE $1', [`${runId}%`]);
    const produtoIds = produtos.rows.map(row => row.id);

    if (salaoIds.length) {
      await pool.query('DELETE FROM sync_log WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM notificacoes WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM configuracoes WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM pedido_loja_itens WHERE pedido_id IN (SELECT id FROM pedidos_loja WHERE salao_id = ANY($1::int[]))', [salaoIds]);
      await pool.query('DELETE FROM pedidos_loja WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM pedidos_agendamento WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM registros_ponto WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM produtos_utilizados WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM comissoes_pagamentos WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM comissoes WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM creditos_cliente WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM venda_itens WHERE venda_id IN (SELECT id FROM vendas WHERE salao_id = ANY($1::int[]))', [salaoIds]);
      await pool.query('DELETE FROM vendas WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM atendimentos WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM agendamentos WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM api_keys WHERE salao_id = ANY($1::int[])', [salaoIds]);
      await pool.query('DELETE FROM devices WHERE salao_id = ANY($1::int[])', [salaoIds]);
    }

    if (produtoIds.length) await pool.query('DELETE FROM produtos WHERE id = ANY($1::int[])', [produtoIds]);
    if (servicoIds.length) await pool.query('DELETE FROM servicos WHERE id = ANY($1::int[])', [servicoIds]);
    if (profissionalIds.length) await pool.query('DELETE FROM profissionais WHERE id = ANY($1::int[])', [profissionalIds]);
    if (clienteIds.length) {
      await pool.query('DELETE FROM creditos_cliente WHERE cliente_id = ANY($1::int[])', [clienteIds]);
      await pool.query('DELETE FROM clientes WHERE id = ANY($1::int[])', [clienteIds]);
    }
    if (salaoIds.length) {
      await pool.query('DELETE FROM usuarios WHERE salao_id = ANY($1::int[]) OR email LIKE $2', [salaoIds, `%${runId}%`]);
      await pool.query('DELETE FROM saloes WHERE id = ANY($1::int[])', [salaoIds]);
    } else {
      await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${runId}%`]);
    }
    await pool.query('DELETE FROM clientes_app WHERE email LIKE $1 OR nome LIKE $2', [`%${runId}%`, `${runId}%`]);

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

async function enableProfissionalAppLogin(id, password) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    const senhaHash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE profissionais SET senha_hash = $1, app_ativo = true WHERE id = $2',
      [senhaHash, id]
    );
  } finally {
    await pool.end();
  }
}

beforeAll(async () => {
  await cleanupSmokeData();

  serverProcess = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: serverEnv(),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess.stdout.on('data', data => {
    if (process.env.JEST_SMOKE_LOGS === 'true') process.stdout.write(data);
  });
  serverProcess.stderr.on('data', data => {
    if (process.env.JEST_SMOKE_LOGS === 'true') process.stderr.write(data);
  });

  await waitForHealth();
}, 45000);

afterAll(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 5000);
      serverProcess.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  await cleanupSmokeData();
}, 30000);

describe('SoftHair API smoke integration', () => {
  test('core desktop and app flows work against the current database without touching existing data', async () => {
    const admin = {
      nome: `${runId} Salao`,
      email: `${runId}-salao@${emailDomain}`,
      adminNome: `${runId} Admin`,
      adminEmail: `${runId}-admin@${emailDomain}`,
      adminSenha: 'Smoke123!@#'
    };
    const appUser = {
      nome: `${runId} Cliente App`,
      email: `${runId}-app@${emailDomain}`,
      password: 'Smoke123!@#',
      telefone: '(11) 99999-9999'
    };

    await request('health', 'GET', '/health', undefined, { auth: false });

    const registration = await request('admin register', 'POST', '/auth/register', admin, { auth: false, expect: [201] });
    token = registration.data.token;
    salaoId = registration.data.salao.id;

    await request('auth me', 'GET', '/auth/me');
    await request('salao me', 'GET', '/saloes/me');
    await request('config get', 'GET', '/configuracoes');
    await request('config put', 'PUT', '/configuracoes', { chave: `${runId}_config`, valor: 'ok' });

    const cliente = await request('cliente create', 'POST', '/clientes', {
      nome: `${runId} Cliente`,
      telefone: '(11) 99999-9999',
      email: `${runId}-cliente@${emailDomain}`
    }, { expect: [201] });
    clienteId = cliente.data.id;
    await request('clientes list', 'GET', '/clientes');
    await request('cliente get', 'GET', `/clientes/${clienteId}`);
    await request('cliente update', 'PUT', `/clientes/${clienteId}`, { observacoes: `${runId} update` });
    await request('historico resumo', 'GET', `/historico/cliente/${clienteId}/resumo`);
    await request('credito create', 'POST', '/creditos', { cliente_id: clienteId, tipo: 'credito', valor: 1, observacoes: runId }, { expect: [201] });
    await request('credito list cliente', 'GET', `/creditos/cliente/${clienteId}`);

    const profissional = await request('profissional create', 'POST', '/profissionais', {
      nome: `${runId} Profissional`,
      email: `${runId}-profissional@${emailDomain}`,
      comissao_percentual: 10
    }, { expect: [201] });
    profissionalId = profissional.data.id;
    await request('profissionais list', 'GET', '/profissionais');
    await request('profissional get', 'GET', `/profissionais/${profissionalId}`);

    const servico = await request('servico create', 'POST', '/servicos', {
      nome: `${runId} Servico`,
      preco: 10,
      duracao_minutos: 30
    }, { expect: [201] });
    servicoId = servico.data.id;
    await request('servicos list', 'GET', '/servicos');
    await request('servico get', 'GET', `/servicos/${servicoId}`);

    const produto = await request('produto create', 'POST', '/produtos', {
      nome: `${runId} Produto`,
      preco_venda: 20,
      preco_custo: 10,
      quantidade_estoque: 5,
      quantidade_minima: 1
    }, { expect: [201] });
    produtoId = produto.data.id;
    await request('produtos list', 'GET', '/produtos');
    await request('produto get', 'GET', `/produtos/${produtoId}`);
    await request('estoque baixo', 'GET', '/produtos/estoque-baixo');
    await request('sync changes produtos', 'GET', `/sync/changes?since=1970-01-01T00:00:00.000Z&tables=produtos`);

    const venda = await request('venda create', 'POST', '/vendas', {
      cliente_id: clienteId,
      profissional_id: profissionalId,
      tipo: 'produto',
      status: 'finalizada',
      valor_total: 20,
      valor_final: 20,
      itens: [{ produto_id: produtoId, quantidade: 1, preco_unitario: 20 }]
    }, { expect: [201] });
    const vendaId = venda.data.id;
    await request('vendas list', 'GET', '/vendas');
    await request('venda get', 'GET', `/vendas/${vendaId}`);

    const agendamento = await request('agendamento create', 'POST', '/agendamentos', {
      cliente_id: clienteId,
      profissional_id: profissionalId,
      servico_id: servicoId,
      data_hora: '2099-01-15T10:00:00.000Z',
      duracao_minutos: 30,
      status: 'agendado',
      valor: 10
    }, { expect: [201] });
    const agendamentoId = agendamento.data.id;
    await request('agendamentos list', 'GET', '/agendamentos');
    await request('agendamento get', 'GET', `/agendamentos/${agendamentoId}`);
    await request('agendamento update', 'PUT', `/agendamentos/${agendamentoId}`, { status: 'confirmado' });
    await request('agendamento disponiveis', 'GET', `/agendamentos/disponiveis/${profissionalId}?data=2099-01-15`);

    const atendimento = await request('atendimento create', 'POST', '/atendimentos', {
      cliente_id: clienteId,
      profissional_id: profissionalId,
      servico_id: servicoId,
      agendamento_id: agendamentoId,
      valor: 10,
      status: 'em_andamento',
      observacoes: runId
    }, { expect: [201] });
    const atendimentoId = atendimento.data.id;
    await request('atendimentos list', 'GET', '/atendimentos');
    await request('atendimento get', 'GET', `/atendimentos/${atendimentoId}`);
    await request('atendimento update', 'PUT', `/atendimentos/${atendimentoId}`, { status: 'finalizado' });

    const comissao = await request('comissao create', 'POST', '/comissoes', {
      profissional_id: profissionalId,
      venda_id: vendaId,
      valor_total: 20,
      percentual: 10,
      valor_comissao: 2
    }, { expect: [201] });
    const comissaoId = comissao.data.id;
    await request('comissoes list', 'GET', '/comissoes');
    await request('comissao get', 'GET', `/comissoes/${comissaoId}`);
    await request('comissao resumo', 'GET', `/comissoes/resumo/${profissionalId}?data_inicio=2099-01-01&data_fim=2099-01-31`);
    await request('comissao pagar', 'PUT', `/comissoes/${comissaoId}/pagar`);

    const notificacao = await request('notificacao create', 'POST', '/notificacoes', {
      tipo: 'teste',
      titulo: `${runId} Notificacao`,
      mensagem: 'Teste de integração Jest',
      destinatario_tipo: 'admin'
    }, { expect: [201] });
    const notificacaoId = notificacao.data.id;
    await request('notificacoes list', 'GET', '/notificacoes');
    await request('notificacoes count', 'GET', '/notificacoes/count');
    await request('notificacao lida', 'PUT', `/notificacoes/${notificacaoId}/lida`);
    await request('notificacoes marcar todas', 'PUT', '/notificacoes/marcar-todas-lidas');
    await request('notificacao delete', 'DELETE', `/notificacoes/${notificacaoId}`);

    // [P9-M2] data_fim deve ser <= hoje. Usar período passado realista (30 dias atrás → ontem).
    const _hoje = new Date();
    const _ontem = new Date(_hoje.getTime() - 24 * 60 * 60 * 1000);
    const _trintaDias = new Date(_hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
    const _fmt = (d) => d.toISOString().slice(0, 10);
    const fechamento = await request('fechamento create', 'POST', '/fechamentos', {
      data_inicio: _fmt(_trintaDias),
      data_fim: _fmt(_ontem),
      tipo: 'mensal'
    }, { expect: [201] });
    const fechamentoId = fechamento.data.id;
    await request('fechamentos list', 'GET', '/fechamentos');
    await request('fechamento get', 'GET', `/fechamentos/${fechamentoId}`);
    await request('fechamento reabrir', 'PUT', `/fechamentos/${fechamentoId}/reabrir`, { motivo: 'Teste de reabertura via smoke test' });

    await request('backup get', 'GET', '/backup');
    await request('auth device unauth blocked', 'POST', '/auth/device/register', {
      salaoId,
      tipo: 'desktop',
      nome: `${runId} Device`,
      fingerprint: `${runId}-fingerprint`
    }, { auth: false, expect: [401] });
    await request('auth device register', 'POST', '/auth/device/register', {
      salaoId,
      tipo: 'desktop',
      nome: `${runId} Device`,
      fingerprint: `${runId}-fingerprint`
    });
    await request('auth device validate', 'POST', '/auth/device/validate', {
      fingerprint: `${runId}-fingerprint`
    }, { auth: false });
    await request('auth api key create', 'POST', '/auth/apikey', {
      nome: `${runId} API Key`,
      permissoes: ['read']
    }, { expect: [201] });
    await request('sync last', 'GET', '/sync/last-sync');

    const appRegistration = await request('app register', 'POST', '/app/auth/register', appUser, { auth: false, expect: [201] });
    appToken = appRegistration.data.token;
    await request('app me', 'GET', '/app/auth/me', undefined, { auth: false, headers: { authorization: `Bearer ${appToken}` } });
    await request('app saloes public', 'GET', '/app/pedidos/saloes', undefined, { auth: false });
    await request('app servicos public', 'GET', `/app/pedidos/saloes/${salaoId}/servicos`, undefined, { auth: false });
    await request('app profissionais public', 'GET', `/app/pedidos/saloes/${salaoId}/profissionais?data=2099-01-16&horario=10:00&servicoId=${servicoId}`, undefined, { auth: false });
    await request('app loja produtos public', 'GET', `/app/loja/saloes/${salaoId}/produtos`, undefined, { auth: false });
    await request('app cliente perfil', 'GET', `/app/cliente/perfil/${salaoId}`, undefined, {
      auth: false,
      headers: { authorization: `Bearer ${appToken}` }
    });
    const pedidoAgendamento = await request('app pedido agendamento create', 'POST', '/app/pedidos', {
      salonId: salaoId,
      servicoId,
      profissionalId,
      dataDesejada: '2099-01-16',
      horarioDesejado: '10:00',
      observacoes: runId
    }, { auth: false, headers: { authorization: `Bearer ${appToken}` }, expect: [201] });
    await request('app pedidos meus', 'GET', '/app/pedidos/meus', undefined, { auth: false, headers: { authorization: `Bearer ${appToken}` } });
    await request('app pedidos salao', 'GET', '/app/pedidos/salao');
    await request('app pedido disponibilidade', 'GET', `/app/pedidos/${pedidoAgendamento.id}/verificar-disponibilidade`);
    await request('app pedido proximo horario', 'GET', `/app/pedidos/${pedidoAgendamento.id}/proximo-horario`, undefined, { expect: [200, 404] });
    await request('app pedido rejeitar', 'PUT', `/app/pedidos/${pedidoAgendamento.id}/rejeitar`, { motivo: 'Teste Jest' });

    const pedidoLoja = await request('app loja pedido create', 'POST', '/app/loja/pedido', {
      salonId: salaoId,
      itens: [{ produtoId, quantidade: 1 }],
      formaPagamento: 'pix',
      observacoes: runId
    }, { auth: false, headers: { authorization: `Bearer ${appToken}` }, expect: [201] });
    await request('app loja meus pedidos', 'GET', '/app/loja/meus-pedidos', undefined, { auth: false, headers: { authorization: `Bearer ${appToken}` } });
    await request('app loja pedidos salao', 'GET', '/app/loja/pedidos');
    await request('app loja pedido status', 'PUT', `/app/loja/pedidos/${pedidoLoja.id}/status`, { status: 'confirmado' });

    await enableProfissionalAppLogin(profissionalId, 'Smoke123!@#');
    const profissionalLogin = await request('profissional app login', 'POST', '/app/profissional/auth/login', {
      email: `${runId}-profissional@${emailDomain}`,
      password: 'Smoke123!@#'
    }, { auth: false });
    profissionalToken = profissionalLogin.data.token;
    const profissionalHeaders = { authorization: `Bearer ${profissionalToken}` };
    await request('profissional app me', 'GET', '/app/profissional/auth/me', undefined, { auth: false, headers: profissionalHeaders });
    await request('profissional app ponto create', 'POST', '/app/profissional/ponto', { tipo: 'entrada' }, { auth: false, headers: profissionalHeaders, expect: [201] });
    await request('profissional app ponto list', 'GET', '/app/profissional/ponto', undefined, { auth: false, headers: profissionalHeaders });
    await request('profissional app agenda', 'GET', '/app/profissional/agenda?data=2099-01-15', undefined, { auth: false, headers: profissionalHeaders });
    await request('profissional app atendimentos', 'GET', '/app/profissional/atendimentos', undefined, { auth: false, headers: profissionalHeaders });
    await request('profissional app comissoes', 'GET', '/app/profissional/comissoes?data_inicio=2099-01-01&data_fim=2099-01-31', undefined, { auth: false, headers: profissionalHeaders });
    await request('profissional app produto usado create', 'POST', '/app/profissional/produtos-utilizados', {
      marca: `${runId} Marca`,
      coloracao: '1.0',
      cliente_id: clienteId,
      agendamento_id: agendamentoId
    }, { auth: false, headers: profissionalHeaders, expect: [201] });
    await request('profissional app produtos usados', 'GET', '/app/profissional/produtos-utilizados', undefined, { auth: false, headers: profissionalHeaders });
    await request('profissional app atendimentos hoje', 'GET', '/app/profissional/atendimentos-hoje', undefined, { auth: false, headers: profissionalHeaders });
  }, 60000);
});
