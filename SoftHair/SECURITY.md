# SoftHair - Documentação de Segurança

Este documento descreve todas as camadas de segurança implementadas no sistema SoftHair.

## 🔐 Resumo das Camadas de Segurança

### 1. Banco de Dados PostgreSQL

#### Senha Forte
- **Senha**: `3((|6h#{Y59jBsa`
- **Complexidade**: 16 caracteres com maiúsculas, minúsculas, números e símbolos
- **Armazenamento**: Configurada no arquivo `.env`

#### Conexão SSL/TLS
- Todas as conexões ao banco de dados usam SSL
- Certificados de cliente/servidor para autenticação mútua
- Rejeição de conexões não criptografadas

#### Configurações de Pool
- Limite de conexões: 10
- Timeout de conexão: 5 segundos
- Timeout de idle: 30 segundos
- Timeout de query: 30 segundos

### 2. Backend (Node.js/Express)

#### HTTPS/TLS
- Forçar HTTPS em produção
- Suporte a HTTP/2
- Certificados SSL válidos
- Headers HSTS (HTTP Strict Transport Security)

#### Helmet Security Headers
- Content Security Policy (CSP)
- HSTS (max-age: 1 ano)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection
- Referrer-Policy

#### Rate Limiting
- **Geral**: 100 requisições por 15 minutos
- **Autenticação**: 5 tentativas por 15 minutos
- **Slow Down**: Delay progressivo após 50 requisições

#### CORS
- Origens configuradas explicitamente
- Não permite credenciais de origens desconhecidas
- Validação de origem em todas as requisições

### 3. Autenticação de API

#### API Key
- Header obrigatório: `X-API-Key`
- Validação em todas as rotas do app
- Diferentes chaves para ambientes

#### HMAC Signature
- Assinatura de requisições POST/PUT/DELETE
- Timestamp de 5 minutos de validade
- Previne replay attacks
- Algoritmo: SHA-256

#### JWT (JSON Web Tokens)
- Expiração: 7 dias
- Secret forte (256 bits)
- Validação de integridade
- Tokens revogáveis

#### Device ID
- Identificação única por dispositivo
- Registro de dispositivos autorizados
- Revogação de dispositivos comprometidos
- Expiração por inatividade (24 horas)

### 4. Proteção contra Ataques

#### Brute Force Protection
- Bloqueio após 5 tentativas falhas
- Bloqueio por IP (15 minutos)
- Logs de tentativas de login

#### SQL Injection Prevention
- Uso de prepared statements
- Validação com express-validator
- Sanitização de inputs

#### XSS Protection
- Helmet CSP headers
- Escapamento de output
- Validação de entrada

#### CSRF Protection
- Tokens CSRF para mutações
- Validação de origem
- SameSite cookies

### 5. Criptografia de Dados

#### Dados em Repouso
- **Algoritmo**: AES-256-GCM
- **Dados criptografados**:
  - CPF dos clientes
  - Telefones
  - E-mails (hash)

#### Dados em Trânsito
- TLS 1.2+ obrigatório
- Cipher suites seguras
- Perfect Forward Secrecy

### 6. Logs e Monitoramento

#### Logs de Segurança
- Tentativas de acesso não autorizado
- Tokens revogados
- Alterações em dados sensíveis
- Dispositivos não autorizados

#### Tabelas de Auditoria
- `logs_seguranca`: Eventos de segurança
- `tentativas_login`: Tentativas de autenticação
- `tokens_revogados`: Tokens inválidos
- `dispositivos`: Dispositivos autorizados

### 7. Segurança Mobile (React Native)

#### Detecção de Root/Jailbreak
- Verificação de arquivos suspeitos
- Detecção de apps de root
- Bloqueio em dispositivos comprometidos

#### Secure Storage
- AsyncStorage para dados não sensíveis
- SecureStore para tokens e credenciais
- Device ID persistente e único

#### Certificate Pinning
- Validação de certificados SSL
- Prevenção de MITM attacks

#### Headers de Segurança
- Device fingerprint
- App version
- OS version
- Platform

## 📋 Checklist de Segurança

### Configuração Inicial
- [ ] Alterar senha do banco de dados
- [ ] Gerar API_KEY e HMAC_SECRET
- [ ] Configurar certificados SSL
- [ ] Definir ALLOWED_ORIGINS
- [ ] Configurar ENCRYPTION_KEY

### Deploy
- [ ] NODE_ENV=production
- [ ] FORCE_HTTPS=true
- [ ] DATABASE_SSL=true
- [ ] Executar security.sql
- [ ] Instalar dependências de segurança

### Monitoramento
- [ ] Verificar logs de segurança
- [ ] Monitorar tentativas de login
- [ ] Revisar dispositivos autorizados
- [ ] Verificar tokens revogados

## 🔧 Comandos de Manutenção

### Gerar Novas Chaves
```bash
# API Key
openssl rand -hex 32

# HMAC Secret
openssl rand -hex 64

# Encryption Key
openssl rand -hex 32

# JWT Secret
openssl rand -hex 64
```

### Limpar Tokens Expirados
```sql
SELECT limpar_tokens_revogados_expirados();
```

### Revogar Todos os Dispositivos de um Usuário
```sql
UPDATE dispositivos SET ativo = false WHERE usuario_id = ?;
```

## 🚨 Resposta a Incidentes

### Suspeita de Acesso Não Autorizado
1. Revogar tokens do usuário
2. Desativar dispositivos
3. Bloquear usuário
4. Verificar logs
5. Notificar usuário

### Vazamento de Dados
1. Isolar sistema afetado
2. Revogar todas as sessões
3. Forçar troca de senhas
4. Auditar acessos
5. Notificar autoridades (LGPD)

## 🖥️ Desktop App (Electron) — Segurança Específica

### safeStorage (P5-C1)
- `secrets.json` (JWT secret) é criptografado via `electron.safeStorage` em
  produção, ligando a chave ao user account + machine (DPAPI/Keychain/libsecret).
- Migração de instalações legacy é automática no primeiro boot pós-Pass 5.

### Auto-update (P5-C2)
- `electron-updater` checa GitHub Releases 30s após boot.
- SHA256 verification do `latest.yml` protege contra MitM em transit.
- Code signing está pendente (roadmap) — distribuição via canal oficial é
  obrigatória até signing estar implementado.

### LGPD / Privacy (P5-A2)
- Endpoint `POST /api/auth/me/delete-account-data` cumpre LGPD art. 18
  (recurso de "esquecimento"). Purga tabelas + secrets + sync-config +
  backups + logs.
- Logs locais nunca contêm body de POST (verificado em audit).
- crashReporter `uploadToServer: false` — dumps ficam locais.

### DevTools / Sandbox
- F12, Ctrl+Shift+I/J/C, right-click "Inspect" bloqueados em produção.
- Flags perigosas (`--no-sandbox`, `--disable-web-security`,
  `--allow-running-insecure-content`) abortam o boot.
- BrowserWindow com `sandbox: true`, `contextIsolation: true`,
  `nodeIntegration: false`.

### Conflict resolution em sync (P5-C4)
- Edits concorrentes não sobrescrevem silenciosamente. Tabela
  `sync_conflicts` registra divergências para revisão humana via
  `GET /api/sync/conflicts`.

## 📞 Contato de Segurança

Para reportar vulnerabilidades ou incidentes de segurança:
- Email: security@softhair.com
- PGP Key: [disponível em request]
- **Disclosure timeline**: 90 dias entre reporte privado e divulgação pública.

---

**Última atualização**: 2026-05-13 (Pass 5)
**Versão**: 3.0.0-secure