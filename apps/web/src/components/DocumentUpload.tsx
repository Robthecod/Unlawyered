/**
 * The one reusable document upload component, shared by Review, Cross-check
 * and Stress-test. Handles drag-drop + file picker, POSTs to /api/documents,
 * reports the extracted text + metadata upward via onUploaded.
 */
import { useRef, useState } from "react";
import { uploadDocument, ApiError, type UploadedDoc } from "../api";

export function DocumentUpload({
  onUploaded,
  onCleared,
}: {
  onUploaded: (doc: UploadedDoc | null) => void;
  onCleared?: () => void;
}) {
  const [doc, setDoc] = useState<UploadedDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadDocument(file);
      setDoc(uploaded);
      onUploaded(uploaded);
    } catch (err) {
      setDoc(null);
      onUploaded(null);
      setError(err instanceof ApiError ? err.message : "Upload failed. Is the server running?");
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setDoc(null);
    setError(null);
    onUploaded(null);
    if (onCleared) onCleared();
  }

  const accepted = ".txt,.md,.pdf,.docx";

  return (
    <div>
      <div
        className={`upload-area${drag ? " drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accepted}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        {busy ? (
          <span>
            <span className="spinner" /> Extracting text…
          </span>
        ) : doc ? (
          <span>
            ✅ <strong>{doc.name}</strong> — ready. Click to replace.
          </span>
        ) : (
          <span className="upload-hint">
            <span className="upload-icon" aria-hidden="true">
              ⬆
            </span>
            <span>
              <strong>Drop a file here</strong> or click to choose
            </span>
            <span className="upload-types">
              <code>.txt</code> <code>.md</code> <code>.pdf</code> <code>.docx</code> — up to 30
              MB
            </span>
          </span>
        )}
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      {doc ? (
        <div className="upload-meta">
          <span className="badge ok">{(doc.sizeBytes / 1024).toFixed(1)} KB</span>
          <span className="badge">{doc.characters.toLocaleString()} characters extracted</span>
          <button className="danger" type="button" onClick={clear}>
            Remove
          </button>
        </div>
      ) : null}

      {doc ? <div className="preview">{doc.preview}…</div> : null}
    </div>
  );
}
