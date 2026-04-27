import argparse
import asyncio
import hashlib
import json
import re
import networkx as nx
from pathlib import Path
from . import config
from .index import collect_files_for_repo, _wrap
from rich.console import Console


SKIP_ENTITIES = {
    "100m Sprint Record",
    "Energy Sector",
    "Federal Reserve Policy Announcement",
    "Financial Experts",
    "Global Tech Index",
    "Gold Futures",
    "Market Selloff",
    "Nexon Technologies",
    "Omega Energy",
    "Software Development",
    "World Athletics Championship",
    "World Athletics Federation",
}


DOMAIN_RULES = {
    "auth": ["auth", "login", "senha", "token", "jwt", "apikey", "api key", "device", "fingerprint", "admin"],
    "agendamentos": ["agendamento", "agenda", "horario", "atendimento", "ponto"],
    "clientes": ["cliente", "cpf", "telefone", "email"],
    "profissionais": ["profissional", "barbeiro", "comissao"],
    "servicos": ["servico", "serviço", "categoria", "duracao", "duração"],
    "produtos": ["produto", "estoque", "quantidade", "marca"],
    "vendas": ["venda", "pagamento", "credito", "crédito", "fechamento"],
    "saloes": ["salao", "salão", "loja"],
    "sync": ["sync", "websocket", "offline", "localstorage"],
    "database": ["database", "db", "pool", "query", "postgres", "migration", "schema", "table"],
    "security": ["security", "seguranca", "segurança", "middleware", "validate", "permission", "permissao"],
    "api": ["api", "route", "router", "endpoint", "request", "response", "express", "server"],
    "mobile-ui": ["tsx", "screen", "tab", "component", "button", "modal", "view", "ionicons"],
    "state": ["store", "zustand", "context", "state", "hook"],
}


GENERIC_ENTITY_NAMES = {
    "id", "req", "res", "error", "message", "success", "results", "table",
    "created_at", "updated_at", "data_atualizacao", "data_cadastro", "ativo",
    "nome", "descricao", "email", "telefone", "status", "tipo",
}


def slugify(text: str) -> str:
    text = str(text).strip().lower()
    text = re.sub(r"[/\\]", "-", text)
    text = re.sub(r"[^a-z0-9\s_-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-_")
    return text[:180] if text else "unknown"


