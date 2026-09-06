"""
graph/analysis.py

Phase 5 integration note: this reconciles two versions of the graph
engine that were built in parallel:

  - Phase 2's original analysis.py (get_impact/get_subgraph returning
    graph-shaped objects, find_cycles restricted to IMPORTS edges)
  - Phase 3's ai/retriever.py + tests/test_pipeline.py, which were built
    against a richer stand-in (graph/schema-compatible dicts everywhere,
    plus get_node/find_nodes_by_name/get_forward_trace/load_graph_from_json
    that Phase 2's version never had)

Phase 3 has the most real, tested code depending on a specific shape, so
that shape is what's implemented for real here. `build_graph` and
`load_graph_from_json` live in graph/builder.py and are re-exported below
so `from graph.analysis import load_graph_from_json` (as Phase 3's own
tests do) keeps working without changes.
"""
from __future__ import annotations

from typing import Iterable

import networkx as nx

from graph.builder import build_graph, load_graph_from_json  # noqa: F401  (re-exported)
from graph.schema import EdgeType

DEFAULT_IMPACT_EDGE_TYPES = (EdgeType.CALLS, EdgeType.IMPORTS)
DEFAULT_TRACE_EDGE_TYPES = (EdgeType.CALLS,)


def get_node(graph: nx.MultiDiGraph, node_id: str) -> dict | None:
    """A single node's attributes as a plain dict, id included."""
    if node_id not in graph.nodes:
        return None
    attrs = dict(graph.nodes[node_id])
    attrs["id"] = node_id
    return attrs


def all_nodes(graph: nx.MultiDiGraph) -> list[dict]:
    return [get_node(graph, nid) for nid in graph.nodes]


def find_nodes_by_name(graph: nx.MultiDiGraph, query: str, limit: int = 5) -> list[dict]:
    """Cheap name/keyword matching against node names and ids — no
    embeddings needed per blueprint §5 ("graph retrieval alone covers 80%
    of your demo questions"). Scores substring hits highest, then token
    overlap, so "process_payment" and "what happens during a payment"
    both land on the same node.
    """
    query_lower = query.lower()
    query_tokens = set(query_lower.replace("_", " ").replace(".", " ").replace("/", " ").split())

    scored = []
    for nid in graph.nodes:
        name = str(graph.nodes[nid].get("name", "")).lower()
        node_id_lower = nid.lower()
        score = 0
        if query_lower and (query_lower in name or query_lower in node_id_lower):
            score += 3
        name_tokens = set(name.replace("_", " ").split())
        id_tokens = set(node_id_lower.replace("_", " ").replace("/", " ").replace("::", " ").replace(".", " ").split())
        score += len(query_tokens & name_tokens) + len(query_tokens & id_tokens)
        if score > 0:
            scored.append((score, nid))

    scored.sort(key=lambda x: -x[0])
    return [get_node(graph, nid) for _, nid in scored[:limit]]


def get_impact(
    graph: nx.MultiDiGraph,
    node_id: str,
    edge_types: Iterable[EdgeType] = DEFAULT_IMPACT_EDGE_TYPES,
    max_hops: int = 4,
) -> list[dict]:
    """Reverse BFS: who depends on `node_id` — "what breaks if I change X".

    Returns node dicts (as from get_node) each annotated with `hops` and a
    `severity` of "high" (hop 1) / "medium" (hop 2) / "low" (hop 3+),
    ordered nearest-first, matching the graph overlay's red/orange/yellow
    plan (blueprint §6). Returns [] for an unknown node id rather than
    raising — a fuzzy retrieval match in Phase 3 should degrade, not crash
    the request.
    """
    if node_id not in graph.nodes:
        return []

    edge_type_set = set(edge_types)
    rev = graph.reverse(copy=False)

    visited = {node_id: 0}
    frontier = [node_id]
    hop = 0
    while frontier and hop < max_hops:
        hop += 1
        next_frontier = []
        for cur in frontier:
            for _, pred, data in rev.edges(cur, data=True):
                if data.get("type") not in edge_type_set:
                    continue
                if pred not in visited:
                    visited[pred] = hop
                    next_frontier.append(pred)
        frontier = next_frontier

    def severity(h: int) -> str:
        if h <= 1:
            return "high"
        if h <= 2:
            return "medium"
        return "low"

    results = []
    for nid, h in visited.items():
        if nid == node_id:
            continue
        node = get_node(graph, nid)
        node["hops"] = h
        node["severity"] = severity(h)
        results.append(node)
    results.sort(key=lambda n: n["hops"])
    return results


def get_forward_trace(
    graph: nx.MultiDiGraph,
    node_id: str,
    edge_types: Iterable[EdgeType] = DEFAULT_TRACE_EDGE_TYPES,
    max_hops: int = 5,
) -> list[dict]:
    """Forward trace from an entry point (e.g. an API route) following
    CALLS edges, in BFS/execution order — feeds the bug_trace prompt.
    """
    if node_id not in graph.nodes:
        return []

    edge_type_set = set(edge_types)
    visited = {node_id: 0}
    order = [node_id]
    frontier = [node_id]
    hop = 0
    while frontier and hop < max_hops:
        hop += 1
        next_frontier = []
        for cur in frontier:
            for _, succ, data in graph.edges(cur, data=True):
                if data.get("type") not in edge_type_set:
                    continue
                if succ not in visited:
                    visited[succ] = hop
                    order.append(succ)
                    next_frontier.append(succ)
        frontier = next_frontier

    return [get_node(graph, nid) for nid in order]


