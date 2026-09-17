/**
 * Cross-check a document against Indian law, with citations.
 */
import { useState } from "react";
import { ApiError, crossCheckDocument, type UploadedDoc } from "../api";
import { DocumentUpload } from "../components/DocumentUpload";
import { ResultView } from "../components/ResultView";
import { ProviderHint } from "./Ask";
import type { AiResult } from "@unlawyered/shared";

export function CrossCheck() {
  const [doc, setDoc] = useState<UploadedDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  async function submit() {
    if (!doc || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await crossCheckDocument({
          document: { name: doc.name, text: doc.text },
          jurisdiction: "India",
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
          <span className="tool-emoji" aria-hidden="true">⚖️</span>
          <h2>Cross-check against Indian law</h2>
        </div>
        <p style={{ color: "var(--text-dim)" }}>
          Each clause checked for validity and risk, with citations to the
          Constitution, statutes and case law.
        </p>
        <DocumentUpload onUploaded={setDoc} />
        <div className="btn-row">
          <button type="button" onClick={submit} disabled={!doc || busy}>
            {busy ? (
              <>
                <span className="spinner" /> Cross-checking…
              </>
            ) : (
              "Cross-check"
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
