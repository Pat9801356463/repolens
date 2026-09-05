"""
ai/retriever.py

Turns (intent, question) + Phase 2's graph functions into the "subgraph as
structured text" + "relevant source snippets" that blueprint §5 says get
assembled into the final prompt. No embeddings (§5: "graph retrieval alone
covers 80% of your demo questions").
"""
from __future__ import annotations

import os

from graph.analysis import (
    find_nodes_by_name,
    get_forward_trace,
    get_impact,
    get_node,
    get_subgraph,
)
from graph.schema import EdgeType


def fetch_source_snippet(node: dict, repo_root: str | None = None) -> str:
    """Prefer an embedded fixture snippet (dev/demo mode); fall back to
    reading the real file by line range once Phase 1's real repo is wired
    in at integration (blueprint §7's "drop-in swap").
    """
    metadata = node.get("metadata") or {}
    if "source_snippet" in metadata:
        return metadata["source_snippet"]

    if repo_root and node.get("file"):
        path = os.path.join(repo_root, node["file"])
        try:
            with open(path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            start = max(node.get("line_start", 1) - 1, 0)
            end = node.get("line_end", start + 1)
            return "".join(lines[start:end])
        except OSError:
            return ""
    return ""


def format_node(node: dict, include_snippet: bool = True, repo_root: str | None = None) -> str:
    node_type = node.get("type")
    type_str = node_type.value if hasattr(node_type, "value") else str(node_type)
    lines = [f"### {node['id']} ({type_str})", f"file: {node.get('file', '')}"]
    if node.get("metadata", {}).get("docstring"):
        lines.append(f"docstring: {node['metadata']['docstring']}")
    if include_snippet:
        snippet = fetch_source_snippet(node, repo_root=repo_root)
        if snippet:
            lines.append(f"```python\n{snippet}\n```")
    return "\n".join(lines)


def format_edges(graph, node_ids: set[str]) -> str:
    lines = []
    for u, v, data in graph.edges(data=True):
        if u in node_ids and v in node_ids:
            etype = data.get("type")
            etype_str = etype.value if hasattr(etype, "value") else str(etype)
            lines.append(f"{u} --{etype_str}--> {v}")
    return "\n".join(lines) if lines else "(no edges among retrieved nodes)"


def build_architecture_summary_context(graph, repo_root: str | None = None) -> str:
    """Whole-graph summary text, precomputed once at load time per §5."""
    node_ids = set(graph.nodes)
    node_blocks = [format_node(get_node(graph, nid), include_snippet=False) for nid in node_ids]
    return "\n\n".join(node_blocks) + "\n\nEdges:\n" + format_edges(graph, node_ids)


def resolve_target_node(graph, question: str) -> dict | None:
    """Best-effort: find the node the question is most likely about via
    cheap name matching (§5's "keyword/name match against node names").
    """
    matches = find_nodes_by_name(graph, question, limit=1)
    return matches[0] if matches else None


def retrieve_for_impact(graph, question: str, repo_root: str | None = None) -> dict:
    target = resolve_target_node(graph, question)
    if target is None:
        return {"target": None, "subgraph_text": "(no matching node found)", "impact_text": "", "impact_nodes": []}

    impact_nodes = get_impact(graph, target["id"])
    subgraph_text = format_node(target, repo_root=repo_root)
    impact_text = "\n".join(
        f"- {n['id']} (hops={n['hops']}, severity={n['severity']})" for n in impact_nodes
    ) or "(nothing depends on this node)"
    return {"target": target, "subgraph_text": subgraph_text, "impact_text": impact_text, "impact_nodes": impact_nodes}


def retrieve_for_bug_trace(graph, question: str, repo_root: str | None = None) -> dict:
    """Entry point is resolved the same way as an impact target: cheap name
    match against API_ROUTE/FUNCTION nodes. Traces forward over CALLS edges.
    """
    entry = resolve_target_node(graph, question)
    if entry is None:
        return {"entry": None, "subgraph_text": "(no matching entry point found)", "trace_text": "", "trace_nodes": []}

    trace_nodes = get_forward_trace(graph, entry["id"], edge_types=(EdgeType.CALLS,))
    trace_text = "\n\n".join(format_node(n, repo_root=repo_root) for n in trace_nodes)
    subgraph_text = format_node(entry, repo_root=repo_root)
    return {"entry": entry, "subgraph_text": subgraph_text, "trace_text": trace_text, "trace_nodes": trace_nodes}


def retrieve_for_general_qa(graph, question: str, repo_root: str | None = None, hops: int = 1) -> dict:
    seeds = find_nodes_by_name(graph, question, limit=3)
    seed_ids = [n["id"] for n in seeds]
    if not seed_ids:
        return {"subgraph_text": "(no matching nodes found for this question)", "node_ids": []}

    sub = get_subgraph(graph, seed_ids, hops=hops)
    node_blocks = [format_node(n, repo_root=repo_root) for n in sub["nodes"]]
    edge_lines = [f"{e['source']} --{e['type'].value if hasattr(e['type'], 'value') else e['type']}--> {e['target']}" for e in sub["edges"]]
    subgraph_text = "\n\n".join(node_blocks) + "\n\nEdges:\n" + ("\n".join(edge_lines) or "(none)")
    return {"subgraph_text": subgraph_text, "node_ids": [n["id"] for n in sub["nodes"]]}