def get_subgraph(graph: nx.MultiDiGraph, node_ids: list[str], hops: int = 1) -> dict:
    """N-hop ego subgraph around seed nodes, expanded in both directions
    (undirected), for the general_qa retrieval path (blueprint §5).
    Unknown seed ids are dropped rather than raising.

    Returns {"nodes": [node dict, ...], "edges": [{"source","target","type","metadata"}, ...]}
    — plain dicts, ready to format into a prompt or hand back as
    highlighted_node_ids.
    """
    undirected = graph.to_undirected(as_view=True)
    included: set[str] = set()
    for nid in node_ids:
        if nid not in graph.nodes:
            continue
        ego = nx.ego_graph(undirected, nid, radius=hops)
        included.update(ego.nodes)

    sub_nodes = [get_node(graph, nid) for nid in included]
    sub_edges = []
    for u, v, data in graph.edges(data=True):
        if u in included and v in included:
            sub_edges.append({"source": u, "target": v, "type": data.get("type"), "metadata": data.get("metadata", {})})
    return {"nodes": sub_nodes, "edges": sub_edges}


def find_cycles(graph: nx.MultiDiGraph) -> list[list[str]]:
    """Circular dependency detection (Architecture Risk Detector — cut from
    the live demo per blueprint §0, but left in: it's cheap, and backs the
    'circular_dependencies' number on the System Health dashboard).
    """
    simple = nx.DiGraph()
    simple.add_nodes_from(graph.nodes)
    simple.add_edges_from(graph.edges())
    return [cycle for cycle in nx.simple_cycles(simple) if len(cycle) > 1]


# ---------------------------------------------------------------------------
# Phase 5 additions: response-shaping helpers for main.py's API endpoints.
# Kept here (not in main.py) so they're testable alongside the rest of the
# graph engine, and so main.py stays a thin wiring layer per its own
# blueprint contract.
# ---------------------------------------------------------------------------

def direct_dependents(graph: nx.MultiDiGraph, node_id: str) -> list[str]:
    """Nodes with a direct CALLS/IMPORTS edge INTO node_id."""
    if node_id not in graph.nodes:
        return []
    out = []
    for pred in graph.predecessors(node_id):
        edge_datas = graph.get_edge_data(pred, node_id).values()
        if any(d.get("type") in DEFAULT_IMPACT_EDGE_TYPES for d in edge_datas):
            out.append(pred)
    return out


def affected_tests(graph: nx.MultiDiGraph, node_id: str) -> list[str]:
    """Nodes with a TESTS edge INTO node_id."""
    if node_id not in graph.nodes:
        return []
    out = []
    for pred in graph.predecessors(node_id):
        edge_datas = graph.get_edge_data(pred, node_id).values()
        if any(d.get("type") == EdgeType.TESTS for d in edge_datas):
            out.append(pred)
    return out


def build_impact_report(graph: nx.MultiDiGraph, node_id: str) -> dict | None:
    """Assembles the exact shape GET /impact/{node_id} returns per
    api_spec.md. Returns None if node_id isn't in the graph (caller turns
    that into a 404).

    risk_level buckets on direct-dependent count, matching the demo's
    mock server exactly (HIGH >=2 direct dependents, MEDIUM ==1, LOW ==0)
    so the frontend's risk coloring behaves identically pre- and
    post-integration.
    """
    if node_id not in graph.nodes:
        return None

    impact = get_impact(graph, node_id)
    direct = [n["id"] for n in impact if n["hops"] == 1]
    indirect = [n["id"] for n in impact if n["hops"] > 1]
    tests = affected_tests(graph, node_id)

    if len(direct) >= 2:
        risk_level = "HIGH"
    elif len(direct) == 1:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    node = get_node(graph, node_id)
    name = node.get("name", node_id) if node else node_id
    summary_text = (
        f"{len(direct) + len(indirect)} component(s) and {len(tests)} test(s) depend on {name}. "
        f"Changing it directly affects: {', '.join(direct) if direct else 'nothing else in the graph'}."
    )

    return {
        "target_node_id": node_id,
        "risk_level": risk_level,
        "direct_dependents": direct,
        "indirect_dependents": indirect,
        "affected_tests": tests,
        "summary_text": summary_text,
    }


def compute_health(graph: nx.MultiDiGraph) -> dict:
    """Backs GET /health. Mixes real computed metrics (cycles, coupling)
    with reasonable placeholder scores, per blueprint §6's explicit
    allowance ("doesn't need to be fully live").
    """
    cycles = find_cycles(graph)

    # "High coupling" = a node with an unusually large number of direct
    # dependents — more than 3 callers/importers is a rough, cheap proxy.
    high_coupling = 0
    for node_id in graph.nodes:
        if len(direct_dependents(graph, node_id)) > 3:
            high_coupling += 1

    critical_risks = len(cycles) + high_coupling

    node_count = graph.number_of_nodes() or 1
    # Simple, defensible placeholder scoring: start at 100, dock points
    # for real problems found. Never goes below 40 so a small/clean demo
    # repo doesn't look broken.
    architecture_score = max(40, 100 - 10 * len(cycles) - 3 * high_coupling)
    maintainability_score = max(40, 95 - int(200 * len(cycles) / node_count) - 2 * high_coupling)

    return {
        "architecture_score": architecture_score,
        "maintainability_score": maintainability_score,
        "test_coverage": 0.82,  # placeholder until testgen's real coverage.py run replaces it
        "critical_risks": critical_risks,
        "circular_dependencies": len(cycles),
        "high_coupling_count": high_coupling,
    }
