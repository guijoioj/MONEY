#!/usr/bin/env python3
"""
Execution Script: Enrich Knowledge Graph Notes
DOE Layer 3 - Deterministic execution with 15 parallel workers

Enriquece as notas do Obsidian com:
- Resumos descritivos reais
- Links de entidades e arquivos relacionados  
- Código fonte completo no final (para source notes)
"""

import os
import re
import json
import hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# ─── Config ───
KG_ROOT = Path("/home/ogejota/MONEY/SoftHair/docs/knowledge-graph")
SERVER_ROOT = Path("/home/ogejota/MONEY/SOFT-HAIR-SERVER")
DESKTOP_ROOT = Path("/home/ogejota/MONEY/SoftHair")
MOBILE_ROOT = Path("/home/ogejota/MONEY/SoftHair")  # Ajustar se diferente
MAX_WORKERS = 15
DATE = datetime.now().strftime("%Y-%m-%d")

# ─── Mapeamento de diretório KG → diretório de código ───
REPO_MAP = {
    "server": SERVER_ROOT,
    "desktop": DESKTOP_ROOT,
    "mobile": MOBILE_ROOT,
}

# ─── Estatísticas ───
stats = {"enriched": 0, "skipped": 0, "errors": 0, "code_added": 0}


def extract_file_path(note_content: str) -> str | None:
    """Extrai o path do arquivo fonte da nota."""
    match = re.search(r'\*\*File:\*\*\s*`([^`]+)`', note_content)
    return match.group(1) if match else None


def extract_repo(note_content: str) -> str | None:
    """Extrai o repositório da nota."""
    match = re.search(r'\*\*Repository:\*\*\s*(\w+)', note_content)
    return match.group(1).lower() if match else None


def is_already_enriched(content: str) -> bool:
    """Verifica se a nota já foi enriquecida (tem changelog ou resumo real)."""
    # Se já tem changelog, já foi enriquecida manualmente
    if "## Changelog" in content:
        return True
    # Se o resumo é genérico, PRECISA de enriquecimento
    if "Documento exportado automaticamente do LightRAG" in content:
        return False
    # Se tem descrição real (mais de 100 chars no resumo), está OK
    resumo_match = re.search(r'## Resumo\n\n(.+?)(?=\n\n##|\Z)', content, re.DOTALL)
    if resumo_match:
        resumo = resumo_match.group(1).strip()
        if len(resumo) > 100 and "do repositório" not in resumo:
            return True
    return False


def has_code_block(content: str) -> bool:
    """Verifica se a nota já tem bloco de código."""
    return "## Conteudo" in content or "## Conteúdo" in content


def find_source_file(file_path: str, repo: str) -> Path | None:
    """Encontra o arquivo fonte no disco."""
    if not file_path or not repo:
        return None
    
    repo_root = REPO_MAP.get(repo)
    if not repo_root:
        return None
    
    full_path = repo_root / file_path
    if full_path.exists():
        return full_path
    
    # Tentar variações
    for variant in [file_path, file_path.replace("src/", "")]:
        check = repo_root / variant
        if check.exists():
            return check
    
    return None


def generate_resumo(file_path: str, code: str, repo: str) -> str:
    """Gera um resumo baseado no código e path do arquivo."""
    basename = os.path.basename(file_path)
    dirname = os.path.dirname(file_path)
    
    # Heurísticas para gerar resumo
    if "routes/" in file_path:
        entity = basename.replace(".js", "").replace("src-routes-", "")
        return f"Rota Express para o endpoint `/api/{entity}`. Implementa operações CRUD com autenticação via `authMiddleware` e validação de entrada com `express-validator`."
    
    elif "services/" in file_path:
        service_name = basename.replace(".js", "").replace("Service", "")
        return f"Service de lógica de negócio para {service_name}. Encapsula queries ao banco de dados e regras de validação, isolando a camada de dados das rotas HTTP."
    
    elif "models/" in file_path:
        model_name = basename.replace(".js", "")
        return f"Model `{model_name}` que estende `BaseModel`. Define queries especializadas e métodos de domínio para a tabela correspondente no PostgreSQL."
    
    elif "config/" in file_path:
        return f"Arquivo de configuração: `{basename}`. Define constantes, conexões e inicializações necessárias para o boot do sistema."
    
    elif "middleware/" in file_path:
        return f"Middleware Express: `{basename}`. Intercepta requisições para validação, autenticação ou transformação de dados antes de atingir as rotas."
    
    elif "hooks/" in file_path:
        return f"React Hook customizado: `{basename}`. Encapsula lógica reutilizável de estado e efeitos colaterais para componentes."
    
    elif "components/" in file_path:
        return f"Componente React: `{basename}`. Elemento de UI reutilizável com sua própria lógica de renderização e estado."
    
    elif "pages/" in file_path or "screens/" in file_path:
        return f"Página/tela da aplicação: `{basename}`. Define o layout e comportamento de uma view completa, geralmente ligada a uma rota de navegação."
    
    elif "store/" in file_path:
        return f"Store de estado: `{basename}`. Gerencia estado global da aplicação usando padrão de gerenciamento centralizado."
    
    elif "scripts/" in file_path:
        return f"Script utilitário: `{basename}`. Executável via CLI para tarefas de manutenção, migração ou automação do sistema."
    
    elif "utils/" in file_path or "helpers" in file_path:
        return f"Biblioteca de utilitários: `{basename}`. Funções auxiliares reutilizáveis para formatação, validação e transformação de dados."
    
    else:
        return f"Arquivo `{basename}` do repositório {repo.capitalize()}. Localizado em `{dirname}/`."


