-- Tabela de dispositivos autorizados
CREATE TABLE IF NOT EXISTS dispositivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id TEXT NOT NULL,
    info JSONB NOT NULL,
    ativo BOOLEAN DEFAULT true,
    ultimo_acesso TIMESTAMP WITH TIME ZONE,
    app_version VARCHAR(20),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_dispositivos_usuario
        FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dispositivos_usuario_id ON dispositivos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_dispositivos_ativo ON dispositivos(ativo);
CREATE INDEX IF NOT EXISTS idx_dispositivos_ultimo_acesso ON dispositivos(ultimo_acesso);

-- Tabela de logs de segurança
CREATE TABLE IF NOT EXISTS logs_seguranca (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(50) NOT NULL,
    usuario_id TEXT,
    dispositivo_id UUID,
    ip VARCHAR(45),
    user_agent TEXT,
    endpoint VARCHAR(255),
    metodo VARCHAR(10),
    status_code INTEGER,
    mensagem TEXT,
    dados_adicionais JSONB,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_logs_usuario
        FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_logs_dispositivo
        FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE SET NULL
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_logs_seguranca_tipo ON logs_seguranca(tipo);
CREATE INDEX IF NOT EXISTS idx_logs_seguranca_usuario_id ON logs_seguranca(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_seguranca_criado_em ON logs_seguranca(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_logs_seguranca_ip ON logs_seguranca(ip);

-- Tabela de tentativas de login
CREATE TABLE IF NOT EXISTS tentativas_login (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255),
    ip VARCHAR(45),
    user_agent TEXT,
    sucesso BOOLEAN DEFAULT false,
    mensagem TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para tentativas de login
CREATE INDEX IF NOT EXISTS idx_tentativas_login_email ON tentativas_login(email);
CREATE INDEX IF NOT EXISTS idx_tentativas_login_ip ON tentativas_login(ip);
CREATE INDEX IF NOT EXISTS idx_tentativas_login_criado_em ON tentativas_login(criado_em DESC);

-- Tabela de tokens revogados
CREATE TABLE IF NOT EXISTS tokens_revogados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(128) UNIQUE NOT NULL,
    expira_em TIMESTAMP WITH TIME ZONE NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_revogados_token_hash ON tokens_revogados(token_hash);
CREATE INDEX IF NOT EXISTS idx_tokens_revogados_expira_em ON tokens_revogados(expira_em);

-- Função para limpar tokens expirados
CREATE OR REPLACE FUNCTION limpar_tokens_revogados_expirados()
RETURNS INTEGER AS $$
BEGIN
    DELETE FROM tokens_revogados WHERE expira_em < NOW();
    RETURN 1;
END;
$$ LANGUAGE plpgsql;

-- Agendamento para limpar tokens expirados (executado diariamente)
CREATE OR REPLACE FUNCTION agendar_limpeza_tokens()
RETURNS VOID AS $$
BEGIN
    PERFORM cron.schedule('limpeza-tokens-revogados', '0 3 * * *', 'SELECT limpar_tokens_revogados_expirados();');
END;
$$ LANGUAGE plpgsql;

-- Adicionar colunas de segurança às tabelas existentes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cpf_encrypted VARCHAR(255);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefone_encrypted VARCHAR(255);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_clientes_cpf_encrypted ON clientes(cpf_encrypted);
CREATE INDEX IF NOT EXISTS idx_clientes_email_hash ON clientes(email_hash);

-- Adicionar coluna para marcar usuário como bloqueado
ALTER TABLE users ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tentativas_falhas INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ultima_tentativa_falha TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_bloqueado ON users(bloqueado);

-- Função para registrar log de segurança
CREATE OR REPLACE FUNCTION registrar_log_seguranca(
    p_tipo VARCHAR(50),
    p_usuario_id TEXT DEFAULT NULL,
    p_dispositivo_id UUID DEFAULT NULL,
    p_ip VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_endpoint VARCHAR(255) DEFAULT NULL,
    p_metodo VARCHAR(10) DEFAULT NULL,
    p_status_code INTEGER DEFAULT NULL,
    p_mensagem TEXT DEFAULT NULL,
    p_dados_adicionais JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO logs_seguranca (
        tipo, usuario_id, dispositivo_id, ip, user_agent,
        endpoint, metodo, status_code, mensagem, dados_adicionais
    ) VALUES (
        p_tipo, p_usuario_id, p_dispositivo_id, p_ip, p_user_agent,
        p_endpoint, p_metodo, p_status_code, p_mensagem, p_dados_adicionais
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger para registrar alterações em dados sensíveis
CREATE OR REPLACE FUNCTION registrar_alteracao_dados_sensiveis()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.cpf != NEW.cpf OR OLD.telefone != NEW.telefone OR OLD.email != NEW.email) THEN
            PERFORM registrar_log_seguranca(
                'ALTERACAO_DADOS_SENSIVEIS',
                NEW.id,
                NULL,
                current_setting('application.client_ip', true),
                current_setting('application.user_agent', true),
                TG_TABLE_NAME,
                TG_OP,
                200,
                'Dados sensíveis alterados',
                jsonb_build_object('tabela', TG_TABLE_NAME, 'id', NEW.id)
            );
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para monitorar alterações em clientes
DROP TRIGGER IF EXISTS trg_clientes_dados_sensiveis ON clientes;
CREATE TRIGGER trg_clientes_dados_sensiveis
    AFTER UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION registrar_alteracao_dados_sensiveis();