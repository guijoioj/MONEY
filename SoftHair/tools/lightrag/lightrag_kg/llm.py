import asyncio
import numpy as np
from typing import List
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from . import config


EXTRACTION_GUARDRAIL = """
You are indexing the SoftHair codebase only.
Extract entities and relationships solely from the real input document content after the document marker.
Never extract, merge, or mention entities that appear only in examples, format instructions, or demonstrations.
The following example-only entities are forbidden unless they appear in the real document content: 100m Sprint Record, World Athletics Federation, World Athletics Championship, Noah Carter, Tokyo, Carbon-Fiber Spikes.
"""


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
async def ollama_llm_func(
    prompt: str,
    system_prompt: str = "",
    history_messages: List[dict] = None,
    **kwargs,
) -> str:
    import aiohttp
    url = f"{config.OLLAMA_HOST}/api/generate"
    guarded_system_prompt = (
        f"{system_prompt}\n\n{EXTRACTION_GUARDRAIL}"
        if system_prompt
        else EXTRACTION_GUARDRAIL
    )
    payload = {
        "model": config.LLM_MODEL,
        "prompt": prompt,
        "system": guarded_system_prompt,
        "stream": False,
        "options": {"num_ctx": 8192},
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=600)) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise Exception(f"Ollama LLM {resp.status}: {text[:200]}")
            data = await resp.json()
            return data.get("response", "")


async def ollama_embed_func(texts: List[str]) -> np.ndarray:
    import aiohttp
    # /api/embed supports multiple inputs in one request (batch)
    url = f"{config.OLLAMA_HOST}/api/embed"
    truncated = [t[:4000] for t in texts]
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json={"model": config.EMBED_MODEL, "input": truncated},
                timeout=aiohttp.ClientTimeout(total=300),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    embeddings = data.get("embeddings", [])
                    if embeddings:
                        return np.array(embeddings, dtype=np.float32)
    except Exception:
        pass
    return np.zeros((len(texts), config.EMBED_DIM), dtype=np.float32)


llm_func = ollama_llm_func
embed_func_raw = ollama_embed_func