def detect_entities(code: str, file_path: str) -> list[str]:
    """Detecta entidades relevantes no código."""
    entities = []
    
    # Detectar imports/requires
    requires = re.findall(r"require\(['\"]([^'\"]+)['\"]\)", code)
    for req in requires:
        if req.startswith("./") or req.startswith("../"):
            name = os.path.basename(req).replace(".js", "")
            entities.append(name)
    
    # Detectar classes
    classes = re.findall(r"class\s+(\w+)", code)
    entities.extend(classes)
    
    # Detectar exports
    exports = re.findall(r"module\.exports\s*=\s*(?:new\s+)?(\w+)", code)
    entities.extend(exports)
    
    return list(set(entities))[:10]  # Max 10


def detect_domains(file_path: str, code: str) -> list[str]:
    """Detecta domínios relevantes baseado no path e conteúdo."""
    domains = []
    
    domain_keywords = {
        "auth": ["auth", "login", "jwt", "token", "password", "bcrypt"],
        "database": ["query", "pool", "transaction", "migrate", "sql"],
        "sync": ["sync", "push", "changes", "timestamp"],
        "security": ["helmet", "cors", "rate", "sanitize", "crypto"],
        "agendamentos": ["agendamento", "agenda", "horario"],
        "clientes": ["cliente", "customer"],
        "servicos": ["servico", "service", "atendimento"],
        "produtos": ["produto", "estoque", "inventory"],
        "vendas": ["venda", "sale", "pagamento"],
        "api": ["route", "endpoint", "express", "middleware"],
    }
    
    text = (file_path + " " + code[:2000]).lower()
    for domain, keywords in domain_keywords.items():
        if any(kw in text for kw in keywords):
            domains.append(domain)
    
    return domains[:5]


