import { useMemo, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

const TYPE_COLOR = {
  FILE: "#3a4a5c",
  CLASS: "#5c6f8a",
  FUNCTION: "#2a3a4d",
  MODULE: "#3a4a5c",
  API_ROUTE: "#3f5b7a",
  EXTERNAL_SERVICE: "#6b4a2a",
  TEST: "#2a4a3a",
  CONFIG: "#4a3a5c",
};

const RISK_COLOR = {
  HIGH: "#e5484d",
  MEDIUM: "#d4b106",
  LOW: "#3fb950",
};

// Simple deterministic layered layout: BFS depth from FILE-import roots
// determines the x column, sibling order determines y. Good enough for a
// few dozen nodes — swap for dagre/elk if the real repo graph gets large.
function layoutNodes(nodes, edges) {
  const importEdges = edges.filter((e) => e.type === "IMPORTS");
  const incoming = new Map(nodes.map((n) => [n.id, 0]));
  importEdges.forEach((e) => {
    incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
  });

  const depth = new Map();
  const roots = nodes.filter((n) => (incoming.get(n.id) || 0) === 0);
  const queue = roots.map((n) => ({ id: n.id, d: 0 }));
  const visited = new Set();

  while (queue.length) {
    const { id, d } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    depth.set(id, Math.max(depth.get(id) || 0, d));
    edges
      .filter((e) => e.source === id)
      .forEach((e) => queue.push({ id: e.target, d: d + 1 }));
  }
  nodes.forEach((n) => {
    if (!depth.has(n.id)) depth.set(n.id, 0);
  });

  const columns = new Map();
  nodes.forEach((n) => {
    const d = depth.get(n.id);
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d).push(n.id);
  });

  const positions = new Map();
  columns.forEach((ids, d) => {
    ids.forEach((id, i) => {
      positions.set(id, { x: d * 260, y: i * 110 });
    });
  });
  return positions;
}

export default function GraphView({ graph, highlightedIds, onNodeClick }) {
  const positions = useMemo(
    () => layoutNodes(graph.nodes, graph.edges),
    [graph]
  );

  const flowNodes = useMemo(
    () =>
      graph.nodes.map((n) => {
        const isHighlighted = highlightedIds?.includes(n.id);
        return {
          id: n.id,
          position: positions.get(n.id) || { x: 0, y: 0 },
          data: { label: n.name, nodeType: n.type },
          style: {
            background: isHighlighted ? "var(--accent-amber-dim)" : TYPE_COLOR[n.type] || "#2a3a4d",
            border: isHighlighted
              ? "2px solid var(--accent-amber)"
              : "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            padding: "8px 12px",
            boxShadow: isHighlighted ? "0 0 0 4px rgba(245,166,35,0.15)" : "none",
          },
        };
      }),
    [graph.nodes, positions, highlightedIds]
  );

  const flowEdges = useMemo(
    () =>
      graph.edges.map((e, i) => {
        const bothHighlighted =
          highlightedIds?.includes(e.source) && highlightedIds?.includes(e.target);
        return {
          id: `e${i}-${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          label: e.type,
          animated: bothHighlighted,
          style: {
            stroke: bothHighlighted ? "var(--accent-amber)" : "var(--border)",
            strokeWidth: bothHighlighted ? 2 : 1,
          },
          labelStyle: { fill: "var(--text-muted)", fontSize: 10 },
          markerEnd: { type: MarkerType.ArrowClosed, color: bothHighlighted ? "#f5a623" : "#2a3a4d" },
        };
      }),
    [graph.edges, highlightedIds]
  );

  const handleNodeClick = useCallback(
    (_, node) => onNodeClick?.(node.id),
    [onNodeClick]
  );

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      onNodeClick={handleNodeClick}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#1c2733" gap={20} />
      <Controls showInteractive={false} />
      <MiniMap
        maskColor="rgba(11,18,32,0.85)"
        nodeColor={(n) => TYPE_COLOR[n.data?.nodeType] || "#2a3a4d"}
        style={{ background: "var(--bg-panel)" }}
      />
    </ReactFlow>
  );
}

export { RISK_COLOR };
