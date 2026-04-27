#!/usr/bin/env python3
"""
PASSADA NUCLEAR — Substitui in-place todo boilerplate.
Abordagem: find-and-replace, não reconstrução.
"""

import re
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

KG = Path("/home/ogejota/MONEY/SoftHair/docs/knowledge-graph")
MAX_WORKERS = 15

# Mapa de nomes de entidades para resumos inteligentes
ENTITY_RESUMOS = {}

def smart_entity_resumo(entity_name: str, domains_text: str = "", connected_text: str = "") -> str:
    """Gera resumo para qualquer entidade baseado no nome."""
    n = entity_name.lower().replace("-", " ").replace("_", " ")
    
    lookup = {
        "jwt": "JSON Web Token — mecanismo de autenticação stateless para validar sessões.",
        "cors": "Cross-Origin Resource Sharing — controla quais domínios acessam a API.",
        "helmet": "Middleware de segurança HTTP — configura headers CSP, HSTS, X-Frame-Options.",
        "express": "Framework web Node.js — base da API REST do SoftHair.",
        "pool": "Pool de conexões PostgreSQL — gerencia conexões reutilizáveis ao banco.",
        "postgresql": "Banco de dados relacional principal do SoftHair.",
        "websocket server": "Servidor WebSocket para comunicação em tempo real entre clientes.",
        "rate limiting": "Limitador de requisições — previne abuso e brute force.",
        "admin": "Controle de acesso administrativo — restringe endpoints sensíveis.",
        "bearer": "Esquema de autenticação HTTP Bearer — transporta JWT no header Authorization.",
        "crypto": "Módulo criptográfico — hash de senhas e geração de tokens seguros.",
        "path": "Módulo Node.js para manipulação de caminhos de arquivo.",
        "port": "Porta de escuta do servidor HTTP (default: 3000).",
        "force_https": "Flag para forçar conexões HTTPS quando certificados SSL estão disponíveis.",
        "healthcheck": "Endpoint de verificação de saúde do sistema (/api/health).",
        "sync_log": "Tabela de log de sincronização — rastreia operações push/pull.",
    }
    
    # Exact match
    for key, val in lookup.items():
        if n == key or n.replace(" ", "") == key.replace(" ", ""):
            return val
    
    # Pattern match
    patterns = [
        (["service", "serviço"], "Service de lógica de negócio para **{name}**."),
        (["model", "modelo"], "Model de dados para **{name}** no PostgreSQL."),
        (["middleware"], "Middleware Express para **{name}**."),
        (["route", "rota"], "Endpoint da API REST para **{name}**."),
        (["query", "queryone", "queryrun"], "Função de query ao banco de dados."),
        (["withtransaction", "transaction"], "Transação atômica BEGIN/COMMIT/ROLLBACK."),
        (["validator", "validation", "validationresult"], "Validação de entrada com express-validator."),
        (["salao", "salão", "salaoid", "salao_id"], "Entidade Salão — unidade central do multi-tenancy."),
        (["cliente", "client"], "Entidade Cliente do salão."),
        (["profissional", "professional"], "Entidade Profissional do salão."),
        (["agendamento", "agenda"], "Agendamento — horário marcado com cliente e profissional."),
        (["servico", "serviço"], "Serviço oferecido pelo salão."),
        (["produto", "product", "estoque"], "Produto do estoque do salão."),
        (["venda", "sale", "vendas"], "Registro de venda/transação comercial."),
        (["comiss"], "Comissão devida ao profissional."),
        (["fechamento"], "Fechamento financeiro de período."),
        (["credito", "credit"], "Crédito/saldo pré-pago de cliente."),
        (["notifica", "notification"], "Notificação interna do sistema."),
        (["backup", "restore"], "Backup/restore de dados do salão."),
        (["sync", "sincroniz"], "Sincronização de dados entre cliente e servidor."),
        (["migrat"], "Migração de schema do banco de dados."),
        (["fingerprint", "device"], "Fingerprint/identificador de dispositivo."),
        (["api key", "apikey", "api_key", "createapikey"], "Chave de autenticação para integrações externas."),
        (["register", "registersalao"], "Registro/cadastro de salão no sistema."),
        (["requireadmin"], "Middleware que restringe acesso a administradores."),
        (["authmiddleware", "optionalauth"], "Middleware de autenticação JWT."),
        (["authservice"], "Service de autenticação e autorização."),
        (["token"], "Token de autenticação (JWT ou API Key)."),
        (["user", "usuario", "usuarios"], "Entidade Usuário do sistema."),
        (["created_at", "updated_at", "data_cadastro", "data_atualizacao"], "Campo de timestamp no banco."),
        (["connectionstatus"], "Status de conexão com o servidor."),
        (["pending queue"], "Fila de operações pendentes para sync offline."),
        (["basemodel"], "Classe base abstrata para todos os models."),
        (["frontende", "frontend"], "Camada de interface do usuário."),
        (["environment variables"], "Variáveis de ambiente do servidor."),
        (["database connection"], "Configuração de conexão com PostgreSQL."),
        (["database query"], "Consulta ao banco de dados."),
    ]
    
    for keywords, template in patterns:
        if any(kw in n for kw in keywords):
            clean_name = entity_name.replace("-", " ").split(" ")[0]
            return template.format(name=clean_name)
    
    # Fallback com domínios
    if domains_text:
        doms = re.findall(r'\[\[domains/([^|]+)', domains_text)
        if doms:
            return f"Conceito do SoftHair nos domínios **{', '.join(doms[:3])}**."
    
    return f"Elemento do sistema SoftHair. Nó de ligação no knowledge graph."


