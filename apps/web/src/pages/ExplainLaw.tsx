import { useEffect, useState } from "react";
import { explainLaw, warmBackend } from "../api";
import { ResultView } from "../components/ResultView";
import { LivePreview, ProviderHint, useAiStream } from "./Ask";

export function ExplainLaw() {
  const [lawName, setLawName] = useState("");
  const [aspect, setAspect] = useState("");
  const { busy, streaming, liveText, error, result, setResult, callbacks, started, finished } = useAiStream();

  // Start waking the backend while the user is still typing.
  useEffect(() => {
    warmBackend();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lawName.trim() || busy) return;
    started();
    try {
      setResult(await explainLaw({ lawName: lawName.trim(), aspect: aspect.trim() || undefined }, callbacks));
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
          <span className="tool-emoji" aria-hidden="true">📖</span>
          <h2>Explain a law</h2>
        </div>
        <p style={{ color: "var(--text-dim)" }}>
          Any Indian statute, explained like a friend would — scope, key
          provisions, common traps.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="law">Name of the law</label>
          <input
            id="law"
            type="text"
            value={lawName}
            onChange={(e) => setLawName(e.target.value)}
            placeholder="e.g. Transfer of Property Act 1882"
            maxLength={300}
          />
          <label htmlFor="aspect">
            Particular aspect? <span className="hint">optional</span>
          </label>
          <input
            id="aspect"
            type="text"
            value={aspect}
            onChange={(e) => setAspect(e.target.value)}
            placeholder="e.g. rights of a tenant on eviction"
            maxLength={500}
          />
          <div className="btn-row">
            <button type="submit" disabled={busy || lawName.trim().length < 2}>
              {busy ? (
                <>
                  <span className="spinner" /> {streaming ? "Writing…" : "Explaining…"}
                </>
              ) : (
                "Explain"
              )}
            </button>
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
