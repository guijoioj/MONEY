import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path("/home/ogejota/MONEY/SoftHair/tools/lightrag")
STORAGE_DIR = BASE_DIR / "rag_storage"
MANIFEST_PATH = BASE_DIR / ".index_manifest.json"
VAULT_PATH = Path("/home/ogejota/MONEY/SoftHair/docs/knowledge-graph")

load_dotenv(BASE_DIR / ".env.local")
load_dotenv(BASE_DIR / ".env")

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5-coder:14b")
EMBED_MODEL = os.getenv("EMBED_MODEL", "mxbai-embed-large:latest")
EMBED_DIM = int(os.getenv("EMBED_DIM", "1024"))

REPOS = [
    {
        "name": "SoftHair",
        "label": "[Desktop]",
        "root": Path("/home/ogejota/MONEY/SoftHair"),
        "patterns": [
            "backend/src/**/*.js",
            "frontend/src/**/*.jsx",
            "frontend/src/**/*.js",
            "*.md",
        ],
    },
    {
        "name": "SOFT-HAIR-SERVER",
        "label": "[Server]",
        "root": Path("/home/ogejota/MONEY/SOFT-HAIR-SERVER"),
        "patterns": [
            "src/**/*.js",
            "src/**/*.ts",
            "*.md",
        ],
    },
    {
        "name": "softhair-mobile",
        "label": "[Mobile]",
        "root": Path("/home/ogejota/MONEY/softhair-mobile"),
        "patterns": [
            "app/**/*.tsx",
            "app/**/*.ts",
            "components/**/*.tsx",
            "services/**/*.ts",
            "*.md",
        ],
    },
]

EXCLUDE_PATTERNS = [
    "node_modules", ".git", "__pycache__", ".venv",
    "*.lock", "*.log", ".claude/worktrees", "backups",
    "tools/lightrag", "docs/knowledge-graph",
    "dist", "build", ".next", "_generated", "generated",
]

REPO_ROOT = Path("/home/ogejota/MONEY/SoftHair")

MAX_PARALLEL_INSERT = int(os.getenv("MAX_PARALLEL_INSERT", "1"))
LLM_MAX_ASYNC = int(os.getenv("LLM_MAX_ASYNC", "1"))
EMBEDDING_BATCH_NUM = int(os.getenv("EMBEDDING_BATCH_NUM", "2"))
EMBEDDING_FUNC_MAX_ASYNC = int(os.getenv("EMBEDDING_FUNC_MAX_ASYNC", "1"))
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "900"))
EMBEDDING_TIMEOUT = int(os.getenv("EMBEDDING_TIMEOUT", "600"))
CHUNK_TOKEN_SIZE = int(os.getenv("CHUNK_SIZE", "1200"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
