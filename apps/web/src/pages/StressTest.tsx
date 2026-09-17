/**
 * Stress-test my contract — adversarial clause-by-clause analysis.
 */
import { useEffect, useState } from "react";
import { ApiError, stressTestContract, warmBackend, type UploadedDoc } from "../api";
import { DocumentUpload } from "../components/DocumentUpload";
import { ResultView } from "../components/ResultView";
import { ProviderHint } from "./Ask";
import type { AiResult } from "@unlawyered/shared";

export function StressTest() {
  const [doc, setDoc] = useState<UploadedDoc | null>(null);
  const [side, setSide] = useState<"my" | "other">("my");
  const [concern, setConcern] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  // Start waking the backend while the user is still choosing a file.
  useEffect(() => {
    warmBackend();
  }, []);

  async function submit() {
    if (!doc || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await stressTestContract({
          document: { name: doc.name, text: doc.text },
          side,
          concern: concern.trim() || undefined,
        }),
      );
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
          <span className="tool-emoji" aria-hidden="true">🔥</span>
          <h2>Stress-test my contract</h2>
        </div>
        <p style={{ color: "var(--text-dim)" }}>
          How could each clause be used against you? Adversarial analysis with
          suggested redrafts.
        </p>
        <DocumentUpload onUploaded={setDoc} />
        <label htmlFor="side">Stress-test from whose perspective?</label>
        <select id="side" value={side} onChange={(e) => setSide(e.target.value as "my" | "other")}>
          <option value="my">My side (the party uploading)</option>
          <option value="other">The other side (counterparty)</option>
        </select>
        <label htmlFor="concern">
          Especially worried about? <span className="hint">optional</span>
        </label>
        <input
          id="concern"
          type="text"
          value={concern}
          onChange={(e) => setConcern(e.target.value)}
          placeholder="e.g. the termination clause"
          maxLength={500}
        />
        <div className="btn-row">
          <button type="button" onClick={submit} disabled={!doc || busy}>
            {busy ? (
              <>
                <span className="spinner" /> Stress-testing…
              </>
            ) : (
              "Stress-test"
            )}
          </button>
        </div>
      </div>

      <ProviderHint />
      {error ? <div className="error-box">{error}</div> : null}
      {result ? <ResultView result={result} /> : null}
    </div>
  );
}