def process_note(path: Path) -> str:
    """Processa qualquer nota — substituição in-place."""
    try:
        content = path.read_text(encoding="utf-8")
        original = content
        
        # 1. Substituir resumos genéricos de entity notes
        entity_match = re.search(r'Entidade `([^`]+)` extraida do contexto \w+\.', content)
        if entity_match:
            entity_name = entity_match.group(1)
            # Extrair domínios para contexto
            domains_text = ""
            dom_match = re.search(r'## Dominio?s\n\n((?:.*\n)*?)(?=\n## )', content)
            if dom_match:
                domains_text = dom_match.group(1)
            
            new_resumo = smart_entity_resumo(entity_name, domains_text)
            content = content.replace(entity_match.group(0), new_resumo)
        
        # 2. Remover boilerplate LightRAG
        removals = [
            "Documento exportado automaticamente do LightRAG para consulta no Obsidian.",
            "Representa um conceito identificado no codigo/documentacao indexado pelo LightRAG.",
            "Sem arquivo de origem associado.",
            "Sem arquivos relacionados ainda.",
            "Sem conceito canonico associado.",
            "Sem entidades vinculadas ainda.",
        ]
        for r in removals:
            content = content.replace(r, "")
        
        # 3. Limpar seções que ficaram vazias
        content = re.sub(r'## Explicac[aã]o\n\n\s*\n', '\n', content)
        content = re.sub(r'## Referencia\n\n\s*\n', '\n', content)
        content = re.sub(r'## Conceito Canonico\n\n\s*\n', '\n', content)
        content = re.sub(r'## Arquivos Relacionados\n\n\s*\n', '\n', content)
        
        # 4. Limpar linhas vazias excessivas
        content = re.sub(r'\n{3,}', '\n\n', content)
        
        if content != original:
            path.write_text(content, encoding="utf-8")
            return "fixed"
        return "ok"
        
    except Exception as e:
        return f"error:{e}"


def main():
    print("☢️  PASSADA NUCLEAR — Limpeza in-place de TODAS as notas")
    
    notes = [md for md in KG.rglob("*.md")
             if "/.obsidian/" not in str(md)
             and "/directives/" not in str(md)
             and "/execution/" not in str(md)]
    
    print(f"📊 {len(notes)} notas para processar")
    
    fixed = 0
    ok = 0
    errors = 0
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        results = list(ex.map(process_note, notes))
    
    for r in results:
        if r == "fixed": fixed += 1
        elif r == "ok": ok += 1
        else: errors += 1
    
    print(f"✅ {fixed} corrigidas | ⏭️ {ok} já OK | ❌ {errors} erros")
    
    # Verificação
    checks = [
        "extraida do contexto",
        "Documento exportado automaticamente",
        "Sem arquivo de origem associado",
        "Sem arquivos relacionados ainda",
        "Sem conceito canonico associado", 
        "Sem entidades vinculadas ainda",
        "identificado no codigo/documentacao",
    ]
    
    print("\n📊 Verificação:")
    for check in checks:
        c = sum(1 for md in KG.rglob("*.md")
                if "/.obsidian/" not in str(md) and "/directives/" not in str(md) and "/execution/" not in str(md)
                and check in md.read_text())
        icon = "✅" if c == 0 else "❌"
        print(f"  {icon} \"{check[:40]}...\": {c}")


if __name__ == "__main__":
    main()
