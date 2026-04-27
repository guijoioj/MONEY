#!/usr/bin/env python3
"""
Second pass: Replace generic LightRAG boilerplate in notes that
still have "Documento exportado automaticamente" while preserving
all existing links, entities, and code blocks.
"""

import os
import re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

KG_ROOT = Path("/home/ogejota/MONEY/SoftHair/docs/knowledge-graph")
SERVER_ROOT = Path("/home/ogejota/MONEY/SOFT-HAIR-SERVER")
DESKTOP_ROOT = Path("/home/ogejota/MONEY/SoftHair")
MOBILE_ROOT = Path("/home/ogejota/MONEY/SoftHair")
MAX_WORKERS = 15

REPO_MAP = {
    "server": SERVER_ROOT,
    "desktop": DESKTOP_ROOT,
    "mobile": MOBILE_ROOT,
}


def generate_smart_resumo(file_path: str, code: str = "") -> str:
    """Gera resumo inteligente baseado no path e código."""
    basename = os.path.basename(file_path).replace(".js", "").replace(".ts", "").replace(".tsx", "")
    
    path_lower = file_path.lower()
    
    # Routes
    if "routes/" in path_lower:
        entity = basename.replace("src-routes-", "")
        if code:
            methods = re.findall(r'router\.(get|post|put|delete|patch)', code, re.IGNORECASE)
            method_str = f" Implementa {len(methods)} endpoints ({', '.join(set(m.upper() for m in methods))})." if methods else ""
            return f"Rota Express para `/api/{entity}`.{method_str} Usa `authMiddleware` para autenticação e `express-validator` para validação de entrada."
        return f"Rota Express para o endpoint `/api/{entity}`. Implementa operações CRUD com autenticação e validação."

    # Services
    if "services/" in path_lower or "Service" in basename:
        service_name = basename.replace("Service", "").replace("service", "")
        if code:
            methods = re.findall(r'async\s+(\w+)\s*\(', code)
            method_str = f" Métodos: `{'`, `'.join(methods[:6])}`." if methods else ""
            return f"Service de lógica de negócio para **{service_name}**. Encapsula queries ao banco e regras de validação.{method_str}"
        return f"Service de lógica de negócio para **{service_name}**. Encapsula queries ao banco de dados e regras de validação."

    # Models
    if "models/" in path_lower:
        return f"Model `{basename}` que estende `BaseModel`. Define queries especializadas e métodos de domínio para a tabela correspondente no PostgreSQL."

    # Config
    if "config/" in path_lower:
        return f"Arquivo de configuração `{basename}`. Define constantes, conexões e inicializações necessárias para o boot do sistema."

    # Middleware
    if "middleware/" in path_lower:
        return f"Middleware Express `{basename}`. Intercepta requisições para validação, autenticação ou transformação de dados antes das rotas."

    # Scripts
    if "scripts/" in path_lower:
        return f"Script utilitário `{basename}`. Executável via CLI para tarefas de manutenção, migração ou automação."

    # Utils/Helpers
    if "utils/" in path_lower or "helper" in path_lower:
        return f"Biblioteca de utilitários `{basename}`. Funções auxiliares reutilizáveis para formatação, validação e transformação de dados."

    # Components
    if "components/" in path_lower:
        return f"Componente React: `{basename}`. Elemento de UI reutilizável com lógica de renderização e estado próprios."

    # Pages/Screens
    if "pages/" in path_lower or "screens/" in path_lower or "Screen" in basename:
        return f"Tela da aplicação: `{basename}`. Define o layout e comportamento de uma view completa, ligada a uma rota de navegação."

    # Hooks
    if "hooks/" in path_lower or basename.startswith("use"):
        return f"React Hook customizado: `{basename}`. Encapsula lógica reutilizável de estado e side effects."

    # Store/State
    if "store/" in path_lower:
        return f"Store de estado: `{basename}`. Gerencia estado global da aplicação com padrão centralizado."

    # Database
    if "database" in path_lower or "db" in path_lower:
        return f"Módulo de banco de dados: `{basename}`. Gerencia conexões, pool, queries e transações."

    # Genérico com algo útil
    if code:
        exports = re.findall(r'module\.exports\s*=\s*(?:new\s+)?(\w+)', code)
        classes = re.findall(r'class\s+(\w+)', code)
        funcs = re.findall(r'(?:async\s+)?function\s+(\w+)', code)
        
        parts = []
        if classes:
            parts.append(f"Define a classe `{classes[0]}`")
        if exports:
            parts.append(f"exporta `{exports[0]}`")
        if funcs:
            parts.append(f"funções: `{'`, `'.join(funcs[:4])}`")
        
        if parts:
            return f"Arquivo `{basename}`. {'. '.join(parts).capitalize()}."
    
    return f"Arquivo `{basename}` do projeto SoftHair."


