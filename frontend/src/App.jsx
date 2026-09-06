import { useEffect, useState, useCallback } from "react";
import UploadScreen from "./components/UploadScreen";
import GraphView from "./components/GraphView";
import ChatPanel from "./components/ChatPanel";
import ImpactPanel from "./components/ImpactPanel";
import HealthDashboard from "./components/HealthDashboard";
import { api } from "./api";

export default function App() {
  const [screen, setScreen] = useState("upload"); // upload | workspace | health
  const [graph, setGraph] = useState(null);
  const [highlightedIds, setHighlightedIds] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  // Whatever node the conversation is currently "about" — set when a node
  // is clicked, and updated after every chat answer to whatever it talked
  // about, so a follow-up like "what's the risk here" has something to
  // resolve to even without the Impact panel open.
  const [contextNodeId, setContextNodeId] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const loadGraph = useCallback(() => {
    api
      .getGraph()
      .then(setGraph)
      .catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => {
    if (screen === "workspace" && !graph) loadGraph();
  }, [screen, graph, loadGraph]);

  const handleNodeClick = useCallback((id) => {
    setSelectedNodeId(id);
    setContextNodeId(id);
  }, []);

  const handleChatAnswer = useCallback((highlighted) => {
    setHighlightedIds(highlighted);
    if (highlighted?.length) setContextNodeId(highlighted[0]);
  }, []);

  if (screen === "upload") {
    return <UploadScreen onReady={() => setScreen("workspace")} />;
  }

  if (loadError) {
    return <div style={styles.error}>Couldn't load the graph: {loadError}</div>;
  }

  if (!graph) {
    return <div style={styles.loading}>Building system map…</div>;
  }

  return (
    <div style={styles.app}>
      <TopBar screen={screen} onNavigate={setScreen} />
      {screen === "workspace" && (
        <div style={styles.workspace}>
          <div style={styles.graphArea}>
            <GraphView
              graph={graph}
              highlightedIds={highlightedIds}
              onNodeClick={handleNodeClick}
            />
            {selectedNodeId && (
              <ImpactPanel
                nodeId={selectedNodeId}
                onClose={() => setSelectedNodeId(null)}
                onHighlight={setHighlightedIds}
              />
            )}
          </div>
          <ChatPanel onAnswer={handleChatAnswer} contextNodeId={contextNodeId} />
        </div>
      )}
      {screen === "health" && <HealthDashboard />}
    </div>
  );
}

function TopBar({ screen, onNavigate }) {
  return (
    <div style={styles.topBar}>
      <span style={styles.logo}>RepoLens</span>
      <div style={styles.nav}>
        <NavButton
          label="Workspace"
          active={screen === "workspace"}
          onClick={() => onNavigate("workspace")}
        />
        <NavButton
          label="System health"
          active={screen === "health"}
          onClick={() => onNavigate("health")}
        />
      </div>
    </div>
  );
}

function NavButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "var(--bg-panel-raised)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-muted)",
        border: "none",
        borderRadius: 6,
        padding: "6px 12px",
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );
}

const styles = {
  app: { display: "flex", flexDirection: "column", height: "100vh" },
  topBar: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    padding: "10px 16px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-panel)",
  },
  logo: { fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 15 },
  nav: { display: "flex", gap: 4 },
  workspace: { display: "flex", flex: 1, minHeight: 0 },
  graphArea: { flex: 1, position: "relative" },
  loading: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-muted)",
  },
  error: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--risk-critical)",
  },
};
