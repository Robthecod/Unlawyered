/**
 * Review my document — plain-English document review.
 */
import { useEffect, useState } from "react";
import { reviewDocument, warmBackend, type UploadedDoc } from "../api";
import { DocumentUpload } from "../components/DocumentUpload";
import { ResultView } from "../components/ResultView";
import { LivePreview, ProviderHint, useAiStream } from "./Ask";

export function ReviewDocument() {
  const [doc, setDoc] = useState<UploadedDoc | null>(null);
  const [focus, setFocus] = useState("");
  const { busy, streaming, liveText, error, result, setResult, callbacks, started, finished } = useAiStream();

  // Start waking the backend while the user is still choosing a file.
  useEffect(() => {
    warmBackend();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!doc || busy) return;
    started();
    try {
      setResult(
        await reviewDocument(
          {
            document: { name: doc.name, text: doc.text },
            focus: focus.trim() || undefined,
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
                <span className="spinner" /> {streaming ? "Writing…" : "Reviewing…"}
              </>
            ) : (
              "Review document"
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
