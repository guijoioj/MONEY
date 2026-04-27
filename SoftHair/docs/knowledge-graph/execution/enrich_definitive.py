#!/usr/bin/env python3
"""
PASSADA DEFINITIVA — Enriquece TODAS as notas do Knowledge Graph.
Inclui entity notes, source notes, domain notes, concept notes.
Remove todo boilerplate do LightRAG e substitui por conteúdo descritivo.
15 workers paralelos.
"""

import re
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

KG = Path("/home/ogejota/MONEY/SoftHair/docs/knowledge-graph")
MAX_WORKERS = 15

# ─── Boilerplate patterns para REMOVER ───
BOILERPLATE = [
    "Documento exportado automaticamente do LightRAG para consulta no Obsidian.",
    "Representa um conceito identificado no codigo/documentacao indexado pelo LightRAG.",
]

# ─── Seções genéricas para LIMPAR ───
GENERIC_SECTIONS = [
    "Sem arquivo de origem associado.",
    "Sem arquivos relacionados ainda.",
    "Sem conceito canonico associado.",
    "Sem entidades vinculadas ainda.",
]


def generate_entity_resumo(entity_name: str, kind: str, domains: list, connected: list) -> str:
    """Gera resumo inteligente para entity notes baseado no nome e conexões."""
    name = entity_name.lower().replace("-", " ").replace("_", " ")
    
    # Tentar identificar o tipo pela naming convention
    if any(x in name for x in ["service", "serviço"]):
        return f"Service do sistema SoftHair. Encapsula lógica de negócio para operações de **{name.replace('service','')}**."
    
    if any(x in name for x in ["model", "modelo"]):
        return f"Model de dados do SoftHair. Define a estrutura e queries para **{name.replace('model','')}** no banco de dados."
    
    if any(x in name for x in ["middleware", "auth"]) and "middleware" in name:
        return f"Middleware de autenticação/autorização. Intercepta requisições para validar tokens e permissões."
    
    if any(x in name for x in ["route", "rota", "endpoint"]):
        return f"Endpoint da API REST do SoftHair. Define operações HTTP para **{name}**."
    
    if name in ["jwt", "jsonwebtoken", "token", "bearer"]:
        return "JSON Web Token. Mecanismo de autenticação stateless usado para validar sessões de usuário e dispositivos."
    
    if name in ["cors"]:
        return "Cross-Origin Resource Sharing. Configuração de segurança que controla quais domínios podem acessar a API."
    
    if name in ["helmet"]:
        return "Middleware de segurança HTTP. Configura headers como CSP, HSTS, X-Frame-Options para proteger contra ataques comuns."
    
    if name in ["express"]:
        return "Framework web Node.js. Base da API REST do SoftHair, gerencia rotas, middleware e ciclo de vida HTTP."
    
    if name in ["pool", "pg", "postgresql", "database"]:
        return "Pool de conexões PostgreSQL. Gerencia conexões reutilizáveis ao banco de dados para performance."
    
    if "query" in name:
        return "Função de query ao banco de dados. Executa SQL parametrizado contra o pool PostgreSQL."
    
    if name in ["websocket", "ws", "websocket server", "websocketservice"]:
        return "Serviço de comunicação em tempo real. Gerencia conexões WebSocket por salão com pub/sub de canais."
    
    if name in ["bcrypt", "crypto", "hash"]:
        return "Módulo de criptografia. Usado para hash de senhas (bcrypt) e geração de tokens seguros."
    
    if name in ["rate limiting", "rate limit", "rate-limiting"]:
        return "Limitador de taxa de requisições. Previne abuso e ataques de brute force limitando requests por IP/janela."
    
    if any(x in name for x in ["salao", "salão", "salon"]):
        return "Entidade Salão. Unidade central do multi-tenancy — cada salão é um tenant isolado no sistema."
    
    if any(x in name for x in ["cliente"]):
        return "Entidade Cliente. Representa um cliente do salão com dados de contato, histórico e créditos."
    
    if any(x in name for x in ["profissional", "professional"]):
        return "Entidade Profissional. Representa um profissional do salão com especialidades e comissão."
    
    if any(x in name for x in ["agendamento", "agenda", "scheduling"]):
        return "Entidade Agendamento. Registro de horário marcado vinculando cliente, profissional e serviço."
    
    if any(x in name for x in ["servico", "serviço", "service"]) and "service" not in name:
        return "Entidade Serviço. Tipo de serviço oferecido pelo salão com preço e duração."
    
    if any(x in name for x in ["produto", "product", "estoque"]):
        return "Entidade Produto. Item do estoque do salão com controle de quantidade e preço."
    
    if any(x in name for x in ["venda", "sale"]):
        return "Entidade Venda. Registro de transação comercial (serviço, produto ou misto)."
    
    if any(x in name for x in ["comiss"]):
        return "Entidade Comissão. Valor devido ao profissional por atendimento/venda realizada."
    
    if any(x in name for x in ["fechamento", "closing"]):
        return "Fechamento financeiro. Consolidação de receitas, despesas e comissões em um período."
    
    if any(x in name for x in ["credito", "credit"]):
        return "Crédito de cliente. Saldo pré-pago que pode ser usado como forma de pagamento."
    
    if any(x in name for x in ["notifica", "notification"]):
        return "Notificação interna. Alerta do sistema para profissionais e administradores."
    
    if any(x in name for x in ["backup", "restore"]):
        return "Backup/Restore do salão. Exportação e importação de dados completos em formato JSON."
    
    if any(x in name for x in ["sync", "sincroniz"]):
        return "Sincronização. Mecanismo de push/pull de mudanças entre clientes e servidor central."
    
    if any(x in name for x in ["migration", "migrate"]):
        return "Migração de banco de dados. Alteração incremental do schema PostgreSQL."
    
    if any(x in name for x in ["fingerprint", "device"]):
        return "Fingerprint de dispositivo. Identificador único para validação de dispositivos autorizados."
    
    if any(x in name for x in ["api key", "apikey", "api_key"]):
        return "API Key. Chave de autenticação para integrações externas com expiração configurável."
    
    if name in ["admin", "requireadmin"]:
        return "Controle de acesso administrativo. Restringe endpoints sensíveis a usuários com tipo 'admin'."
    
    if any(x in name for x in ["validator", "validation"]):
        return "Validação de entrada. Usa express-validator para sanitizar e validar dados de requisições HTTP."
    
    if any(x in name for x in ["transaction", "withtransaction"]):
        return "Transação de banco de dados. Garante atomicidade em operações multi-query (BEGIN/COMMIT/ROLLBACK)."
    
    if any(x in name for x in ["created_at", "updated_at", "timestamp"]):
        return "Campo de timestamp. Rastreia data de criação/atualização de registros no banco."
    
    if any(x in name for x in ["port", "env", "environment"]):
        return "Variável de ambiente. Configuração externa que controla o comportamento do servidor."
    
    if any(x in name for x in ["force_https", "ssl", "https", "tls"]):
        return "Configuração SSL/HTTPS. Força conexões seguras quando certificados estão disponíveis."
    
    # Fallback baseado nos domínios conectados
    if domains:
        domain_names = ", ".join(d.split("|")[0].split("/")[-1] for d in domains[:3])
        return f"Conceito do SoftHair nos domínios **{domain_names}**. Elemento identificado no código e documentação do sistema."
    
    # Fallback baseado nas entidades conectadas
    if connected:
        return f"Conceito técnico do SoftHair com {len(connected)} entidades conectadas no knowledge graph."
    
    return f"Elemento do sistema SoftHair identificado no código fonte. Atua como nó de ligação no knowledge graph."