def find_source_code(file_path: str, repo: str) -> str:
    """Encontra e lê o código fonte."""
    repo_root = REPO_MAP.get(repo)
    if not repo_root:
        return ""
    
    full_path = repo_root / file_path
    if full_path.exists():
        try:
            return full_path.read_text(encoding="utf-8")
        except:
            return ""
    return ""


def process_note(note_path: Path) -> dict:
    """Processa uma nota genérica."""
    result = {"path": str(note_path), "status": "skipped"}
    
    try:
        content = note_path.read_text(encoding="utf-8")
        
        if "Documento exportado automaticamente" not in content:
            return result
        
        # Extrair metadados
        file_match = re.search(r'\*\*File:\*\*\s*`([^`]+)`', content)
        repo_match = re.search(r'\*\*Repository:\*\*\s*(\w+)', content)
        
        file_path = file_match.group(1) if file_match else ""
        repo = repo_match.group(1).lower() if repo_match else ""
        
        # Ler código fonte
        code = find_source_code(file_path, repo) if file_path and repo else ""
        
        # Gerar novo resumo
        new_resumo = generate_smart_resumo(file_path, code)
        
        # Substituir o resumo genérico
        # Padrão: "## Resumo\n\nArquivo `X` do repositório Y.\n\n## Explicacao\n\nDocumento exportado..."
        content = re.sub(
            r'## Resumo\n\n.*?\n\n## Explicac[aã]o\n\nDocumento exportado automaticamente do LightRAG para consulta no Obsidian\.',
            f'## Resumo\n\n{new_resumo}',
            content,
            flags=re.DOTALL
        )
        
        # Se ainda tem a frase (formato diferente), tentar outro padrão
        if "Documento exportado automaticamente" in content:
            content = content.replace(
                "Documento exportado automaticamente do LightRAG para consulta no Obsidian.",
                ""
            )
            content = re.sub(r'## Explicac[aã]o\n\n\s*\n', '', content)
            # Se o resumo ainda é genérico
            old_resumo_match = re.search(r'## Resumo\n\n(Arquivo `[^`]+` do repositório \w+\.)', content)
            if old_resumo_match:
                content = content.replace(old_resumo_match.group(1), new_resumo)
            # Também para entity notes genéricas
            old_entity = re.search(r'## Resumo\n\n(Entidade `[^`]+` extraida do contexto \w+\.)', content)
            if old_entity:
                content = content.replace(old_entity.group(1), new_resumo)
        
        # Remover "Sem entidades vinculadas ainda."
        content = content.replace("Sem entidades vinculadas ainda.", "")
        content = content.replace("Sem arquivos relacionados ainda.", "")
        
        # Adicionar código se não tem e se temos o código
        if code and "## Conteudo" not in content and "## Conteúdo" not in content:
            lang = "javascript"
            if file_path.endswith(".py"):
                lang = "python"
            elif file_path.endswith((".ts", ".tsx")):
                lang = "typescript"
            
            line_count = code.count("\n")
            if line_count <= 500:
                content += f"\n## Conteúdo\n\n```{lang}\n{code}\n```\n"
            else:
                content += f"\n## Conteúdo\n\n> ⚠️ Arquivo com {line_count} linhas — código omitido por tamanho. Consulte o fonte.\n"
        
        # Limpar linhas vazias excessivas
        content = re.sub(r'\n{4,}', '\n\n\n', content)
        
        note_path.write_text(content, encoding="utf-8")
        result["status"] = "fixed"
        return result
        
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        return result


def main():
    print("🔧 Segunda passada — Corrigindo resumos genéricos")
    
    # Coletar notas que ainda têm texto genérico
    notes = []
    for md in KG_ROOT.rglob("*.md"):
        if "/.obsidian/" in str(md) or "/entities/" in str(md):
            continue
        try:
            text = md.read_text(encoding="utf-8")
            if "Documento exportado automaticamente" in text:
                notes.append(md)
        except:
            pass
    
    print(f"📊 Notas genéricas encontradas: {len(notes)}")
    
    fixed = 0
    errors = 0
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_note, n): n for n in notes}
        for i, future in enumerate(as_completed(futures), 1):
            result = future.result()
            if result["status"] == "fixed":
                fixed += 1
            elif result["status"] == "error":
                errors += 1
                print(f"  ❌ {result.get('error', '')}")
            
            if i % 25 == 0 or i == len(notes):
                print(f"  [{i}/{len(notes)}] ✅ {fixed} fixed | ❌ {errors} errors")
    
    print(f"\n✅ Segunda passada completa: {fixed} corrigidas, {errors} erros")
    
    # Verificar remanescentes
    remaining = 0
    for md in KG_ROOT.rglob("*.md"):
        if "/.obsidian/" in str(md) or "/entities/" in str(md):
            continue
        try:
            if "Documento exportado automaticamente" in md.read_text():
                remaining += 1
        except:
            pass
    print(f"📊 Notas ainda genéricas: {remaining}")


if __name__ == "__main__":
    main()
