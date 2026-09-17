import { useEffect, useState } from "react";
import { explainLaw, warmBackend, ApiError } from "../api";
import { ResultView } from "../components/ResultView";
import { ProviderHint } from "./Ask";
import type { AiResult } from "@unlawyered/shared";

export function ExplainLaw() {
  const [lawName, setLawName] = useState("");
  const [aspect, setAspect] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  // Start waking the backend while the user is still typing.
  useEffect(() => {
    warmBackend();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lawName.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await explainLaw({ lawName: lawName.trim(), aspect: aspect.trim() || undefined }));
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
                  <span className="spinner" /> Explaining…
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
      {result ? <ResultView result={result} /> : null}
    </div>
  );
}
