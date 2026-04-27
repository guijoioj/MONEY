import argparse
import asyncio
import hashlib
import json
import re
import subprocess
from pathlib import Path

from . import config


def _sha1_file(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()[:16]


def _sha1_str(s: str) -> str:
    return hashlib.sha1(s.encode()).hexdigest()[:12]


def _lang_for(path: Path) -> str:
    ext = path.suffix.lower()
    mapping = {
        ".js": "javascript", ".ts": "typescript", ".tsx": "tsx",
        ".jsx": "jsx", ".py": "python", ".md": "markdown",
        ".json": "json", ".css": "css", ".html": "html",
        ".sql": "sql", ".sh": "bash",
    }
    return mapping.get(ext, "text")


def _wrap(repo_label: str, rel: str, content: str) -> str:
    lang = _lang_for(Path(rel))
    return f"REPO: {repo_label}\nFILE: {rel}\nLANG: {lang}\n---\n{content}"


def _doc_id(repo_name: str, rel: str) -> str:
    key = f"{repo_name}/{rel}"
    return f"doc-{_sha1_str(key)}"


def _is_excluded(path: Path, repo_root: Path) -> bool:
    rel = str(path.relative_to(repo_root))
    for excl in config.EXCLUDE_PATTERNS:
        if excl in rel:
            return True
    return False


def collect_files_for_repo(repo: dict) -> list[tuple[Path, str, str, str]]:
    """Returns list of (file_path, rel_path, doc_id, repo_label)."""
    root = repo["root"]
    label = repo["label"]
    name = repo["name"]
    if not root.exists():
        return []

    seen = set()
    files = []
    for pat in repo["patterns"]:
        for f in root.glob(pat):
            if f in seen:
                continue
            seen.add(f)
            if not f.is_file():
                continue
            if _is_excluded(f, root):
                continue
            try:
                size = f.stat().st_size
                if size > 500_000 or size == 0:
                    continue
            except OSError:
                continue
            rel = str(f.relative_to(root))
            doc_id = _doc_id(name, rel)
            files.append((f, rel, doc_id, label))
    return sorted(files, key=lambda x: x[1])


def collect_git_history(repo: dict) -> list[tuple[str, str, str]]:
    """Returns list of (doc_id, text, sha)."""
    root = repo["root"]
    label = repo["label"]
    name = repo["name"]
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "log", "--oneline", "--all", "--max-count=500"],
            capture_output=True, text=True, timeout=30,
        )
        items = []
        for line in result.stdout.strip().splitlines():
            text = f"REPO: {label}\nGIT COMMIT: {line}"
            doc_id = f"git-{name}-{_sha1_str(line)}"
            sha = _sha1_str(text)
            items.append((doc_id, text, sha))
        return items
    except Exception:
        return []


def load_manifest() -> dict:
    if config.MANIFEST_PATH.exists():
        try:
            return json.loads(config.MANIFEST_PATH.read_text())
        except Exception:
            return {}
    return {}


def save_manifest(manifest: dict):
    config.MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))


async def retry_failed_queue():
    from .rag import get_rag
    from rich.console import Console

    console = Console()
    console.print("[dim]Initializing RAG...[/dim]")
    rag = await get_rag()
    console.print("[yellow]Retrying pending, processing, and failed documents in storage...[/yellow]")
    await rag.apipeline_process_enqueue_documents(None, False)
    console.print("[green]Retry queue finished.[/green]")


