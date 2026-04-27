#!/bin/bash
# Sequential indexing for SoftHair ecosystem
# Run this in your terminal

echo "=== Indexing SoftHair (Desktop) ==="
cd /home/ogejota/MONEY/SoftHair
uv run --project tools/lightrag kg-index --full

echo ""
echo "=== Indexing Mobile ==="
cd /home/ogejota/MONEY/softhair-mobile
uv run --project /home/ogejota/MONEY/SoftHair/tools/lightrag kg-index --full

echo ""
echo "=== Indexing Server ==="
cd /home/ogejota/MONEY/SOFT-HAIR-SERVER
uv run --project /home/ogejota/MONEY/SoftHair/tools/lightrag kg-index --full

echo ""
echo "=== EXPORTING TO OBSIDIAN ==="
cd /home/ogejota/MONEY/SoftHair
uv run --project tools/lightrag kg-to-obsidian

echo ""
echo "=== DONE! Check stats: ==="
uv run --project tools/lightrag rag stats

read -p "Press Enter to exit..."