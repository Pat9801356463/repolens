"""
scripts/prebuild_demo_graph.py — Phase 5

Run this once ahead of demo day (blueprint §7/§8: "run once before demo
day to cache graph.json"). It scans the frozen demo repo with Phase 1's
real extractor, builds the graph with Phase 2's real builder, and writes
backend/storage/graph_cache.json — so main.py's startup never depends on
tree-sitter parsing succeeding live on stage.

Usage (from the repolens/ project root):
    python3 scripts/prebuild_demo_graph.py
    python3 scripts/prebuild_demo_graph.py path/to/other_repo

Optionally also pre-bakes test-gen results (blueprint §0: "generate and
run once before the demo, cache the output, replay it") if LLM_PROVIDER
is set to a real provider:
    LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-... \
        python3 scripts/prebuild_demo_graph.py --with-testgen
"""
from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from graph.analysis import all_nodes  # noqa: E402
from graph.builder import build_graph, save_graph_cache  # noqa: E402
from parser.extractors import extract_repo  # noqa: E402


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    repo_path = args[0] if args else str(PROJECT_ROOT / "demo_repo")
    with_testgen = "--with-testgen" in sys.argv

    print(f"[prebuild] scanning {repo_path} ...")
    nodes, edges = extract_repo(repo_path)
    graph = build_graph(nodes, edges)
    print(f"[prebuild] extracted {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")

    cache_path = BACKEND_DIR / "storage" / "graph_cache.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    save_graph_cache(graph, cache_path)
    print(f"[prebuild] wrote {cache_path}")

    if with_testgen:
        from ai.llm_client import get_llm_client
        from testgen.generate_and_run import prebake_all, save_cache

        client = get_llm_client()
        print(f"[prebuild] pre-baking test-gen results with LLM_PROVIDER={client.__class__.__name__} ...")
        cache = prebake_all(all_nodes(graph), client, repo_path)
        save_cache(cache)
        print(f"[prebuild] wrote {len(cache)} test-gen cache entries")


if __name__ == "__main__":
    main()