async def run_index(
    full: bool = False,
    dry_run: bool = False,
    incremental: bool = False,
    batch_size: int = 5,
    repos: list[str] | None = None,
):
    from .rag import get_rag, insert_texts
    from rich.console import Console
    from rich.table import Table

    console = Console()
    manifest = load_manifest() if not full else {}

    to_index: list[tuple] = []  # (f_obj|None, rel_key, doc_id, sha, text_override, label)

    selected_repos = config.REPOS
    if repos:
        wanted = {r.lower() for r in repos}
        selected_repos = [
            repo for repo in config.REPOS
            if repo["name"].lower() in wanted or repo["label"].strip("[]").lower() in wanted
        ]

    for repo in selected_repos:
        console.print(f"[cyan]Scanning {repo['name']}...[/cyan]")
        files = collect_files_for_repo(repo)
        for f, rel, doc_id, label in files:
            sha = _sha1_file(f)
            manifest_key = f"{repo['name']}/{rel}"
            if incremental and manifest.get(manifest_key) == sha:
                continue
            to_index.append((f, manifest_key, doc_id, sha, None, label))

        git_items = collect_git_history(repo)
        for gid, gtext, gsha in git_items:
            if incremental and manifest.get(gid) == gsha:
                continue
            to_index.append((None, gid, gid, gsha, gtext, repo["label"]))

    total = len(to_index)
    console.print(f"\n[yellow]Total to index:[/yellow] {total} items across {len(selected_repos)} repos\n")

    if dry_run:
        t = Table(title="Dry-run plan")
        t.add_column("Repo/Path")
        t.add_column("Size")
        for item in to_index[:50]:
            f_obj, key, _, _, text_override, label = item
            size = f"{f_obj.stat().st_size // 1024}KB" if f_obj else "git"
            t.add_row(f"{label} {key[:70]}", size)
        if total > 50:
            t.add_row(f"... and {total - 50} more", "")
        console.print(t)
        console.print(f"\n[dim]Dry-run done. Run without --dry-run to index.[/dim]")
        return

    if total == 0:
        console.print("[green]Nothing to index — all up to date.[/green]")
        return

    console.print("[dim]Initializing RAG...[/dim]")
    await get_rag()

    BATCH = max(1, batch_size)
    processed = 0
    for i in range(0, total, BATCH):
        batch = to_index[i : i + BATCH]
        texts, ids, paths, keys_shas = [], [], [], []

        for f_obj, manifest_key, doc_id, sha, text_override, label in batch:
            if text_override is not None:
                texts.append(text_override)
                ids.append(doc_id)
                paths.append("git-history")
                keys_shas.append((manifest_key, sha))
            elif f_obj is not None:
                try:
                    content = f_obj.read_text(errors="replace")
                    # rel is the part after repo name in manifest_key
                    rel = manifest_key.split("/", 1)[1] if "/" in manifest_key else manifest_key
                    wrapped = _wrap(label, rel, content)
                    texts.append(wrapped)
                    ids.append(doc_id)
                    paths.append(manifest_key)
                    keys_shas.append((manifest_key, sha))
                except Exception as e:
                    console.print(f"[red]Skip {manifest_key}: {e}[/red]")

        if texts:
            try:
                await insert_texts(texts, ids=ids, file_paths=paths)
                for key, sha in keys_shas:
                    manifest[key] = sha
                save_manifest(manifest)
                processed += len(texts)
                console.print(f"[green]✓[/green] {processed}/{total}")
            except Exception as e:
                if "Content already exists" in str(e):
                    for key, sha in keys_shas:
                        manifest[key] = sha
                    save_manifest(manifest)
                    processed += len(texts)
                else:
                    console.print(f"[red]Batch error: {e}[/red]")

    console.print(f"\n[bold green]Done — {processed} docs indexed.[/bold green]")


def main():
    parser = argparse.ArgumentParser(prog="kg-index")
    grp = parser.add_mutually_exclusive_group()
    grp.add_argument("--full", action="store_true")
    grp.add_argument("--incremental", action="store_true")
    grp.add_argument("--dry-run", action="store_true")
    grp.add_argument("--retry-failed", action="store_true")
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--repo", action="append", help="Only index a repo by name or label, e.g. --repo server --repo mobile")
    args = parser.parse_args()
    if args.retry_failed:
        asyncio.run(retry_failed_queue())
    else:
        asyncio.run(
            run_index(
                full=args.full,
                dry_run=args.dry_run,
                incremental=args.incremental,
                batch_size=args.batch_size,
                repos=args.repo,
            )
        )


if __name__ == "__main__":
    main()
