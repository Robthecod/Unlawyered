/**
 * Ask page — the first AI feature wired end-to-end (UI side).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { askLegalQuestion, getProviders, ApiError } from "../api";
import { ResultView } from "../components/ResultView";
import type { AiResult } from "@unlawyered/shared";

export function Ask() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await askLegalQuestion({ question: question.trim() }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed. Is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="tool-head">
          <span className="tool-emoji" aria-hidden="true">💬</span>
          <h2>Ask a legal question</h2>
        </div>
        <p style={{ color: "var(--text-dim)" }}>
          Indian law, in plain English. The general rule, the exceptions, and
          what it might mean for you.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="q">Your question</label>
          <textarea
            id="q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Can my landlord keep my deposit for repainting the walls in Bengaluru?"
            maxLength={5000}
          />
          <div className="btn-row">
            <button type="submit" disabled={busy || question.trim().length < 3}>
              {busy ? (
                <>
                  <span className="spinner" /> Thinking…
                </>
              ) : (
                "Ask"
              )}
            </button>
            <span className="status" style={{ color: "var(--text-dim)" }}>
              Legal information, not advice.
            </span>
          </div>
        </form>
      </div>

      <ProviderHint />

      {error ? <div className="error-box">{error}</div> : null}
      {result ? <ResultView result={result} /> : null}
    </div>
  );
}

/** Shown only when no real provider is configured; nudges the user to Settings. */
export function ProviderHint() {
  const [mockMode, setMockMode] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    getProviders()
      .then((r) => {
        if (alive) setMockMode(!r.selected || r.selected === "mock");
      })
      .catch(() => alive && setMockMode(false));
    return () => {
      alive = false;
    };
  }, []);

  if (mockMode === null || !mockMode) return null;
  return (
    <div className="provider-warn">
      Running on the <strong>Mock</strong> provider (no key configured). Answers
      are placeholders.{" "}
      <Link to="/settings">Add a Gemini / OpenAI / Anthropic key in Settings →</Link>
    </div>
  );
}
