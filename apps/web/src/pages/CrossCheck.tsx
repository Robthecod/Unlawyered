/**
 * Cross-check a document against Indian law, with citations.
 */
import { useEffect, useState } from "react";
import { crossCheckDocument, warmBackend, type UploadedDoc } from "../api";
import { DocumentUpload } from "../components/DocumentUpload";
import { ResultView } from "../components/ResultView";
import { LivePreview, ProviderHint, useAiStream } from "./Ask";

export function CrossCheck() {
  const [doc, setDoc] = useState<UploadedDoc | null>(null);
  const { busy, streaming, liveText, error, result, setResult, callbacks, started, finished } = useAiStream();

  // Start waking the backend while the user is still choosing a file.
  useEffect(() => {
    warmBackend();
  }, []);

  async function submit() {
    if (!doc || busy) return;
    started();
    try {
      setResult(
        await crossCheckDocument(
          {
            document: { name: doc.name, text: doc.text },
            jurisdiction: "India",
          },
          callbacks,
        ),
      );
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
                <span className="spinner" /> {streaming ? "Writing…" : "Cross-checking…"}
              </>
            ) : (
              "Cross-check"
            )}
          </button>
        </div>
      </div>

      <ProviderHint />
      {error ? <div className="error-box">{error}</div> : null}
      {showPreview ? <LivePreview text={liveText} streaming={streaming} /> : null}
      {result ? <ResultView result={result} /> : null}
    </div>
  );
}