def canonical_entity_name(entity_name: str) -> str:
    text = str(entity_name).strip()
    text = re.sub(r"\.(js|jsx|ts|tsx|md|json)$", "", text, flags=re.I)
    text = re.sub(r"^src[-/]", "", text, flags=re.I)
    text = re.sub(r"[-_/]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or str(entity_name).strip()


def should_skip_entity(entity_id: str, canonical: str) -> bool:
    slug = slugify(canonical)
    # P0: filtrar genéricos
    if canonical.lower() in GENERIC_ENTITY_NAMES:
        return True
    if slug.startswith("field-"):
        return True
    # P3: filtrar hashes/UUIDs e slugs muito curtos
    if len(slug) < 3:
        return True
    if re.fullmatch(r"[0-9a-f]{6,}", slug):
        return True
    return False


def classify_domains(*parts: str) -> list[str]:
    text = " ".join(str(p) for p in parts if p).lower()
    domains = []
    for domain, needles in DOMAIN_RULES.items():
        if any(needle in text for needle in needles):
            domains.append(domain)
    return domains or ["core"]


def classify_entity_kind(entity_name: str, file_path: str = "") -> str:
    name = str(entity_name).strip()
    low = name.lower()
    path = str(file_path).lower()
    if "/" in name or low.endswith((".js", ".ts", ".tsx", ".jsx", ".md")):
        return "file-node"
    if low in GENERIC_ENTITY_NAMES:
        return "generic"
    if path.startswith("src/routes/") or "route" in low or "router" in low:
        return "api"
    if path.startswith("src/models/") or low[:1].isupper():
        return "model"
    if path.startswith("src/services/") or "service" in low:
        return "service"
    if path.startswith("src/config/") or "database" in low or "query" in low:
        return "data"
    if low in {"express", "jsonwebtoken", "bcrypt", "axios", "react", "expo", "ionicons"}:
        return "library"
    return "concept"


def load_full_docs():
    docs_file = config.STORAGE_DIR / "kv_store_full_docs.json"
    if not docs_file.exists():
        raise FileNotFoundError(f"Docs not found: {docs_file}")
    return json.loads(docs_file.read_text())


def load_entities():
    storage_dir = config.STORAGE_DIR
    graph_file = storage_dir / "graph_chunk_entity_relation.graphml"
    if not graph_file.exists():
        return {}, []
    g = nx.read_graphml(str(graph_file))
    entities = {n: dict(g.nodes[n]) for n in g.nodes() if n not in SKIP_ENTITIES}
    relations = [(src, dst) for src, dst in g.edges() if src not in SKIP_ENTITIES and dst not in SKIP_ENTITIES]
    return entities, relations


def parse_doc(content: str) -> dict:
    meta = {"repo": "Desktop", "file": "unknown", "lang": "text", "body": content}
    lines = content.splitlines()
    body_start = 0

    for i, line in enumerate(lines[:5]):
        if line.startswith("REPO:"):
            meta["repo"] = line.replace("REPO:", "").strip().strip("[]")
        elif line.startswith("FILE:"):
            meta["file"] = line.replace("FILE:", "").strip()
        elif line.startswith("LANG:"):
            meta["lang"] = line.replace("LANG:", "").strip() or "text"
        elif line.strip() == "---":
            body_start = i + 1
            break

    meta["body"] = "\n".join(lines[body_start:]).strip()
    if meta["file"] == "unknown" and any(line.startswith("GIT COMMIT:") for line in lines[:8]):
        meta["file"] = "git-history"
    return meta


def classify_entity(entity_data: dict) -> str:
    text = " ".join(str(v) for v in entity_data.values()).lower()
    if "[mobile]" in text or "softhair-mobile" in text:
        return "mobile"
    if "[server]" in text or "soft-hair-server" in text:
        return "server"
    return "desktop"


def folder_for_doc(repo: str, fname: str) -> tuple[str, str]:
    repo_key = repo.lower()
    if repo_key == "mobile":
        if fname.startswith("app/"):
            return "mobile", "app"
        if fname.startswith("components/"):
            return "mobile", "components"
        if fname.startswith("hooks/"):
            return "mobile", "hooks"
        if fname.startswith("store/") or fname.startswith("stores/"):
            return "mobile", "store"
        if fname.startswith("services/"):
            return "mobile", "services"
        return "mobile", "root"

    if repo_key == "server":
        if fname.startswith("src/routes/"):
            return "server", "routes"
        if fname.startswith("src/models/"):
            return "server", "models"
        if fname.startswith("src/services/"):
            return "server", "services"
        if fname.startswith("src/config/"):
            return "server", "config"
        return "server", "root"

    if fname.startswith("backend/"):
        return "desktop", "backend"
    if fname.startswith("frontend/"):
        return "desktop", "frontend"
    if "config" in fname:
        return "desktop", "config"
    return "desktop", "root"


def doc_note_link(repo: str, fname: str) -> str:
    repo_dir, folder = folder_for_doc(repo, fname)
    return f"[[{repo_dir}/{folder}/{slugify(fname)}|{fname}]]"


def write_doc_note(
    path: Path,
    repo: str,
    fname: str,
    lang: str,
    body: str,
    entity_links: list[str] | None = None,
    related_doc_links: list[str] | None = None,
    domain_links: list[str] | None = None,
):
    tag = repo.lower()
    title = fname
    content = body.strip()
    is_empty = len(content) == 0
    entity_links = entity_links or []
    related_doc_links = related_doc_links or []
    domain_links = domain_links or []

    summary = f"Arquivo `{fname}` do repositório {repo}."
    if is_empty:
        summary = f"Arquivo `{fname}` do repositório {repo} sem conteúdo textual indexável."

    explanation = "Documento exportado automaticamente do LightRAG para consulta no Obsidian."
    if is_empty:
        explanation = "O arquivo original está vazio ou sem texto útil para extração."

    note = [
        f"# {title}",
        "",
        f"**Repository:** {repo}",
        f"**File:** `{fname}`",
        f"**Language:** `{lang}`",
        "",
        "---",
        "",
        f"#{tag} #source",
        "",
        "## Resumo",
        "",
        summary,
        "",
        "## Explicacao",
        "",
        explanation,
        "",
        "## Entidades",
        "",
    ]
    if domain_links:
        note.extend(["## Dominios", ""])
        note.extend(domain_links)
        note.extend([""])
    note.extend(entity_links[:40] if entity_links else ["Sem entidades vinculadas ainda."])
    note.extend([
        "",
        "## Arquivos Relacionados",
        "",
    ])
    note.extend(related_doc_links[:20] if related_doc_links else ["Sem arquivos relacionados ainda."])
    note.extend([
        "",
        "## Conteudo",
        "",
        f"```{lang if lang != 'text' else ''}",
        content if not is_empty else "# arquivo vazio",
        "```",
        "",
    ])
    path.write_text("\n".join(note), encoding="utf-8")


def write_folder_index(folder: Path, title: str):
    files = sorted(p for p in folder.glob("*.md") if p.name != "index.md")
    lines = [f"# {title}", ""]
    for f in files:
        rel = f.relative_to(config.VAULT_PATH).with_suffix("")
        lines.append(f"- [[{rel}|{f.stem}]]")
    lines.append("")
    (folder / "index.md").write_text("\n".join(lines), encoding="utf-8")


def write_entity_index(folder: Path, title: str):
    files = sorted(p for p in folder.glob("*.md") if p.name != "index.md")
    lines = [f"# {title}", "", f"**Count:** `{len(files)}`", ""]
    for f in files[:500]:
        rel = f.relative_to(config.VAULT_PATH).with_suffix("")
        lines.append(f"- [[{rel}|{f.stem}]]")
    if len(files) > 500:
        lines.append(f"- ... {len(files) - 500} entidades adicionais nesta pasta")
    lines.append("")
    (folder / "index.md").write_text("\n".join(lines), encoding="utf-8")


def write_domain_note(path: Path, domain: str, doc_links: list[str], concept_links: list[str], entity_links: list[str]):
    lines = [
        f"# {domain}",
        "",
        "**Type:** `operational-domain`",
        "",
        "## Uso Para IA",
        "",
        "Use este hub para localizar os arquivos e conceitos mais relevantes sem abrir o vault inteiro.",
        "",
        "## Conceitos Principais",
        "",
    ]
    lines.extend(concept_links[:20] if concept_links else ["Sem conceitos associados."])
    lines.extend([
        "",
        "## Arquivos Principais",
        "",
    ])
    lines.extend(doc_links[:20] if doc_links else ["Sem arquivos associados."])
    lines.extend([
        "",
        "## Entidades Relevantes",
        "",
    ])
    lines.extend(entity_links[:30] if entity_links else ["Sem entidades associadas."])
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_concept_note(path: Path, concept: str, domains: list[str], entity_links: list[str], doc_links: list[str]):
    lines = [
        f"# {concept}",
        "",
        "**Type:** `canonical-concept`",
        "",
        "## Dominios",
        "",
    ]
    lines.extend(domains if domains else ["Sem dominio classificado."])
    lines.extend([
        "",
        "## Entidades Agrupadas",
        "",
    ])
    lines.extend(entity_links[:40] if entity_links else ["Sem entidades associadas."])
    lines.extend([
        "",
        "## Arquivos De Entrada",
        "",
    ])
    lines.extend(doc_links[:25] if doc_links else ["Sem arquivos associados."])
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_ai_context(path: Path, counts: dict[str, int], domain_links: list[str], entry_links: list[str]):
    lines = [
        "# AI-CONTEXT",
        "",
        "Este arquivo e o ponto de entrada economico para IA navegar no mapa operacional.",
        "",
        "## Regra De Uso",
        "",
        "1. Abra primeiro um dominio.",
        "2. Use conceitos canonicos para entender nomes equivalentes.",
        "3. Abra arquivos-fonte apenas quando precisar de implementacao.",
        "",
        "## Contagem",
        "",
    ]
    for key in sorted(counts):
        lines.append(f"- **{key}:** {counts[key]}")
    lines.extend([
        "",
        "## Dominios Operacionais",
        "",
    ])
    lines.extend(domain_links)
    lines.extend([
        "",
        "## Entradas Importantes",
        "",
    ])
    lines.extend(entry_links[:30])
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_entity_note(
    path: Path,
    repo: str,
    entity_name: str,
    file_path: str,
    source_link: str = "",
    connected_entities: list[str] | None = None,
    related_docs: list[str] | None = None,
    concept_link: str = "",
    domain_links: list[str] | None = None,
    kind: str = "concept",
):
    repo_tag = repo.lower()
    connected_entities = connected_entities or []
    related_docs = related_docs or []
    domain_links = domain_links or []

    lines = [
        f"# {entity_name}",
        "",
        f"**Repository:** {repo}",
        f"**Entity:** `{entity_name}`",
        f"**Kind:** `{kind}`",
        f"**Source File:** `{file_path or 'n/a'}`",
        "",
        "---",
        "",
        f"#{repo_tag} #entity",
        "",
        "## Resumo",
        "",
        f"Entidade `{entity_name}` extraida do contexto {repo}.",
        "",
        "## Explicacao",
        "",
        "Representa um conceito identificado no codigo/documentacao indexado pelo LightRAG.",
        "",
        "## Referencia",
        "",
        source_link if source_link else "Sem arquivo de origem associado.",
        "",
        "## Conceito Canonico",
        "",
        concept_link if concept_link else "Sem conceito canonico associado.",
        "",
        "## Dominios",
        "",
    ]
    lines.extend(domain_links if domain_links else ["Sem dominio classificado."])
    lines.extend([
        "",
        "## Entidades Conectadas",
        "",
    ])
    lines.extend(connected_entities[:30] if connected_entities else ["Sem entidades conectadas ainda."])
    lines.extend([
        "",
        "## Arquivos Relacionados",
        "",
    ])
    lines.extend(related_docs[:20] if related_docs else ["Sem arquivos relacionados ainda."])
    lines.extend([
        "",
    ])
    path.write_text("\n".join(lines), encoding="utf-8")


def unique_entity_note_path(folder: Path, entity_name: str, file_path: str) -> Path:
    base = slugify(entity_name)
    fingerprint = hashlib.sha1(f"{entity_name}|{file_path}".encode("utf-8")).hexdigest()[:8]
    return folder / f"{base}-{fingerprint}.md"


def build_index(docs: dict, entities: dict, relations: list, vault: Path):
    console = Console()
    console.print("[cyan]Reorganizing knowledge graph...[/cyan]")
    
    desktop_files = []
    mobile_files = []
    server_files = []
    
    parsed_docs = {}
    for doc_id, doc in docs.items():
        parsed = parse_doc(doc.get("content", ""))
        repo = parsed["repo"].lower()
        fname = parsed["file"]

        if repo == "mobile":
            mobile_files.append((doc_id, fname))
        elif repo == "server":
            server_files.append((doc_id, fname))
        else:
            desktop_files.append((doc_id, fname))

        parsed_docs[doc_id] = parsed

    existing = {(doc["repo"].lower(), doc["file"]) for doc in parsed_docs.values()}
    for repo in config.REPOS:
        repo_name = repo["label"].strip("[]")
        for source_path, rel, doc_id, _label in collect_files_for_repo(repo):
            key = (repo_name.lower(), rel)
            if key in existing:
                continue
            try:
                source_content = source_path.read_text(errors="replace")
            except OSError:
                continue
            parsed = parse_doc(_wrap(repo["label"], rel, source_content))
            synthetic_id = f"source-{repo['name']}-{slugify(rel)}"
            parsed_docs[synthetic_id] = parsed
            existing.add(key)
            repo_key = repo_name.lower()
            if repo_key == "mobile":
                mobile_files.append((synthetic_id, rel))
            elif repo_key == "server":
                server_files.append((synthetic_id, rel))
            else:
                desktop_files.append((synthetic_id, rel))
    
    desktop_entities = []
    mobile_entities = []
    server_entities = []
    entity_records = []
    
    # P1: deduplicate por canonical slug para evitar notas duplicadas
    seen_canonical_slugs: set[str] = set()

    for entity_id, entity_data in entities.items():
        entity_id_str = str(entity_id)
        if entity_id_str.lower() == "unknown" or not slugify(entity_id_str) or slugify(entity_id_str) == "unknown":
            continue
        file_path = str(entity_data.get("d4", ""))

        repo = classify_entity(entity_data)
        canonical_name = canonical_entity_name(entity_id_str)

        # P0/P3: filtrar genéricos, hashes e slugs inúteis
        if should_skip_entity(entity_id_str, canonical_name):
            continue

        record = {
            "entity_id": entity_id_str,
            "file_path": file_path,
            "repo": repo,
            "canonical": canonical_name,
            "kind": classify_entity_kind(entity_id_str, file_path),
            "domains": classify_domains(entity_id_str, file_path, " ".join(str(v) for v in entity_data.values())),
        }
        entity_records.append(record)
        if repo == "mobile":
            mobile_entities.append((entity_id_str, file_path))
        elif repo == "server":
            server_entities.append((entity_id_str, file_path))
        else:
            desktop_entities.append((entity_id_str, file_path))
    
    vault.mkdir(parents=True, exist_ok=True)

    for repo_dir in ("desktop", "mobile", "server"):
        stale_unknown_doc = vault / repo_dir / "root" / "unknown.md"
        if stale_unknown_doc.exists():
            stale_unknown_doc.unlink()
    
    # Desktop structure - simple, organized
    desktop_folders = ["backend", "frontend", "config", "root"]
    for f in desktop_folders:
        (vault / "desktop" / f).mkdir(parents=True, exist_ok=True)
    
    mobile_folders = ["app", "components", "hooks", "services", "store", "root"]
    for f in mobile_folders:
        (vault / "mobile" / f).mkdir(parents=True, exist_ok=True)
    
    server_folders = ["routes", "models", "services", "config", "root"]
    for f in server_folders:
        (vault / "server" / f).mkdir(parents=True, exist_ok=True)

    domains_dir = vault / "domains"
    concepts_dir = vault / "concepts"
    domains_dir.mkdir(parents=True, exist_ok=True)
    concepts_dir.mkdir(parents=True, exist_ok=True)
    for semantic_dir in (domains_dir, concepts_dir):
        for stale_file in semantic_dir.glob("*.md"):
            stale_file.unlink()
    
    # Entities ficam dentro da pasta do projeto: desktop/entities/, mobile/entities/, server/entities/
    desktop_ents_dir = vault / "desktop" / "entities"
    mobile_ents_dir  = vault / "mobile"  / "entities"
    server_ents_dir  = vault / "server"  / "entities"

    for d in (desktop_ents_dir, mobile_ents_dir, server_ents_dir):
        d.mkdir(parents=True, exist_ok=True)

    # Limpar pastas entities_* antigas (estrutura anterior)
    for old_dir in (vault / "entities_desktop", vault / "entities_mobile", vault / "entities_server"):
        if old_dir.exists():
            for f in old_dir.glob("*.md"):
                f.unlink()
            try:
                old_dir.rmdir()
            except OSError:
                pass

    for ents_dir in (desktop_ents_dir, mobile_ents_dir, server_ents_dir):
        for stale_file in ents_dir.glob("*.md"):
            stale_file.unlink()
        for entity in [*SKIP_ENTITIES, "unknown"]:
            stale_file = ents_dir / f"{slugify(entity)}.md"
            if stale_file.exists():
                stale_file.unlink()

    entity_note_refs = {}
    concept_note_refs = {}
    doc_entities: dict[tuple[str, str], list[str]] = {}
    entity_record_map = {record["entity_id"]: record for record in entity_records}

    # Pré-computar quais entidades terão notas (P2: só as que têm source_path)
    # Precisamos de known_docs para source_path_for_entity, mas ela só depende de entity_record_map
    # Usamos file_path direto aqui; a resolução completa acontece depois de known_docs estar pronto
    writeable_entity_ids: set[str] = set()
    for record in entity_records:
        if record["file_path"]:  # tem source direta — certamente será escrita
            writeable_entity_ids.add(record["entity_id"])
        # Entidades sem file_path serão decididas após known_docs (adicionadas depois)

    for record in entity_records:
        folder = {
            "desktop": desktop_ents_dir,
            "mobile": mobile_ents_dir,
            "server": server_ents_dir,
        }[record["repo"]]
        note_path = unique_entity_note_path(folder, record["entity_id"], record["file_path"])
        entity_note_refs[record["entity_id"]] = note_path
        concept_note_refs[record["canonical"]] = concepts_dir / f"{slugify(record['canonical'])}.md"
        if record["file_path"]:
            doc_entities.setdefault((record["repo"], record["file_path"]), []).append(record["entity_id"])

    known_docs = {(parsed["repo"].lower(), parsed["file"]) for parsed in parsed_docs.values()}

    # Construir grafo de vizinhos (todos os entity_note_refs, antes de filtrar)
    entity_neighbors_all: dict[str, set[str]] = {}
    for src, dst in relations:
        src = str(src)
        dst = str(dst)
        if src == dst:
            continue
        if src in entity_note_refs and dst in entity_note_refs:
            entity_neighbors_all.setdefault(src, set()).add(dst)
            entity_neighbors_all.setdefault(dst, set()).add(src)

    # P2 relaxado: manter entidades com source_path OU com conexões no grafo
    def _is_writeable(record: dict) -> bool:
        eid = record["entity_id"]
        if record["file_path"]:
            return True
        if (record["repo"], eid) in known_docs:
            return True
        # entidade sem source mas com vizinhos = é um conceito real do domínio
        if len(entity_neighbors_all.get(eid, set())) >= 2:
            return True
        return False

    writeable_entity_ids = {r["entity_id"] for r in entity_records if _is_writeable(r)}
    for eid in list(entity_note_refs.keys()):
        if eid not in writeable_entity_ids:
            del entity_note_refs[eid]

    entity_neighbors: dict[str, set[str]] = {}
    for src, dst in relations:
        src = str(src)
        dst = str(dst)
        if src not in entity_note_refs or dst not in entity_note_refs or src == dst:
            continue
        entity_neighbors.setdefault(src, set()).add(dst)
        entity_neighbors.setdefault(dst, set()).add(src)

    def entity_link(entity_id: str) -> str | None:
        note_path = entity_note_refs.get(entity_id)
        if not note_path:
            return None
        rel = note_path.relative_to(vault).with_suffix("")
        return f"- [[{rel}|{entity_id}]]"

    def entity_links_for(entity_ids) -> list[str]:
        return [lnk for eid in entity_ids if (lnk := entity_link(eid))]

    def domain_link(domain: str) -> str:
        return f"- [[domains/{slugify(domain)}|{domain}]]"

    def concept_link_for(canonical_name: str) -> str:
        # writeable_concepts definido depois — usar closure; retorna vazio se não escrito
        return f"[[concepts/{slugify(canonical_name)}|{canonical_name}]]"

    def safe_concept_link(canonical_name: str) -> str:
        """Só retorna link se a concept note será escrita."""
        if canonical_name in _writeable_concepts_ref:
            return concept_link_for(canonical_name)
        return ""

    _writeable_concepts_ref: set[str] = set()  # preenchido após writeable_concepts ser calculado

    def doc_backed_entities(repo_key: str, fname: str) -> list[str]:
        linked = set(doc_entities.get((repo_key, fname), []))
        if entity_note_refs.get(fname) and (repo_key, fname) in known_docs:
            for neighbor in entity_neighbors.get(fname, set()):
                if (repo_key, neighbor) in known_docs:
                    continue
                linked.add(neighbor)
        return sorted(linked)

    def related_doc_links_for_entities(entity_ids: list[str], current_file: str) -> list[str]:
        links = []
        seen = set()
        for entity_id in entity_ids:
            for neighbor in sorted(entity_neighbors.get(entity_id, set())):
                record = entity_record_map.get(neighbor, {})
                neighbor_file = record.get("file_path", "")
                neighbor_repo = record.get("repo", "")
                if not neighbor_file and neighbor_repo and (neighbor_repo, neighbor) in known_docs:
                    neighbor_file = neighbor
                if not neighbor_file or neighbor_file == current_file:
                    continue
                key = (neighbor_repo, neighbor_file)
                if key in seen:
                    continue
                seen.add(key)
                links.append(
                    f"- {doc_note_link(neighbor_repo.capitalize() if neighbor_repo != 'desktop' else 'Desktop', neighbor_file)}"
                )
        return links

    def source_path_for_entity(entity_id: str, file_path: str = "") -> str:
        record = entity_record_map.get(entity_id, {})
        repo_key = record.get("repo", "")
        source_path = file_path or record.get("file_path", "")
        if not source_path and repo_key and (repo_key, entity_id) in known_docs:
            source_path = entity_id
        if not source_path and repo_key:
            for neighbor in sorted(entity_neighbors.get(entity_id, set())):
                if (repo_key, neighbor) in known_docs:
                    source_path = neighbor
                    break
        return source_path

    # Write desktop files
    for doc_id, fname in desktop_files:
        parsed = parsed_docs[doc_id]
        repo_key = parsed["repo"].lower()
        doc_entity_ids = doc_backed_entities(repo_key, fname)
        doc_domains = classify_domains(fname, parsed["body"])
        _, folder = folder_for_doc(parsed["repo"], fname)
        write_doc_note(
            vault / "desktop" / folder / f"{slugify(fname)}.md",
            parsed["repo"],
            fname,
            parsed["lang"],
            parsed["body"],
            entity_links_for(doc_entity_ids),
            related_doc_links_for_entities(doc_entity_ids, fname),
            [domain_link(domain) for domain in doc_domains],
        )

    # Write mobile files
    for doc_id, fname in mobile_files:
        parsed = parsed_docs[doc_id]
        repo_key = parsed["repo"].lower()
        doc_entity_ids = doc_backed_entities(repo_key, fname)
        doc_domains = classify_domains(fname, parsed["body"])
        _, folder = folder_for_doc(parsed["repo"], fname)
        write_doc_note(
            vault / "mobile" / folder / f"{slugify(fname)}.md",
            parsed["repo"],
            fname,
            parsed["lang"],
            parsed["body"],
            entity_links_for(doc_entity_ids),
            related_doc_links_for_entities(doc_entity_ids, fname),
            [domain_link(domain) for domain in doc_domains],
        )

    # Write server files
    for doc_id, fname in server_files:
        parsed = parsed_docs[doc_id]
        repo_key = parsed["repo"].lower()
        doc_entity_ids = doc_backed_entities(repo_key, fname)
        doc_domains = classify_domains(fname, parsed["body"])
        _, folder = folder_for_doc(parsed["repo"], fname)
        write_doc_note(
            vault / "server" / folder / f"{slugify(fname)}.md",
            parsed["repo"],
            fname,
            parsed["lang"],
            parsed["body"],
            entity_links_for(doc_entity_ids),
            related_doc_links_for_entities(doc_entity_ids, fname),
            [domain_link(domain) for domain in doc_domains],
        )

    for folder in desktop_folders:
        write_folder_index(vault / "desktop" / folder, f"Desktop {folder}")
    for folder in mobile_folders:
        write_folder_index(vault / "mobile" / folder, f"Mobile {folder}")
    for folder in server_folders:
        write_folder_index(vault / "server" / folder, f"Server {folder}")
    
    # Entity writes adiados — executados após writeable_concepts ser definido
    _deferred_entity_writes: list[tuple[str, str, str]] = (
        [(eid, fp, "Desktop") for eid, fp in desktop_entities] +
        [(eid, fp, "Mobile")  for eid, fp in mobile_entities] +
        [(eid, fp, "Server")  for eid, fp in server_entities]
    )

    domain_docs: dict[str, set[tuple[str, str]]] = {}
    for parsed in parsed_docs.values():
        repo_key = parsed["repo"].lower()
        fname = parsed["file"]
        for domain in classify_domains(fname, parsed["body"]):
            domain_docs.setdefault(domain, set()).add((repo_key, fname))

    domain_entities: dict[str, set[str]] = {}
    concept_entities: dict[str, set[str]] = {}
    concept_domains: dict[str, set[str]] = {}
    concept_docs: dict[str, set[tuple[str, str]]] = {}

    for record in entity_records:
        entity_id = record["entity_id"]
        canonical = record["canonical"]
        source_path = source_path_for_entity(entity_id, record["file_path"])
        concept_entities.setdefault(canonical, set()).add(entity_id)
        concept_domains.setdefault(canonical, set()).update(record["domains"])
        if source_path:
            concept_docs.setdefault(canonical, set()).add((record["repo"], source_path))
        for domain in record["domains"]:
            domain_entities.setdefault(domain, set()).add(entity_id)
            if source_path:
                domain_docs.setdefault(domain, set()).add((record["repo"], source_path))

    def doc_link_from_key(item: tuple[str, str]) -> str:
        repo_key, fname = item
        repo_label = repo_key.capitalize() if repo_key != "desktop" else "Desktop"
        return f"- {doc_note_link(repo_label, fname)}"

    def concept_bullet(canonical: str) -> str:
        return f"- {concept_link_for(canonical)}"

    def concept_score(canonical: str) -> tuple[int, int, str]:
        entity_ids = concept_entities.get(canonical, set())
        degree = sum(len(entity_neighbors.get(entity_id, set())) for entity_id in entity_ids)
        useful_kind = 0
        for entity_id in entity_ids:
            kind = entity_record_map.get(entity_id, {}).get("kind", "")
            if kind in {"model", "service", "api", "data", "concept"}:
                useful_kind += 1
        return (-degree, -useful_kind, slugify(canonical))

    def entity_score(entity_id: str) -> tuple[int, str]:
        return (-len(entity_neighbors.get(entity_id, set())), slugify(entity_id))

    # Só criar concept note se agrupa 2+ entidades reais (aliases) ou tem grau alto
    writeable_concepts: set[str] = set()
    for canonical, entity_ids in concept_entities.items():
        real_ids = [eid for eid in entity_ids if eid in entity_note_refs]
        degree = sum(len(entity_neighbors.get(eid, set())) for eid in real_ids)
        if len(real_ids) >= 2 or degree >= 4:
            writeable_concepts.add(canonical)

    # Preencher ref para que safe_concept_link funcione
    _writeable_concepts_ref.update(writeable_concepts)

    # Executar entity writes adiados — agora que writeable_concepts está definido
    for entity_id, file_path, repo_label in _deferred_entity_writes:
        if entity_id not in entity_note_refs:
            continue
        record = entity_record_map[entity_id]
        source_path = source_path_for_entity(entity_id, file_path)
        source_link = doc_note_link(repo_label, source_path) if source_path else ""
        clink = safe_concept_link(record["canonical"])
        write_entity_note(
            entity_note_refs[entity_id],
            repo_label,
            str(entity_id)[:80],
            source_path,
            source_link=source_link,
            connected_entities=entity_links_for(sorted(entity_neighbors.get(entity_id, set()))),
            related_docs=related_doc_links_for_entities([entity_id], source_path),
            concept_link=clink,
            domain_links=[domain_link(domain) for domain in record["domains"]],
            kind=record["kind"],
        )

    for canonical, entity_ids in sorted(concept_entities.items(), key=lambda item: slugify(item[0])):
        if canonical not in writeable_concepts:
            continue
        domains = sorted(concept_domains.get(canonical, set()))
        docs_for_concept = sorted(concept_docs.get(canonical, set()))
        write_concept_note(
            concept_note_refs[canonical],
            canonical,
            [domain_link(domain) for domain in domains],
            entity_links_for(sorted(entity_ids)),
            [doc_link_from_key(item) for item in docs_for_concept],
        )

    def safe_concept_bullet(canonical: str) -> str | None:
        if canonical not in writeable_concepts:
            return None
        return f"- {concept_link_for(canonical)}"

    for domain in sorted(set(DOMAIN_RULES) | set(domain_docs) | set(domain_entities)):
        concepts_for_domain = sorted(
            (canonical for canonical, domains in concept_domains.items() if domain in domains),
            key=concept_score,
        )
        entities_for_domain = sorted(
            domain_entities.get(domain, set()),
            key=entity_score,
        )
        write_domain_note(
            domains_dir / f"{slugify(domain)}.md",
            domain,
            [doc_link_from_key(item) for item in sorted(domain_docs.get(domain, set()))],
            [b for c in concepts_for_domain if (b := safe_concept_bullet(c))],
            entity_links_for(entities_for_domain),
        )

    operational_domains = sorted(set(DOMAIN_RULES) | set(domain_docs) | set(domain_entities))
    entry_docs = [
        ("server", "src/routes/auth.js"),
        ("server", "src/config/initDb.js"),
        ("server", "src/server.js"),
        ("mobile", "app/(auth)/login.tsx"),
        ("mobile", "services/api.ts"),
    ]
    existing_entry_docs = [item for item in entry_docs if item in known_docs]
    write_ai_context(
        vault / "AI-CONTEXT.md",
        {
            "docs": len(docs),
            "entities": len(entities),
            "relations": len(relations),
            "concepts": len(concept_entities),
            "domains": len(operational_domains),
        },
        [domain_link(domain) for domain in operational_domains],
        [doc_link_from_key(item) for item in existing_entry_docs],
    )
    (domains_dir / "index.md").write_text(
        "\n".join(["# Domains", "", *[domain_link(domain) for domain in operational_domains], ""]),
        encoding="utf-8",
    )
    # Só listar conceitos que têm notas escritas
    sorted_writeable = sorted(writeable_concepts, key=concept_score)
    concept_index_lines = [
        "# Concepts",
        "",
        "Indice canonico. Abra conceitos especificos a partir dos dominios para economizar contexto.",
        "",
        f"**Total:** `{len(sorted_writeable)}` conceitos canonicos (agrupam 2+ entidades ou alta conectividade).",
        "",
    ]
    for canonical in sorted_writeable[:100]:
        concept_index_lines.append(f"- {concept_link_for(canonical)}")
    if len(sorted_writeable) > 100:
        concept_index_lines.append(f"- ... {len(sorted_writeable) - 100} conceitos adicionais em `concepts/`")
    concept_index_lines.append("")
    (concepts_dir / "index.md").write_text("\n".join(concept_index_lines), encoding="utf-8")
    write_entity_index(desktop_ents_dir, "Desktop Entities")
    write_entity_index(mobile_ents_dir, "Mobile Entities")
    write_entity_index(server_ents_dir, "Server Entities")
    
    # Create main INDEX
    index_path = vault / "INDEX.md"
    lines = [
        "# 🧠 SoftHair Knowledge Graph",
        "",
        f"**📚 Docs:** {len(docs)} | **🔗 Entities:** {len(entities)} | **🔗 Relations:** {len(relations)}",
        "",
        "---",
        "",
        "## 📱 Mobile (softhair-mobile)",
        "",
        f"- [[mobile/app/index|App ({len([f for f in mobile_files if f[1].startswith('app/')])} files)]]",
        f"- [[mobile/components/index|Components ({len([f for f in mobile_files if f[1].startswith('components/')])} files)]]",
        f"- [[mobile/hooks/index|Hooks ({len([f for f in mobile_files if f[1].startswith('hooks/') or 'hook' in f[1].lower()])} files)]]",
        f"- [[mobile/store/index|Store ({len([f for f in mobile_files if f[1].startswith(('store/', 'stores/')) or 'zustand' in f[1]])} files)]]",
        f"- [[mobile/services/index|Services ({len([f for f in mobile_files if f[1].startswith('services/')])} files)]]",
        f"- [[mobile/root/index|Root ({len([f for f in mobile_files if not any(f[1].startswith(prefix) for prefix in ['app/', 'components/', 'hooks/', 'services/', 'store/', 'stores/'])])} files)]]",
        "",
        "## 🖥️ Desktop (SoftHair Backend)",
        "",
        f"- [[desktop/backend/index|Backend ({len([f for f in desktop_files if f[1].startswith('backend/')])} files)]]",
        f"- [[desktop/frontend/index|Frontend ({len([f for f in desktop_files if f[1].startswith('frontend/')])} files)]]",
        f"- [[desktop/config/index|Config ({len([f for f in desktop_files if 'config' in f[1]])} files)]]",
        f"- [[desktop/root/index|Root ({len([f for f in desktop_files if not f[1].startswith(('backend/', 'frontend/')) and 'config' not in f[1]])} files)]]",
        "",
        "## 🖥️ Server (API)",
        "",
        f"- [[server/routes/index|Routes ({len([f for f in server_files if f[1].startswith('src/routes/')])} files)]]",
        f"- [[server/models/index|Models ({len([f for f in server_files if f[1].startswith('src/models/')])} files)]]",
        f"- [[server/services/index|Services ({len([f for f in server_files if f[1].startswith('src/services/')])} files)]]",
        f"- [[server/config/index|Config ({len([f for f in server_files if f[1].startswith('src/config/')])} files)]]",
        f"- [[server/root/index|Root ({len([f for f in server_files if not f[1].startswith(('src/routes/', 'src/models/', 'src/services/', 'src/config/'))])} files)]]",
        "",
        "## 🔗 Entities",
        "",
        f"- [[desktop/entities/index|Desktop Entities ({len(desktop_entities)} entities)]]",
        f"- [[mobile/entities/index|Mobile Entities ({len(mobile_entities)} entities)]]",
        f"- [[server/entities/index|Server Entities ({len(server_entities)} entities)]]",
        "",
        "## Operational AI Map",
        "",
        "- [[AI-CONTEXT|AI-CONTEXT]]",
        f"- [[domains/index|Domains ({len(operational_domains)})]]",
        f"- [[concepts/index|Concepts ({len(concept_entities)})]]",
        "",
        "---",
        "",
        "*Generated by SoftHair LightRAG*",
    ]
    index_path.write_text("\n".join(lines), encoding="utf-8")


async def run_export(clean: bool = False):
    console = Console()
    vault = config.VAULT_PATH

    if clean and vault.exists():
        import shutil
        # Apaga apenas as pastas auto-geradas — preserva LifeOS e .obsidian
        AUTO_GENERATED = {"concepts", "desktop", "domains", "mobile", "server"}
        for d in AUTO_GENERATED:
            target = vault / d
            if target.exists():
                shutil.rmtree(target)
    
    vault.mkdir(parents=True, exist_ok=True)

    console.print("[bold cyan]🎨 Reorganizing Knowledge Graph...[/bold cyan]")

    docs = load_full_docs()
    entities, relations = load_entities()
    
    console.print(f"📚 Docs: {len(docs)}")
    console.print(f"🔗 Entities: {len(entities)}")
    console.print(f"🔗 Relations: {len(relations)}")

    build_index(docs, entities, relations, vault)

    console.print(f"\n[bold green]✅ Complete![/bold green]")
    console.print(f"📂 Vault: {vault}")


def main():
    parser = argparse.ArgumentParser(prog="kg-to-obsidian")
    parser.add_argument("--clean", action="store_true", help="Clear vault before export")
    args = parser.parse_args()
    asyncio.run(run_export(clean=args.clean))


if __name__ == "__main__":
    main()
