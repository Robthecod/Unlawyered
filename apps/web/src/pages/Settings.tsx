/**
 * Settings — provider selection and API keys. The key is POSTed once to our
 * backend, stored encrypted at rest, and never displayed again anywhere.
 */
import { useCallback, useEffect, useState } from "react";
import {
  clearProviderKey,
  getProviders,
  setProvider,
  setProviderKey,
  testProvider,
  ApiError,
  type ProvidersResponse,
} from "../api";

export function Settings() {
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [keyProvider, setKeyProvider] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const reload = useCallback(() => {
    getProviders()
      .then((r) => {
        setData(r);
        setKeyProvider((prev) => prev ?? (r.selected && r.selected !== "mock" ? r.selected : "gemini"));
      })
      .catch(() => setLoadError("Could not reach the backend. Is `npm run dev:server` running?"));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function choose(provider: string) {
    setStatus(null);
    try {
      await setProvider(provider);
      reload();
      setStatus({ kind: "ok", text: "Provider saved." });
    } catch (err) {
      setStatus({ kind: "err", text: err instanceof ApiError ? err.message : "Could not save provider." });
    }
  }

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyProvider) return;
    setSaving(true);
    setStatus(null);
    try {
      await setProviderKey(keyProvider, keyDraft.trim());
      setKeyDraft("");
      reload();
      setStatus({ kind: "ok", text: "Key stored (encrypted on the server). It will not be shown again." });
    } catch (err) {
      setStatus({ kind: "err", text: err instanceof ApiError ? err.message : "Could not store key." });
    } finally {
      setSaving(false);
    }
  }

  async function removeKey(provider: string) {
    setStatus(null);
    try {
      await clearProviderKey(provider);
      reload();
      setStatus({ kind: "ok", text: "Key removed." });
    } catch (err) {
      setStatus({ kind: "err", text: err instanceof ApiError ? err.message : "Could not remove key." });
    }
  }

  async function runTest(provider: string) {
    setTesting(provider);
    setStatus(null);
    try {
      const r = await testProvider(provider);
      setStatus({
        kind: r.ok ? "ok" : "err",
        text: r.detail + (r.ok ? "" : " — check the key in Settings."),
      });
    } catch (err) {
      setStatus({
        kind: "err",
        text: err instanceof ApiError ? err.message : "Test failed.",
      });
    } finally {
      setTesting(null);
    }
  }

  if (loadError) return <div className="error-box">{loadError}</div>;
  if (!data) return <p style={{ color: "var(--text-dim)" }}>Loading settings…</p>;

  const selectedId = data.selected;
  const keyProviderInfo = data.providers.find((p) => p.id === keyProvider);

  return (
    <div>
      <div className="card">
        <h2>⚙️ AI provider</h2>
        <p style={{ color: "var(--text-dim)" }}>
          Pick which AI provider answers your questions. Calls are proxied
          through the UNLAWYERED backend — your key is stored encrypted at rest
          and is never sent to the browser again.
        </p>

        <div className="settings-grid">
          {data.providers.map((p) => (
            <div
              key={p.id}
              className={`provider-card${p.id === selectedId ? " selected" : ""}`}
              onClick={() => void choose(p.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") void choose(p.id);
              }}
            >
              <h3>
                {p.label}
                {p.id === selectedId ? <span className="badge ok">active</span> : null}
              </h3>
              <p>{p.note}</p>
              <div className="upload-meta">
                <span className={`badge${p.hasKey ? " ok" : ""}`}>
                  {p.requiresKey ? (p.hasKey ? `key set (${p.keySource})` : "no key") : "no key needed"}
                </span>
                {p.requiresKey && p.hasKey && p.keySource === "settings" ? (
                  <button
                    className="danger"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeKey(p.id);
                    }}
                  >
                    Remove key
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>🔑 API keys</h2>
        <p style={{ color: "var(--text-dim)" }}>
          The key goes from this page to the backend once, over the same
          connection you're using now, and is encrypted with AES-256-GCM before
          it touches disk. It is never returned to any browser.
        </p>

        <form onSubmit={saveKey}>
          <label htmlFor="kprovider">Provider</label>
          <select
            id="kprovider"
            value={keyProvider ?? ""}
            onChange={(e) => setKeyProvider(e.target.value)}
          >
            {data.providers
              .filter((p) => p.requiresKey)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
          </select>

          <label htmlFor="apikey">
            API key {keyProviderInfo?.hasKey && keyProviderInfo.keySource === "settings" ? (
              <span className="hint">a key is already stored — saving replaces it</span>
            ) : null}
          </label>
          <input
            id="apikey"
            type="password"
            autoComplete="off"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder={keyProviderInfo?.hasKey ? "•••••••• (stored)" : "Paste your API key"}
          />

          <div className="btn-row">
            <button type="submit" disabled={saving || keyDraft.trim().length < 10}>
              {saving ? "Saving…" : "Save key"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={testing !== null}
              onClick={() => keyProvider && void runTest(keyProvider)}
            >
              {testing === keyProvider ? (
                <>
                  <span className="spinner" /> Testing…
                </>
              ) : (
                "Test connection"
              )}
            </button>
          </div>
        </form>

        {status ? (
          <p className={`status ${status.kind}`} style={{ marginTop: "0.8rem" }}>
            {status.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
