import { useEffect, useState } from "react";
import { api } from "../api";

const RISK_COLOR = {
  HIGH: "var(--risk-critical)",
  MEDIUM: "var(--risk-medium)",
  LOW: "var(--pass-green)",
};

export default function ImpactPanel({ nodeId, onClose, onHighlight }) {
  const [impact, setImpact] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setImpact(null);
    setLoadError(null);
    api
      .getImpact(nodeId)
      .then((res) => {
        if (cancelled) return;
        setImpact(res);
        onHighlight?.([
          nodeId,
          ...res.direct_dependents,
          ...res.indirect_dependents,
        ]);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  return (
    <div style={styles.drawer}>
      <div style={styles.header}>
        <span style={styles.title}>Impact analysis</span>
        <button style={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>
      <div style={styles.nodeId}>{nodeId}</div>

      {loadError && <div style={styles.error}>{loadError}</div>}

      {impact && (
        <div style={styles.body}>
          <div style={styles.riskRow}>
            <span
              style={{
                ...styles.riskBadge,
                background: RISK_COLOR[impact.risk_level] || "var(--border)",
              }}
            >
              {impact.risk_level} RISK
            </span>
          </div>

          <p style={styles.summary}>{impact.summary_text}</p>

          <Section title={`Direct dependents (${impact.direct_dependents.length})`}>
            {impact.direct_dependents.map((id) => (
              <div key={id} style={styles.item}>
                {id}
              </div>
            ))}
          </Section>

          {impact.indirect_dependents.length > 0 && (
            <Section
              title={`Indirect dependents (${impact.indirect_dependents.length})`}
            >
              {impact.indirect_dependents.map((id) => (
                <div key={id} style={styles.item}>
                  {id}
                </div>
              ))}
            </Section>
          )}

          <Section title={`Affected tests (${impact.affected_tests.length})`}>
            {impact.affected_tests.map((id) => (
              <div key={id} style={styles.item}>
                {id}
              </div>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

const styles = {
  drawer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 320,
    background: "var(--bg-panel)",
    borderLeft: "1px solid var(--border)",
    padding: 16,
    overflowY: "auto",
    zIndex: 10,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontWeight: 600, fontSize: 14 },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    fontSize: 14,
  },
  nodeId: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: "var(--text-muted)",
    marginTop: 4,
    wordBreak: "break-all",
  },
  error: { color: "var(--risk-critical)", marginTop: 16, fontSize: 13 },
  body: { marginTop: 8 },
  riskRow: { marginBottom: 4 },
  riskBadge: {
    display: "inline-block",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 700,
    color: "#1a0505",
  },
  summary: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "var(--text-primary)",
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginBottom: 6,
    textTransform: "none",
  },
  item: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    padding: "6px 8px",
    background: "var(--bg-panel-raised)",
    borderRadius: 4,
    marginBottom: 4,
    wordBreak: "break-all",
  },
};