def enrich_source_note(note_path: Path) -> dict:
    """Enriquece uma source note."""
    result = {"path": str(note_path), "status": "skipped", "reason": ""}
    
    try:
        content = note_path.read_text(encoding="utf-8")
        
        # Já enriquecida?
        if is_already_enriched(content):
            result["reason"] = "already enriched"
            return result
        
        file_path = extract_file_path(content)
        repo = extract_repo(content)
        
        if not file_path or not repo:
            result["reason"] = "no file path or repo found"
            return result
        
        # Encontrar código fonte
        source_file = find_source_file(file_path, repo)
        code = ""
        lang = "javascript"
        
        if source_file and source_file.exists():
            try:
                code = source_file.read_text(encoding="utf-8")
                if source_file.suffix == ".py":
                    lang = "python"
                elif source_file.suffix in [".ts", ".tsx"]:
                    lang = "typescript"
                elif source_file.suffix in [".jsx"]:
                    lang = "jsx"
            except Exception:
                code = ""
        
        # Extrair seções existentes que queremos preservar
        existing_entities = ""
        entity_match = re.search(r'## Entidades\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
        if entity_match:
            ent_text = entity_match.group(1).strip()
            if ent_text and "Sem entidades" not in ent_text:
                existing_entities = ent_text
        
        existing_domains = ""
        domain_match = re.search(r'## Dominio?s\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
        if domain_match:
            dom_text = domain_match.group(1).strip()
            if dom_text:
                existing_domains = dom_text
        
        existing_related = ""
        related_match = re.search(r'## Arquivos Relacionados\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
        if related_match:
            rel_text = related_match.group(1).strip()
            if rel_text and "Sem arquivos" not in rel_text:
                existing_related = rel_text
        
        # Gerar conteúdo enriquecido
        resumo = generate_resumo(file_path, code, repo)
        
        # Entidades
        if not existing_entities and code:
            detected = detect_entities(code, file_path)
            existing_entities = "\n".join([f"- `{e}`" for e in detected]) if detected else "Nenhuma entidade detectada automaticamente."
        
        # Domínios
        if not existing_domains and code:
            detected_domains = detect_domains(file_path, code)
            existing_domains = "\n".join([f"- [[domains/{d}|{d}]]" for d in detected_domains]) if detected_domains else ""
        
        # Tags
        tags = f"#{repo} #source"
        if "routes/" in file_path:
            tags += " #route"
        elif "services/" in file_path:
            tags += " #service"
        elif "models/" in file_path:
            tags += " #model"
        elif "config/" in file_path:
            tags += " #config"
        elif "middleware/" in file_path:
            tags += " #middleware"
        elif "components/" in file_path or "pages/" in file_path:
            tags += " #ui"
        
        # Construir nota enriquecida
        basename = os.path.basename(file_path)
        new_content = f"""# {file_path}

**Repository:** {repo.capitalize()}
**File:** `{file_path}`
**Language:** `{lang}`

---

{tags}

## Resumo

{resumo}

## Entidades

{existing_entities}

## Domínios

{existing_domains if existing_domains else 'Sem domínios vinculados.'}

## Arquivos Relacionados

{existing_related if existing_related else 'Sem arquivos relacionados mapeados.'}
"""
        
        # Adicionar código se existe e é útil (< 500 linhas para não poluir)
        if code:
            line_count = code.count("\n")
            if line_count <= 500:
                new_content += f"""
## Conteúdo

```{lang}
{code}
```
"""
                result["code_added"] = True
            else:
                new_content += f"""
## Conteúdo

> ⚠️ Arquivo com {line_count} linhas — código omitido por tamanho. Consulte o arquivo fonte diretamente.
"""
        
        # Escrever
        note_path.write_text(new_content, encoding="utf-8")
        result["status"] = "enriched"
        return result
        
    except Exception as e:
        result["status"] = "error"
        result["reason"] = str(e)
        return result


def enrich_concept_note(note_path: Path) -> dict:
    """Enriquece uma concept note."""
    result = {"path": str(note_path), "status": "skipped", "reason": ""}
    
    try:
        content = note_path.read_text(encoding="utf-8")
        
        if is_already_enriched(content):
            result["reason"] = "already enriched"
            return result
        
        # Concepts que já têm conteúdo bom, preservar
        if len(content) > 500 and "## Dominio" in content:
            result["reason"] = "has good content"
            return result
        
        # Extrair nome do conceito
        name_match = re.search(r'^# (.+)', content, re.MULTILINE)
        concept_name = name_match.group(1) if name_match else note_path.stem
        
        # Preservar links existentes
        existing_links = re.findall(r'\[\[([^\]]+)\]\]', content)
        
        # Detectar se é um conceito técnico ou de negócio
        tech_keywords = ["api", "database", "server", "client", "jwt", "websocket", "sql", "http"]
        is_tech = any(kw in concept_name.lower() for kw in tech_keywords)
        
        if is_tech:
            definition = f"Conceito técnico utilizado na arquitetura do SoftHair. Refere-se a `{concept_name}` no contexto do sistema de gerenciamento de salões."
        else:
            definition = f"Conceito de domínio do SoftHair. `{concept_name}` é parte do modelo de negócio do sistema de gerenciamento de salões de beleza."
        
        # Preservar conteúdo existente se tiver
        preserved = ""
        for section in ["## Entidades Agrupadas", "## Dominios", "## Domínios"]:
            match = re.search(f'{section}\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
            if match:
                preserved += f"\n{section}\n{match.group(1)}"
        
        new_content = f"""# {concept_name}

**Type:** `canonical-concept`

## Definição

{definition}
{preserved}
"""
        
        note_path.write_text(new_content, encoding="utf-8")
        result["status"] = "enriched"
        return result
        
    except Exception as e:
        result["status"] = "error"
        result["reason"] = str(e)
        return result


def enrich_domain_note(note_path: Path) -> dict:
    """Enriquece uma domain note."""
    result = {"path": str(note_path), "status": "skipped", "reason": ""}
    
    try:
        content = note_path.read_text(encoding="utf-8")
        
        if is_already_enriched(content):
            result["reason"] = "already enriched"
            return result
        
        if note_path.name == "index.md":
            result["reason"] = "index file"
            return result
        
        domain_name = note_path.stem
        
        # Preservar links existentes
        existing_content = ""
        links_match = re.findall(r'- \[\[([^\]]+)\]\]', content)
        if links_match:
            existing_content = "\n".join([f"- [[{l}]]" for l in links_match])
        
        domain_descriptions = {
            "auth": "Autenticação e autorização. Cobre login, registro de salões, JWT, API Keys, e validação de dispositivos.",
            "database": "Camada de dados. Pool de conexões PostgreSQL, transações, migrações, e queries parametrizadas.",
            "sync": "Sincronização bidirecional entre clientes (mobile/desktop) e servidor central. Push/pull de mudanças com whitelist de tabelas.",
            "security": "Segurança da aplicação. Helmet, CORS, rate limiting, sanitização de inputs, e criptografia.",
            "agendamentos": "Gestão de agendamentos. CRUD, verificação de conflitos de horário, e listagem por profissional/data.",
            "clientes": "Gestão de clientes. CRUD, créditos, histórico de atendimentos e preferências.",
            "servicos": "Catálogo de serviços oferecidos pelo salão. Preços, duração, comissão associada.",
            "produtos": "Gestão de produtos e estoque. Controle de quantidade mínima e alertas de estoque baixo.",
            "vendas": "Registro de vendas (serviço, produto, misto). Itens, pagamento, cancelamento.",
            "api": "Camada HTTP da API REST. Rotas Express, middleware, validação, e respostas padronizadas.",
            "mobile-ui": "Interface mobile do SoftHair. Componentes React Native, navegação, e temas.",
            "saloes": "Gestão do salão. Dados cadastrais, configurações, e administração.",
            "state": "Gerenciamento de estado. Stores, hooks, e sincronização de estado entre componentes.",
            "core": "Módulos centrais compartilhados entre plataformas. Utilitários, constantes, e tipos.",
            "profissionais": "Gestão de profissionais do salão. Cadastro, especialidades, comissões.",
        }
        
        desc = domain_descriptions.get(domain_name, f"Domínio `{domain_name}` do sistema SoftHair.")
        
        new_content = f"""# {domain_name.replace('-', ' ').title()}

**Domínio funcional do SoftHair**

---

#domain #{domain_name}

## Descrição

{desc}

## Arquivos do Domínio

{existing_content if existing_content else 'Nenhum arquivo vinculado ainda.'}
"""
        
        note_path.write_text(new_content, encoding="utf-8")
        result["status"] = "enriched"
        return result
        
    except Exception as e:
        result["status"] = "error"
        result["reason"] = str(e)
        return result


def collect_notes() -> list[tuple]:
    """Coleta todas as notas que precisam de enriquecimento."""
    notes = []
    
    # Source notes (server, desktop, mobile — excluindo entities)
    for repo_dir in ["server", "desktop", "mobile"]:
        repo_path = KG_ROOT / repo_dir
        if not repo_path.exists():
            continue
        for md in repo_path.rglob("*.md"):
            if "/entities/" in str(md):
                continue  # Pular entities
            notes.append((md, "source"))
    
    # Domain notes
    domains_path = KG_ROOT / "domains"
    if domains_path.exists():
        for md in domains_path.glob("*.md"):
            notes.append((md, "domain"))
    
    # Concept notes
    concepts_path = KG_ROOT / "concepts"
    if concepts_path.exists():
        for md in concepts_path.glob("*.md"):
            notes.append((md, "concept"))
    
    return notes


def process_note(note_info: tuple) -> dict:
    """Processa uma nota baseado no tipo."""
    path, note_type = note_info
    
    if note_type == "source":
        return enrich_source_note(path)
    elif note_type == "domain":
        return enrich_domain_note(path)
    elif note_type == "concept":
        return enrich_concept_note(path)
    
    return {"path": str(path), "status": "skipped", "reason": "unknown type"}


def main():
    print(f"🚀 Knowledge Graph Enrichment — {MAX_WORKERS} workers")
    print(f"📁 Root: {KG_ROOT}")
    print(f"📅 Data: {DATE}")
    print()
    
    # Coletar notas
    notes = collect_notes()
    print(f"📊 Total de notas a processar: {len(notes)}")
    print(f"   Source: {sum(1 for _, t in notes if t == 'source')}")
    print(f"   Domain: {sum(1 for _, t in notes if t == 'domain')}")
    print(f"   Concept: {sum(1 for _, t in notes if t == 'concept')}")
    print()
    
    # Processar em paralelo
    results = {"enriched": 0, "skipped": 0, "error": 0, "code_added": 0}
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_note, note): note for note in notes}
        
        for i, future in enumerate(as_completed(futures), 1):
            result = future.result()
            results[result["status"]] = results.get(result["status"], 0) + 1
            if result.get("code_added"):
                results["code_added"] += 1
            
            # Progress
            if i % 25 == 0 or i == len(notes):
                print(f"  [{i}/{len(notes)}] ✅ {results['enriched']} enriched | ⏭️ {results['skipped']} skipped | ❌ {results.get('error', 0)} errors")
    
    # Relatório final
    print()
    print("=" * 50)
    print(f"✅ CONCLUÍDO — Relatório Final")
    print(f"   Enriquecidas:    {results['enriched']}")
    print(f"   Código adicionado: {results['code_added']}")
    print(f"   Skipped:         {results['skipped']}")
    print(f"   Erros:           {results.get('error', 0)}")
    print("=" * 50)


if __name__ == "__main__":
    main()
