import numpy as np
import asyncio
from lightrag import LightRAG, QueryParam
from lightrag.kg.shared_storage import initialize_pipeline_status
from lightrag.prompt import PROMPTS
from lightrag.utils import EmbeddingFunc
from . import config
from .llm import ollama_llm_func, ollama_embed_func

_init_lock = asyncio.Lock()
_rag_instance: LightRAG | None = None


def _patch_extraction_examples() -> None:
    examples = PROMPTS.get("entity_extraction_examples")
    if not isinstance(examples, list):
        return
    forbidden = (
        "World Athletics Championship",
        "100m sprint record",
        "Noah Carter",
        "Carbon-Fiber Spikes",
    )
    PROMPTS["entity_extraction_examples"] = [
        example
        for example in examples
        if not any(term in example for term in forbidden)
    ]


async def get_rag() -> LightRAG:
    global _rag_instance
    async with _init_lock:
        if _rag_instance is None:
            _patch_extraction_examples()
            config.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
            embed_func = EmbeddingFunc(
                embedding_dim=config.EMBED_DIM,
                func=ollama_embed_func,
                max_token_size=4096,
            )
            _rag_instance = LightRAG(
                working_dir=str(config.STORAGE_DIR),
                llm_model_func=ollama_llm_func,
                embedding_func=embed_func,
                llm_model_max_async=config.LLM_MAX_ASYNC,
                max_parallel_insert=config.MAX_PARALLEL_INSERT,
                embedding_batch_num=config.EMBEDDING_BATCH_NUM,
                embedding_func_max_async=config.EMBEDDING_FUNC_MAX_ASYNC,
                chunk_token_size=config.CHUNK_TOKEN_SIZE,
                chunk_overlap_token_size=config.CHUNK_OVERLAP,
                enable_llm_cache=True,
                default_llm_timeout=config.LLM_TIMEOUT,
                default_embedding_timeout=config.EMBEDDING_TIMEOUT,
            )
            await _rag_instance.initialize_storages()
            await initialize_pipeline_status()
    return _rag_instance


async def query(text: str, mode: str = "hybrid") -> str:
    rag = await get_rag()
    return await rag.aquery(text, QueryParam(mode=mode))


async def insert_texts(texts: list[str], ids: list[str], file_paths: list[str]):
    rag = await get_rag()
    await rag.ainsert(texts, ids=ids, file_paths=file_paths)


async def stats() -> dict:
    info: dict = {}
    graph_file = config.STORAGE_DIR / "graph_chunk_entity_relation.graphml"
    if graph_file.exists():
        import networkx as nx
        g = nx.read_graphml(str(graph_file))
        info["entities"] = g.number_of_nodes()
        info["relations"] = g.number_of_edges()
    else:
        info["entities"] = 0
        info["relations"] = 0
    if config.MANIFEST_PATH.exists():
        import json
        info["indexed_docs"] = len(json.loads(config.MANIFEST_PATH.read_text()))
    else:
        info["indexed_docs"] = 0
    if config.VAULT_PATH.exists():
        info["obsidian_notes"] = len(list(config.VAULT_PATH.rglob("*.md")))
    else:
        info["obsidian_notes"] = 0
    return info


async def top_entities(n: int = 20) -> list[dict]:
    graph_file = config.STORAGE_DIR / "graph_chunk_entity_relation.graphml"
    if not graph_file.exists():
        return []
    import networkx as nx
    g = nx.read_graphml(str(graph_file))
    return [{"entity": e, "degree": d} for e, d in sorted(g.degree(), key=lambda x: x[1], reverse=True)[:n]]


async def find_entity(name: str) -> list[str]:
    graph_file = config.STORAGE_DIR / "graph_chunk_entity_relation.graphml"
    if not graph_file.exists():
        return []
    import networkx as nx
    g = nx.read_graphml(str(graph_file))
    return [n for n in g.nodes() if name.lower() in n.lower()]


async def show_entity(name: str) -> dict:
    graph_file = config.STORAGE_DIR / "graph_chunk_entity_relation.graphml"
    if not graph_file.exists():
        return {}
    import networkx as nx
    g = nx.read_graphml(str(graph_file))
    if name not in g:
        matches = [n for n in g.nodes() if name.lower() in n.lower()]
        if not matches:
            return {"error": f"Entity '{name}' not found"}
        name = matches[0]
    return {"entity": name, "attributes": dict(g.nodes[name]), "neighbors": list(g.neighbors(name))[:20]}
