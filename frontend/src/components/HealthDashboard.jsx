import { useEffect, useState } from "react";
import { api } from "../api";

export default function HealthDashboard() {
  const [health, setHealth] = useState(null);
  const [testgen, setTestgen] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getHealth().then(setHealth).catch((e) => setError(e.message));
  }, []);

  if (error) return <div style={styles.error}>Couldn't load health data: {error}</div>;
  if (!health) return <div style={styles.loading}>Loading system health…</div>;

  return (
    <div style={styles.wrap}>
      <h2 style={styles.heading}>System health</h2>
      <div style={styles.grid}>
        <ScoreCard label="Architecture" value={`${health.architecture_score}/100`} />
        <ScoreCard label="Maintainability" value={`${health.maintainability_score}/100`} />
        <ScoreCard
          label="Test coverage"
          value={`${Math.round(health.test_coverage * 100)}%`}
        />
        <ScoreCard
          label="Critical risks"
          value={health.critical_risks}
          tone={health.critical_risks > 0 ? "risk" : "ok"}
        />
        <ScoreCard
          label="Circular dependencies"
          value={health.circular_dependencies}
          tone={health.circular_dependencies > 0 ? "risk" : "ok"}
        />
        <ScoreCard
          label="High-coupling modules"
          value={health.high_coupling_count}
          tone={health.high_coupling_count > 0 ? "risk" : "ok"}
        />
      </div>

      <button
        style={styles.testgenButton}
        onClick={() =>
          api.runTestgen("services/payment.py::PaymentService").then(setTestgen)
        }
      >
        Generate tests for PaymentService
      </button>

      {testgen && (
        <div style={styles.testgenResult}>
          <div style={styles.testgenRow}>
            <span>Generated: {testgen.generated_count}</span>
            <span style={{ color: "var(--pass-green)" }}>Passed: {testgen.passed}</span>
            <span style={{ color: "var(--risk-critical)" }}>Failed: {testgen.failed}</span>
          </div>
          <div style={styles.coverageRow}>
            Coverage: {Math.round(testgen.coverage_before * 100)}% →{" "}
            <strong>{Math.round(testgen.coverage_after * 100)}%</strong>
          </div>
          <div style={styles.testList}>
            {testgen.test_names.map((t) => (
              <div key={t} style={styles.testItem}>
                {t}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, value, tone }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div
        style={{
          ...styles.cardValue,
          color:
            tone === "risk"
              ? "var(--risk-critical)"
              : tone === "ok"
              ? "var(--pass-green)"
              : "var(--text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const styles = {
  wrap: { padding: 32, maxWidth: 760 },
  heading: { fontFamily: "var(--font-mono)", fontSize: 20, marginBottom: 20 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 28,
  },
  card: {
    background: "var(--bg-panel)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 16,
  },
  cardLabel: { fontSize: 12, color: "var(--text-muted)", marginBottom: 6 },
  cardValue: { fontSize: 26, fontWeight: 600, fontFamily: "var(--font-mono)" },
  testgenButton: {
    background: "var(--accent-amber)",
    color: "#1a1305",
    border: "none",
    borderRadius: 6,
    padding: "10px 16px",
    fontWeight: 600,
    fontSize: 13,
  },
  testgenResult: {
    marginTop: 20,
    background: "var(--bg-panel)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 16,
  },
  testgenRow: { display: "flex", gap: 20, fontSize: 13, marginBottom: 10 },
  coverageRow: { fontSize: 13, marginBottom: 12, color: "var(--text-muted)" },
  testList: { display: "flex", flexDirection: "column", gap: 4 },
  testItem: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--text-primary)",
  },
  loading: { padding: 32, color: "var(--text-muted)" },
  error: { padding: 32, color: "var(--risk-critical)" },
};
