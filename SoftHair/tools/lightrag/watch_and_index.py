"""
SoftHair Knowledge Graph — File Watcher
Detecta mudanças nos 3 repos, acumula por 45s (debounce), roda indexação
incremental e exporta vault. Nunca roda dois processos simultâneos.
"""
import time
import subprocess
import threading
import logging
import signal
import sys
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

BASE = Path(__file__).parent
LOG = BASE / "watch.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.FileHandler(LOG), logging.StreamHandler()],
)
log = logging.getLogger("watcher")

REPOS = [
    Path("/home/ogejota/MONEY/SoftHair"),
    Path("/home/ogejota/MONEY/SOFT-HAIR-SERVER"),
    Path("/home/ogejota/MONEY/softhair-mobile"),
]

WATCH_EXTS = {".js", ".jsx", ".ts", ".tsx", ".md"}

EXCLUDE = {
    "node_modules", ".git", "__pycache__", ".venv",
    "dist", "build", ".claude", "docs", "tools",
}

DEBOUNCE_SECS = 45   # acumula mudanças por 45s antes de rodar
PYTHON = str(BASE / ".venv/bin/python")


class ChangeHandler(FileSystemEventHandler):
    def __init__(self, trigger_fn):
        self._trigger = trigger_fn

    def on_any_event(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.suffix not in WATCH_EXTS:
            return
        if any(ex in path.parts for ex in EXCLUDE):
            return
        log.info(f"mudança: {path.name}")
        self._trigger()


class DebouncedIndexer:
    def __init__(self):
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()
        self._running = False

    def trigger(self):
        with self._lock:
            if self._timer:
                self._timer.cancel()
            self._timer = threading.Timer(DEBOUNCE_SECS, self._run)
            self._timer.daemon = True
            self._timer.start()
            log.info(f"mudança detectada — indexando em {DEBOUNCE_SECS}s...")

    def _run(self):
        with self._lock:
            if self._running:
                log.info("indexador já rodando — aguardando...")
                # reagendar para depois que terminar
                self._timer = threading.Timer(30, self._run)
                self._timer.daemon = True
                self._timer.start()
                return
            self._running = True

        try:
            log.info("=== INICIANDO INDEXAÇÃO INCREMENTAL ===")
            result = subprocess.run(
                [PYTHON, "-B", "-m", "lightrag_kg.index", "--incremental", "--batch-size", "8"],
                cwd=BASE,
                capture_output=True,
                text=True,
                timeout=1800,  # 30 min máximo
            )
            if result.returncode == 0:
                log.info("indexação concluída")
            else:
                log.error(f"indexação falhou: {result.stderr[-500:]}")
                return  # não exportar se indexação falhou

            log.info("=== EXPORTANDO VAULT ===")
            result2 = subprocess.run(
                [PYTHON, "-B", "-m", "lightrag_kg.to_obsidian"],
                cwd=BASE,
                capture_output=True,
                text=True,
                timeout=300,
            )
            if result2.returncode == 0:
                log.info("vault exportado ✅")
            else:
                log.error(f"export falhou: {result2.stderr[-500:]}")
        except subprocess.TimeoutExpired:
            log.error("timeout — indexação cancelada")
        except Exception as e:
            log.error(f"erro inesperado: {e}")
        finally:
            with self._lock:
                self._running = False


def main():
    indexer = DebouncedIndexer()
    handler = ChangeHandler(indexer.trigger)

    observer = Observer()
    active = []
    for repo in REPOS:
        if repo.exists():
            observer.schedule(handler, str(repo), recursive=True)
            active.append(repo.name)
            log.info(f"monitorando: {repo}")
        else:
            log.warning(f"repo não encontrado: {repo}")

    if not active:
        log.error("nenhum repo encontrado — encerrando")
        sys.exit(1)

    observer.start()
    log.info(f"watcher ativo — repos: {active}")
    log.info(f"debounce: {DEBOUNCE_SECS}s | extensões: {WATCH_EXTS}")

    def shutdown(sig, frame):
        log.info("encerrando watcher...")
        observer.stop()
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()

    observer.join()


if __name__ == "__main__":
    main()
