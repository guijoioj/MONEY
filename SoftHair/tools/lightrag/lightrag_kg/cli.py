import argparse
import asyncio
import json
import sys
from pathlib import Path

# Add debugging
import os
os.environ["RUST_LOG"] = "error"

from rich.console import Console
from rich.markdown import Markdown
from rich.table import Table

console = Console()


async def cmd_search(args):
    term = " ".join(args.term) if isinstance(args.term, list) else args.term
    print(f"DEBUG: loading rag module...", file=sys.stderr)
    from . import rag as rag_mod
    print(f"DEBUG: calling query...", file=sys.stderr)
    result = await rag_mod.query(term, mode=args.mode)
    if args.json:
        print(json.dumps({"mode": args.mode, "query": term, "answer": result}))
    else:
        console.print(Markdown(result))


async def cmd_stats(args):
    from . import rag as rag_mod
    info = await rag_mod.stats()
    if args.json:
        print(json.dumps(info, indent=2))
    else:
        t = Table(title="LightRAG — SoftHair Knowledge Graph")
        t.add_column("Metric", style="cyan")
        t.add_column("Value", style="green")
        for k, v in info.items():
            t.add_row(k.replace("_", " ").title(), str(v))
        console.print(t)


async def cmd_top(args):
    from . import rag as rag_mod
    n = args.n
    entities = await rag_mod.top_entities(n)
    if args.json:
        print(json.dumps(entities, indent=2))
    else:
        t = Table(title=f"Top {n} Entities by Degree")
        t.add_column("Entity", style="cyan")
        t.add_column("Degree", style="green")
        for e in entities:
            t.add_row(e["entity"], str(e["degree"]))
        console.print(t)


async def cmd_find(args):
    from . import rag as rag_mod
    term = " ".join(args.term) if isinstance(args.term, list) else args.term
    results = await rag_mod.find_entity(term)
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        console.print(f"[cyan]Found {len(results)} matches:[/cyan]")
        for r in results:
            console.print(f"  • {r}")


async def cmd_show(args):
    from . import rag as rag_mod
    term = " ".join(args.term) if isinstance(args.term, list) else args.term
    result = await rag_mod.show_entity(term)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if "error" in result:
            console.print(f"[red]{result['error']}[/red]")
        else:
            console.print(f"[bold cyan]{result['entity']}[/bold cyan]")
            console.print(f"Degree: {len(result['neighbors'])}")
            console.print("[cyan]Neighbors:[/cyan]")
            for n in result["neighbors"][:10]:
                console.print(f"  • {n}")


async def cmd_insert(args):
    from . import rag as rag_mod
    import hashlib
    text = args.text
    source = getattr(args, "source", "manual-insert") or "manual-insert"
    doc_id = f"manual-{hashlib.sha1(text.encode()).hexdigest()[:12]}"
    await rag_mod.insert_texts([text], ids=[doc_id], file_paths=[source])
    if args.json:
        print(json.dumps({"inserted": True, "id": doc_id, "source": source}))
    else:
        console.print(f"[green]✓ Inserted (id={doc_id}, source={source})[/green]")


async def cmd_index(args):
    from .index import run_index
    full = getattr(args, "full", False)
    dry_run = getattr(args, "dry_run", False)
    incremental = getattr(args, "incremental", False)
    await run_index(full=full, dry_run=dry_run, incremental=incremental)


async def cmd_export(args):
    from .to_obsidian import run_export
    clean = getattr(args, "clean", False)
    await run_export(clean=clean)


async def cmd_shell(args):
    from . import rag as rag_mod
    console.print("[bold cyan]LightRAG Shell[/bold cyan] — type your query, /exit to quit")
    console.print("  Prefixes: /local /global /chunks /stats /top /find /show\n")

    try:
        import prompt_toolkit
        from prompt_toolkit import PromptSession
        session = PromptSession()
        get_input = lambda: session.prompt("rag> ")
    except ImportError:
        get_input = input

    current_mode = "hybrid"

    while True:
        try:
            user_input = get_input().strip()
            if not user_input:
                continue
            if user_input.lower() in ("/exit", "exit"):
                break

            if user_input.startswith("/"):
                parts = user_input[1:].split(maxsplit=1)
                cmd = parts[0].lower()
                if cmd in ("local", "global", "chunks"):
                    current_mode = cmd
                    query = parts[1] if len(parts) > 1 else ""
                elif cmd in ("stats", "top", "find", "show"):
                    cmd_func = {"stats": rag_mod.stats, "top": rag_mod.top_entities, "find": rag_mod.find_entity, "show": rag_mod.show_entity}
                    result = await cmd_func[cmd]()
                    console.print(result)
                    continue
                else:
                    console.print(f"[red]Unknown command: {cmd}[/red]")
                    continue
                if not query:
                    continue
            else:
                query = user_input

            result = await rag_mod.query(query, mode=current_mode)
            console.print(Markdown(result))
        except (KeyboardInterrupt, EOFError):
            break
        except Exception as e:
            console.print(f"[red]Error: {e}[/red]")

    console.print("[dim]Goodbye![/dim]")


