/**
 * Ask page — the first AI feature wired end-to-end (UI side).
 * Streams the answer live: text appears as the model writes it, then swaps
 * to the fully rendered result (sources panel, badges) on done.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { askLegalQuestion, getProviders, warmBackend, ApiError, type StreamCallbacks } from "../api";
import { ResultView } from "../components/ResultView";
import { Markdown } from "../components/Markdown";
import type { AiResult } from "@unlawyered/shared";

/**
 * Shared streaming state for all five tool pages. Holds the growing live
 * preview text while the model writes; the final AiResult (with parsed
 * sources) replaces it on completion.
 */
export function useAiStream() {
  const [busy, setBusy] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  const callbacks: StreamCallbacks = {
    onDelta: (text) => {
      setStreaming(true);
      setLiveText((prev) => prev + text);
    },
  };

  const reset = () => {
    setLiveText("");
    setStreaming(false);
    setError(null);
    setResult(null);
  };

  const started = () => {
    setBusy(true);
    reset();
  };

  const finished = (err: unknown) => {
    if (err instanceof ApiError) setError(err.message);
    else if (err) setError("Request failed. Is the backend running?");
    setBusy(false);
    setStreaming(false);
  };

  return { busy, streaming, liveText, error, result, setResult, callbacks, started, finished, reset };
}

/** Live preview shown while the answer streams in. */
export function LivePreview({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <div className="result" style={{ marginTop: "1.4rem" }}>
      <div className="result-meta">
        <span className="badge">streaming…</span>
      </div>
      <div className="result-body live-preview">
        <Markdown text={text || "…"} sourcesCount={0} />
        {streaming ? <span className="stream-cursor" aria-hidden="true" /> : null}
      </div>
    </div>
  );
}

export function Ask() {
  const [question, setQuestion] = useState("");
  const { busy, streaming, liveText, error, result, setResult, callbacks, started, finished } = useAiStream();

  // Start waking the backend while the user is still typing.
  useEffect(() => {
    warmBackend();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    started();
    try {
      setResult(await askLegalQuestion({ question: question.trim() }, callbacks));
    } catch (err) {
      finished(err);
      return;
    }
    finished(null);
  }

  const showPreview = busy && (streaming || liveText.length === 0);

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
                  <span className="spinner" /> {streaming ? "Writing…" : "Thinking…"}
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
      {showPreview ? <LivePreview text={liveText} streaming={streaming} /> : null}
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
