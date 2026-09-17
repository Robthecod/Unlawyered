/**
 * Review my document — plain-English document review.
 */
import { useState } from "react";
import { ApiError, reviewDocument, type UploadedDoc } from "../api";
import { DocumentUpload } from "../components/DocumentUpload";
import { ResultView } from "../components/ResultView";
import { ProviderHint } from "./Ask";
import type { AiResult } from "@unlawyered/shared";

export function ReviewDocument() {
  const [doc, setDoc] = useState<UploadedDoc | null>(null);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!doc || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await reviewDocument({
          document: { name: doc.name, text: doc.text },
          focus: focus.trim() || undefined,
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
          <span className="tool-emoji" aria-hidden="true">📄</span>
          <h2>Review my document</h2>
        </div>
        <p style={{ color: "var(--text-dim)" }}>
          What it says in plain English, what's one-sided, what's missing.
        </p>
        <DocumentUpload onUploaded={setDoc} />
        <label htmlFor="focus">
          Anything specific to look at? <span className="hint">optional</span>
        </label>
        <input
          id="focus"
          type="text"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="e.g. the notice period and the deposit clause"
          maxLength={500}
        />
        <div className="btn-row">
          <button type="button" onClick={submit} disabled={!doc || busy}>
            {busy ? (
              <>
                <span className="spinner" /> Reviewing…
              </>
            ) : (
              "Review document"
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
