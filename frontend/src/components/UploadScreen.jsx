import { useState } from "react";
import { api } from "../api";

export default function UploadScreen({ onReady }) {
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState("");

  async function loadDemoRepo() {
    setStatus("loading");
    try {
      await api.scan("demo_repo/");
      onReady();
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>RepoLens</h1>
        <p style={styles.subtitle}>
          Give it a repository. It builds a map of how the system fits
          together before it answers anything about it.
        </p>
        <button
          style={styles.button}
          onClick={loadDemoRepo}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Scanning repository…" : "Load demo repository"}
        </button>
        {status === "error" && (
          <p style={styles.error}>Couldn't scan the repo: {errorMsg}</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    maxWidth: 480,
    textAlign: "left",
    padding: "40px",
  },
  title: {
    fontFamily: "var(--font-mono)",
    fontSize: 32,
    margin: 0,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    color: "var(--text-muted)",
    lineHeight: 1.6,
    marginTop: 12,
    marginBottom: 28,
  },
  button: {
    background: "var(--accent-amber)",
    color: "#1a1305",
    border: "none",
    borderRadius: 6,
    padding: "12px 20px",
    fontWeight: 600,
    fontSize: 14,
  },
  error: {
    color: "var(--risk-critical)",
    marginTop: 16,
    fontSize: 13,
  },
};
