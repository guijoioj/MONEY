import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def test_imports():
    from lightrag_kg import config
    from lightrag_kg import llm
    from lightrag_kg import rag
    from lightrag_kg import index
    from lightrag_kg import server
    from lightrag_kg import to_obsidian
    from lightrag_kg import cli


def test_slugify():
    from lightrag_kg.to_obsidian import slugify
    assert slugify("AsaasWebhook/Handler") == "asaaswebhook-handler"
    assert slugify("My Entity Name") == "my-entity-name"
    assert slugify("  trim  ") == "trim"
    assert slugify("") == "unknown"
    assert len(slugify("a" * 300)) <= 180


def test_doc_id():
    from lightrag_kg.index import _doc_id
    id1 = _doc_id("backend/src/routes/auth.js")
    id2 = _doc_id("backend/src/routes/auth.js")
    id3 = _doc_id("backend/src/routes/clientes.js")
    assert id1 == id2
    assert id1 != id3
    assert id1.startswith("doc-")


def test_wrap():
    from lightrag_kg.index import _wrap
    result = _wrap("src/foo.ts", "const x = 1;")
    assert "FILE: src/foo.ts" in result
    assert "LANG: typescript" in result
    assert "const x = 1;" in result


def test_config_paths():
    from lightrag_kg import config
    assert config.LLM_MODEL == "claude-haiku-4-5"
    assert config.EMBED_MODEL == "voyage-3-lite"
    assert config.EMBED_DIM == 512