def enrich_entity_note(path: Path) -> str:
    """Enriquece uma entity note."""
    try:
        content = path.read_text(encoding="utf-8")
        
        # Extrair metadados existentes
        entity_match = re.search(r'\*\*Entity:\*\*\s*`([^`]+)`', content)
        kind_match = re.search(r'\*\*Kind:\*\*\s*`([^`]+)`', content)
        entity_name = entity_match.group(1) if entity_match else path.stem
        kind = kind_match.group(1) if kind_match else "concept"
        
        # Extrair domínios conectados
        domains = re.findall(r'\[\[domains/([^\]]+)\]\]', content)
        
        # Extrair entidades conectadas
        connected = re.findall(r'\[\[(?:server|mobile|desktop)/entities/([^\]]+)\]\]', content)
        
        # Extrair conceito canônico
        canonical = re.findall(r'\[\[concepts/([^\]]+)\]\]', content)
        
        # Gerar novo resumo
        new_resumo = generate_entity_resumo(entity_name, kind, domains, connected)
        
        # Reconstruir nota limpa preservando TODAS as conexões
        repo_match = re.search(r'\*\*Repository:\*\*\s*(\w+)', content)
        repo = repo_match.group(1) if repo_match else "Server"
        source_match = re.search(r'\*\*Source File:\*\*\s*`([^`]+)`', content)
        source = source_match.group(1) if source_match else "n/a"
        
        # Preservar seções de links
        domains_section = ""
        dom_match = re.search(r'## Dominio?s\n\n((?:- \[\[.*\]\]\n?)*)', content)
        if dom_match:
            domains_section = dom_match.group(1).strip()
        
        connected_section = ""
        conn_match = re.search(r'## Entidades Conectadas\n\n((?:- \[\[.*\]\]\n?)*)', content)
        if conn_match:
            connected_section = conn_match.group(1).strip()
        
        canonical_section = ""
        canon_match = re.search(r'## Conceito Canonico\n\n(\[\[.*\]\])', content)
        if canon_match:
            canonical_section = canon_match.group(1).strip()
        
        related_section = ""
        rel_match = re.search(r'## Arquivos Relacionados\n\n((?:- \[\[.*\]\]\n?)*)', content)
        if rel_match:
            rel_text = rel_match.group(1).strip()
            if rel_text:
                related_section = rel_text
        
        # Construir nota limpa
        new_content = f"""# {entity_name}

**Repository:** {repo}
**Entity:** `{entity_name}`
**Kind:** `{kind}`
**Source File:** `{source}`

---

#{repo.lower()} #entity

## Resumo

{new_resumo}
"""
        
        if source != "n/a":
            new_content += f"""
## Referência

Arquivo fonte: `{source}`
"""
        
        if canonical_section:
            new_content += f"""
## Conceito Canônico

{canonical_section}
"""
        
        if domains_section:
            new_content += f"""
## Domínios

{domains_section}
"""
        
        if connected_section:
            new_content += f"""
## Entidades Conectadas

{connected_section}
"""
        
        if related_section:
            new_content += f"""
## Arquivos Relacionados

{related_section}
"""
        
        path.write_text(new_content, encoding="utf-8")
        return "enriched"
        
    except Exception as e:
        return f"error:{e}"