async def cmd_mcp_check(args):
    import importlib
    from . import config

    repo_root = config.REPO_ROOT
    mcp_path = repo_root / ".mcp.json"

    checks = []

    mcp_exists = mcp_path.exists()
    checks.append(("`.mcp.json` exists", mcp_exists))

    has_entry = False
    correct_path = False
    if mcp_exists:
        try:
            data = json.loads(mcp_path.read_text())
            servers = data.get("mcpServers", {})
            if "lightrag" in servers:
                has_entry = True
                entry = servers["lightrag"]
                path = str(repo_root / "tools/lightrag")
                correct_path = path in str(entry)
        except Exception:
            pass

    checks.append(('Entry "lightrag" exists', has_entry))
    checks.append(("Path points to tools/lightrag", correct_path))

    can_import = False
    try:
        import lightrag_kg.server
        can_import = True
    except Exception:
        pass

    checks.append(("`lightrag_kg.server` importable", can_import))

    console.print("[bold cyan]MCP Configuration Check[/bold cyan]\n")
    for check, passed in checks:
        status = "[green]✓[/green]" if passed else "[red]✗[/red]"
        console.print(f"{status} {check}")

    all_passed = all(p for _, p in checks)
    if all_passed:
        console.print("\n[green]MCP is properly configured![/green]")
    else:
        console.print("\n[red]Some checks failed. Please review your .mcp.json[/red]")


def main():
    parser = argparse.ArgumentParser(prog="rag", description="SoftHair Knowledge Graph CLI")
    parser.add_argument("--json", action="store_true", help="Machine-readable JSON output")
    sub = parser.add_subparsers(dest="cmd", required=True)

    for name, mode, help_text in [
        ("search", "hybrid", "Hybrid search with synthesis (default)"),
        ("ask", "hybrid", "Alias for search"),
        ("chunks", "naive", "Vector-only search without synthesis"),
        ("local", "local", "Entity neighborhood search"),
        ("global", "global", "Community/theme-level search"),
    ]:
        sp = sub.add_parser(name, help=help_text)
        sp.add_argument("term", nargs="+")
        sp.set_defaults(func=cmd_search, mode=mode)

    sp_stats = sub.add_parser("stats", help="Graph statistics")
    sp_stats.set_defaults(func=cmd_stats)

    sp_top = sub.add_parser("top", help="Top entities by degree")
    sp_top.add_argument("n", nargs="?", default=20, type=int)
    sp_top.set_defaults(func=cmd_top)

    sp_find = sub.add_parser("find", help="Find entity by name substring")
    sp_find.add_argument("term", nargs="+")
    sp_find.set_defaults(func=cmd_find)

    sp_show = sub.add_parser("show", help="Show entity details + neighbors")
    sp_show.add_argument("term", nargs="+")
    sp_show.set_defaults(func=cmd_show)

    sp_insert = sub.add_parser("insert", help="Insert ad-hoc text into graph")
    sp_insert.add_argument("text")
    sp_insert.add_argument("--source", default="manual-insert")
    sp_insert.set_defaults(func=cmd_insert)

    sp_index = sub.add_parser("index", help="Re-index the codebase")
    grp = sp_index.add_mutually_exclusive_group()
    grp.add_argument("--full", action="store_true")
    grp.add_argument("--incremental", action="store_true")
    grp.add_argument("--dry-run", action="store_true")
    sp_index.set_defaults(func=cmd_index)

    sp_export = sub.add_parser("export", help="Export to Obsidian vault")
    sp_export.add_argument("--clean", action="store_true")
    sp_export.set_defaults(func=cmd_export)

    sp_shell = sub.add_parser("shell", help="Interactive REPL")
    sp_shell.set_defaults(func=cmd_shell)

    sp_check = sub.add_parser("mcp-check", help="Validate .mcp.json + MCP server")
    sp_check.set_defaults(func=cmd_mcp_check)

    args = parser.parse_args()
    asyncio.run(args.func(args))


if __name__ == "__main__":
    main()