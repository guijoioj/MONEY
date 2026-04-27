import asyncio
import sys
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types
from .rag import query, insert_texts, stats
from . import config


app = Server("lightrag-softhair")


@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="kg_query",
            description="Query the SoftHair knowledge graph. Use for architecture, flow, entity relationships.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language question about the codebase"},
                    "mode": {
                        "type": "string",
                        "enum": ["hybrid", "local", "global", "naive"],
                        "default": "hybrid",
                        "description": "Search mode: hybrid (default), local (entity neighborhood), global (themes), naive (vector only)",
                    },
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="kg_insert_text",
            description="Insert ad-hoc text into the knowledge graph (decisions, meeting notes, context).",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Content to insert"},
                    "source": {"type": "string", "description": "Label/identifier for this content", "default": "manual-insert"},
                },
                "required": ["text"],
            },
        ),
        types.Tool(
            name="kg_stats",
            description="Get statistics about the knowledge graph (entities, relations, indexed docs).",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    if name == "kg_query":
        mode = arguments.get("mode", "hybrid")
        result = await query(arguments["query"], mode=mode)
        return [types.TextContent(type="text", text=result)]

    elif name == "kg_insert_text":
        import hashlib
        text = arguments["text"]
        source = arguments.get("source", "manual-insert")
        doc_id = f"manual-{hashlib.sha1(text.encode()).hexdigest()[:12]}"
        await insert_texts([text], ids=[doc_id], file_paths=[source])
        return [types.TextContent(type="text", text=f"Inserted successfully (id={doc_id})")]

    elif name == "kg_stats":
        info = await stats()
        import json
        return [types.TextContent(type="text", text=json.dumps(info, indent=2))]

    return [types.TextContent(type="text", text=f"Unknown tool: {name}")]


async def run():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


def main():
    asyncio.run(run())


if __name__ == "__main__":
    main()