def clean_source_note(path: Path) -> str:
    """Limpa boilerplate restante de source notes."""
    try:
        content = path.read_text(encoding="utf-8")
        changed = False
        
        for bp in BOILERPLATE:
            if bp in content:
                content = content.replace(bp, "")
                changed = True
        
        for gs in GENERIC_SECTIONS:
            if gs in content:
                content = content.replace(gs, "")
                changed = True
        
        # Limpar seção Explicação vazia
        content = re.sub(r'## Explicac[aã]o\n\n\s*\n', '\n', content)
        # Limpar Referência vazia
        content = re.sub(r'## Referencia\n\n\s*\n', '\n', content)
        # Limpar linhas vazias excessivas
        content = re.sub(r'\n{4,}', '\n\n', content)
        
        if changed:
            path.write_text(content, encoding="utf-8")
            return "cleaned"
        return "skip"
        
    except Exception as e:
        return f"error:{e}"


def process(path: Path) -> dict:
    """Processa qualquer nota."""
    is_entity = "/entities/" in str(path)
    
    content = path.read_text(encoding="utf-8")
    has_boilerplate = any(bp in content for bp in BOILERPLATE + GENERIC_SECTIONS) or "extraida do contexto" in content
    
    if not has_boilerplate:
        return {"status": "skip", "type": "clean"}
    
    if is_entity:
        status = enrich_entity_note(path)
        return {"status": status, "type": "entity"}
    else:
        status = clean_source_note(path)
        return {"status": status, "type": "source"}


def main():
    print("🚀 PASSADA DEFINITIVA — Enriquecendo TUDO (incluindo entities)")
    print(f"   Workers: {MAX_WORKERS}")
    print()
    
    # Coletar TODAS as notas
    notes = [md for md in KG.rglob("*.md")
             if "/.obsidian/" not in str(md) 
             and "/directives/" not in str(md) 
             and "/execution/" not in str(md)]
    
    print(f"📊 Total de notas: {len(notes)}")
    
    entities_in = sum(1 for n in notes if "/entities/" in str(n))
    print(f"   Entity notes: {entities_in}")
    print(f"   Source/Other: {len(notes) - entities_in}")
    print()
    
    stats = {"enriched": 0, "cleaned": 0, "skip": 0, "error": 0}
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process, n): n for n in notes}
        
        for i, future in enumerate(as_completed(futures), 1):
            result = future.result()
            status = result["status"]
            if status == "enriched":
                stats["enriched"] += 1
            elif status == "cleaned":
                stats["cleaned"] += 1
            elif status == "skip":
                stats["skip"] += 1
            else:
                stats["error"] += 1
            
            if i % 50 == 0 or i == len(notes):
                print(f"  [{i}/{len(notes)}] ✅ {stats['enriched']} entities | 🧹 {stats['cleaned']} cleaned | ⏭️ {stats['skip']} ok | ❌ {stats['error']}")
    
    print()
    print("=" * 55)
    print("  RESULTADO FINAL")
    print("=" * 55)
    print(f"  Entity notes enriquecidas: {stats['enriched']}")
    print(f"  Source notes limpas:       {stats['cleaned']}")
    print(f"  Já estavam OK:            {stats['skip']}")
    print(f"  Erros:                    {stats['error']}")
    print()
    
    # Verificação final
    checks = {
        "extraida do contexto": 0,
        "Documento exportado automaticamente": 0,
        "Sem arquivo de origem associado": 0,
        "Sem arquivos relacionados ainda": 0,
        "Sem conceito canonico associado": 0,
        "Sem entidades vinculadas ainda": 0,
    }
    
    for md in KG.rglob("*.md"):
        if "/.obsidian/" in str(md) or "/directives/" in str(md) or "/execution/" in str(md):
            continue
        try:
            txt = md.read_text()
            for pattern in checks:
                if pattern in txt:
                    checks[pattern] += 1
        except:
            pass
    
    print("  Boilerplate restante:")
    all_clean = True
    for pattern, count in checks.items():
        status = "✅" if count == 0 else "❌"
        if count > 0:
            all_clean = False
        print(f"    {status} \"{pattern}\": {count}")
    
    print()
    if all_clean:
        print("  🎉 ZERO boilerplate restante!")
    else:
        print("  ⚠️ Ainda há boilerplate — rodar novamente")


if __name__ == "__main__":
    main()
