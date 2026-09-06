import { useMemo, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
} from "reactflow";
import dagre from "dagre";
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

// One color per edge type, encoded via color instead of an always-visible
// text label — labels on every edge is what produced the cluttered
// overlapping-pill-box look. A small legend (below) explains the colors
// once instead of repeating the word on every edge in the graph.
const EDGE_COLOR = {
  IMPORTS: "#5c6f8a",
  CALLS: "#3f7ab5",
  DEFINES: "#2a3a4d",
  INHERITS: "#8a5c9a",
  TESTS: "#3fb950",
  EXPOSES: "#d4b106",
};

const RISK_COLOR = {
  HIGH: "#e5484d",
  MEDIUM: "#d4b106",
  LOW: "#3fb950",
};

const NODE_HEIGHT = 40;

function estimateNodeWidth(label) {
  // Rough monospace char width at 12px — good enough for layout spacing;
  // real rendering wraps if it's ever off by a little.
  return Math.max(110, label.length * 7.5 + 32);
}

// Proper layered layout via dagre instead of the old manual BFS-depth
// column approach, which broke down (everything crammed into 1-2 columns,
// long vertical chains) once the real parser started producing graphs with
// more than a handful of nodes.
function layoutWithDagre(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 90, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((n) => {
    g.setNode(n.id, { width: estimateNodeWidth(n.name), height: NODE_HEIGHT });
  });
  edges.forEach((e) => {
    // DEFINES edges (file->function, class->method) are structural
    // containment, not data flow — including them in the layout graph
    // tends to drag unrelated branches together, so layout ignores them
    // and lets CALLS/IMPORTS/INHERITS/TESTS/EXPOSES drive positioning.
    if (e.type === "DEFINES") return;
    g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  const positions = new Map();
  nodes.forEach((n) => {
    const pos = g.node(n.id);
    if (pos) {
      positions.set(n.id, { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 });
    }
  });
  return positions;
}

export default function GraphView({ graph, highlightedIds, onNodeClick }) {
  const positions = useMemo(
    () => layoutWithDagre(graph.nodes, graph.edges),
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
            width: estimateNodeWidth(n.name),
            background: isHighlighted ? "var(--accent-amber-dim)" : TYPE_COLOR[n.type] || "#2a3a4d",
            border: isHighlighted
              ? "2px solid var(--accent-amber)"
              : "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            padding: "8px 10px",
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
        const baseColor = EDGE_COLOR[e.type] || "var(--border)";
        return {
          id: `e${i}-${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          // No text label by default — color alone carries edge type (see
          // legend). Only the actively-traced path gets a label, since
          // that's the one moment a word adds more than it clutters.
          label: bothHighlighted ? e.type : undefined,
          animated: bothHighlighted,
          style: {
            stroke: bothHighlighted ? "var(--accent-amber)" : baseColor,
            strokeWidth: bothHighlighted ? 2 : 1,
            opacity: bothHighlighted ? 1 : 0.55,
          },
          labelStyle: { fill: "var(--accent-amber)", fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: "var(--bg-panel)" },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: bothHighlighted ? "#f5a623" : baseColor,
          },
        };
      }),
    [graph.edges, highlightedIds]
  );

  const handleNodeClick = useCallback(
    (_, node) => onNodeClick?.(node.id),
    [onNodeClick]
  );

  return (
    <div style={{ position: "relative", height: "100%" }}>
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
      <EdgeLegend />
    </div>
  );
}

function EdgeLegend() {
  return (
    <div style={legendStyles.wrap}>
      {Object.entries(EDGE_COLOR).map(([type, color]) => (
        <div key={type} style={legendStyles.row}>
          <span style={{ ...legendStyles.swatch, background: color }} />
          {type}
        </div>
      ))}
    </div>
  );
}

const legendStyles = {
  wrap: {
    position: "absolute",
    bottom: 12,
    left: 12,
    background: "rgba(22,31,46,0.9)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 10,
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    zIndex: 5,
  },
  row: { display: "flex", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 3, borderRadius: 2, display: "inline-block" },
};

export { RISK_COLOR };
