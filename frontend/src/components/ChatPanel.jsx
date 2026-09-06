import { useState, useRef, useEffect } from "react";
import { api } from "../api";

export default function ChatPanel({ onAnswer, contextNodeId }) {
  const [messages, setMessages] = useState([
    {
      role: "system",
      text: "Ask about the architecture, trace a bug, or check what breaks if you change something.",
    },
  ]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const question = input.trim();
    if (!question || asking) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setAsking(true);
    try {
      const res = await api.ask(question, contextNodeId);
      setMessages((m) => [...m, { role: "assistant", text: res.answer_text }]);
      onAnswer?.(res.highlighted_node_ids || []);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "error", text: `Couldn't get an answer: ${err.message}` },
      ]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div style={styles.panel}>
      {contextNodeId && (
        <div style={styles.contextBar}>
          <span style={styles.contextLabel}>Talking about</span>
          <span style={styles.contextValue}>{contextNodeId}</span>
        </div>
      )}
      <div style={styles.messages} ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} style={styles.bubble(m.role)}>
            {m.text}
          </div>
        ))}
        {asking && <div style={styles.bubble("system")}>Thinking…</div>}
      </div>
      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={input}
          placeholder="Ask RepoLens…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button style={styles.sendButton} onClick={send} disabled={asking}>
          Ask
        </button>
      </div>
    </div>
  );
}

const styles = {
  panel: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--bg-panel)",
    borderLeft: "1px solid var(--border)",
  },
  contextBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderBottom: "1px solid var(--border)",
    fontSize: 11,
    overflow: "hidden",
  },
  contextLabel: { color: "var(--text-muted)", whiteSpace: "nowrap" },
  contextValue: {
    fontFamily: "var(--font-mono)",
    color: "var(--accent-amber)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  bubble: (role) => ({
    alignSelf: role === "user" ? "flex-end" : "flex-start",
    maxWidth: "88%",
    background:
      role === "user"
        ? "var(--accent-amber-dim)"
        : role === "error"
        ? "rgba(229,72,77,0.15)"
        : "var(--bg-panel-raised)",
    border: `1px solid ${role === "error" ? "var(--risk-critical)" : "var(--border-soft)"}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    lineHeight: 1.5,
    color: "var(--text-primary)",
  }),
  inputRow: {
    display: "flex",
    gap: 8,
    padding: 12,
    borderTop: "1px solid var(--border)",
  },
  input: {
    flex: 1,
    background: "var(--bg-deep)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "10px 12px",
    color: "var(--text-primary)",
    fontFamily: "var(--font-ui)",
    fontSize: 13,
  },
  sendButton: {
    background: "var(--accent-amber)",
    color: "#1a1305",
    border: "none",
    borderRadius: 6,
    padding: "0 16px",
    fontWeight: 600,
    fontSize: 13,
  },
};
