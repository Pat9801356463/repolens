"""
graph/builder.py

Phase 5 integration note: Phase 2's original analysis.py and Phase 3's
ai/retriever.py were both built in parallel against slightly different
imagined shapes of the graph engine (classic hackathon contract drift,
even with Phase 0's schema frozen). This module + graph/analysis.py are
the reconciled version: Phase 3's ai/ package is the one with the most
code depending on it (retriever.py, pipeline.py, tests), so integration
adopted *its* function signatures as the real contract, re-implemented
here for real correctness (dangling-edge tolerance, no duplicate-node
crashes, real caching to disk).

Output: a networkx.MultiDiGraph. Every Node/Edge dataclass field is
stored as a graph attribute so nothing needs re-parsing downstream.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

import networkx as nx

from graph.schema import Edge, Node


def build_graph(nodes: Iterable[Node], edges: Iterable[Edge]) -> nx.MultiDiGraph:
    """Build a NetworkX MultiDiGraph from Node/Edge dataclass lists.

    MultiDiGraph (not DiGraph) because a single (source, target) pair can
    legitimately carry more than one edge type — e.g. a class both
    IMPORTS and later INHERITS from something in the same file.
    """
    g = nx.MultiDiGraph()

    for node in nodes:
        # Phase 1's extractor can, in theory, emit the same id twice across
        # different files only if extraction goes wrong; tolerate it by
        # keeping the first occurrence rather than crashing a live demo.
        if not g.has_node(node.id):
            g.add_node(
                node.id,
                type=node.type,
                name=node.name,
                file=node.file,
                line_start=node.line_start,
                line_end=node.line_end,
                metadata=node.metadata,
            )

    dangling = []
    for edge in edges:
        if edge.source not in g or edge.target not in g:
            # An edge pointing at a node we don't have (bad resolution,
            # partial scan, etc.) never takes down the whole build.
            dangling.append(edge)
            continue
        g.add_edge(edge.source, edge.target, type=edge.type, metadata=edge.metadata)

    if dangling:
        g.graph["dangling_edges"] = [
            {"source": e.source, "target": e.target, "type": e.type.value}
            for e in dangling
        ]

    return g


def load_graph_from_json(path: str | Path) -> nx.MultiDiGraph:
    """Load a graph from a JSON file matching graph/schema.py's shape —
    fixtures/sample_graph.json, storage/graph_cache.json, or Phase 1's
    real extractor output dumped to disk. Same function for all three.
    """
    data = json.loads(Path(path).read_text())
    nodes = [Node.from_dict(n) for n in data["nodes"]]
    edges = [Edge.from_dict(e) for e in data["edges"]]
    return build_graph(nodes, edges)


def to_node_edge_dicts(g: nx.MultiDiGraph) -> dict:
    """Serialize a built graph back to the plain node/edge JSON shape used
    by GET /graph and storage/graph_cache.json."""
    nodes = []
    for node_id, attrs in g.nodes(data=True):
        node = Node(
            id=node_id,
            type=attrs["type"],
            name=attrs["name"],
            file=attrs["file"],
            line_start=attrs["line_start"],
            line_end=attrs["line_end"],
            metadata=attrs.get("metadata", {}),
        )
        nodes.append(node.to_dict())

    edges = []
    for source, target, attrs in g.edges(data=True):
        edge = Edge(source=source, target=target, type=attrs["type"], metadata=attrs.get("metadata", {}))
        edges.append(edge.to_dict())

    return {"nodes": nodes, "edges": edges}


def save_graph_cache(g: nx.MultiDiGraph, path: str | Path) -> None:
    Path(path).write_text(json.dumps(to_node_edge_dicts(g), indent=2))
