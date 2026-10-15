"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const LABELS = { critical: "Incident", warning: "Degraded", ok: "Healthy" };

const SCENARIOS = [
  { id: "healthy", label: "Healthy", hint: "Everything works" },
  { id: "cart_down", label: "Cart service down", hint: "Cart dependency can't be reached" },
  { id: "db_down", label: "Database down", hint: "Database address doesn't exist" },
  { id: "slow", label: "Slow response", hint: "Add to cart takes 4–6 s" },
];

// Demo control: switches the service's SCENARIO. The agent never sees this.
function FaultSimulator() {
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function call(init) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/scenario", init);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
      setCurrent(data.scenario);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { call(); }, []);

  function choose(scenario) {
    call({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario }) });
  }

  return (
    <div className="card">
      <h2>Fault simulator</h2>
      <p className="sub sim-sub">Turn on a fault, try Add to cart in the shop, then click Investigate.</p>
      <div className="sim-options">
        {SCENARIOS.map((s) => (
          <button key={s.id} className={`sim-option ${current === s.id ? "active" : ""}`}
            onClick={() => choose(s.id)} disabled={busy}>
            <b>{s.label}</b>
            <span>{s.hint}</span>
          </button>
        ))}
      </div>
      {error && <p className="sim-error">Couldn&apos;t reach the service: {error}</p>}
    </div>
  );
}

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState([]);

  // The route streams one JSON event per line: tool_called, tool_output, report or error.
  function handleEvent(event) {
    if (event.type === "tool_called") setProgress((p) => [...p, event.tool]);
    if (event.type === "report") { setReport(event.report); setLoading(false); }
    if (event.type === "error") { setError(event.message); setLoading(false); }
  }

  async function investigate() {
    setLoading(true);
    setReport(null);
    setError(null);
    setProgress([]);
    try {
      const res = await fetch("/api/investigation", { method: "POST" });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) if (line.trim()) handleEvent(JSON.parse(line));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const severity = LABELS[report?.severity] ? report.severity : "warning";

  return (
    <main className="wrap">
      <Link href="/" className="back">← Back to shop</Link>
      <header>
        <div>
          <h1>Incident Investigator</h1>
          <p className="sub">An AI agent probes the service with its tools and reports what is wrong.</p>
        </div>
        <button className="primary" onClick={investigate} disabled={loading}>
          {loading ? "Investigating…" : "Investigate"}
        </button>
      </header>

      <FaultSimulator />

      {loading && (
        <div className="card empty">
          The agent is investigating the service…
          {progress.length > 0 && <p>Called: {progress.join(", ")}</p>}
        </div>
      )}

      {!loading && !report && !error && (
        <div className="card empty">Press <b>Investigate</b> to start.</div>
      )}

      {error && (
        <div className="card error">
          <h2>Investigation failed</h2>
          <p>{error}</p>
        </div>
      )}

      {report && (
        <>
          <div className={`card verdict ${severity}`}>
            <span className="badge">{LABELS[severity]}</span>
            <h3>{report.title || report.verdict}</h3>
            <span className="code">{report.verdict}</span>
            <p>{report.summary}</p>
          </div>

          <div className="card">
            <h2>Evidence</h2>
            <ul className="evidence">
              {(report.evidence || []).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>

          <div className="card">
            <h2>Next step</h2>
            <div className="next">{report.nextStep}</div>
          </div>

          {report.agents && (
            <div className="card">
              <h2>Agents</h2>
              <div className="agents">
                <div className="agent">
                  <b>1 · Investigator</b>
                  <p>{report.agents.investigator?.findings}</p>
                </div>
                <div className="agent">
                  <b>2 · Decision maker</b>
                  <p>{report.agents.decider?.decision}</p>
                </div>
              </div>
            </div>
          )}

          {report.toolCalls?.length > 0 && (
            <div className="card">
              <h2>Tool calls</h2>
              {report.toolCalls.map((c, i) => (
                <details className="tool" key={i}>
                  <summary>{c.tool}</summary>
                  <pre>{typeof c.result === "string" ? c.result : JSON.stringify(c.result, null, 2)}</pre>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
