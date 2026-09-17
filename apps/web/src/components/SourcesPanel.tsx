/**
 * Sources panel — the "sources next to claims" surface. Rendered under every
 * AI answer; inline [n] markers in the text anchor-link to these entries.
 * Citation data and ids unchanged; presentation restyled.
 */
import type { AiResult } from "@unlawyered/shared";

export function SourcesPanel({ result }: { result: AiResult }) {
  if (!result.sources.length) {
    return (
      <div className="sources">
        <h4>Relevant sources</h4>
        <p className="sources-empty">
          The model didn't cite any sources for this answer. Treat every claim as unverified.
        </p>
      </div>
    );
  }

  return (
    <div className="sources">
      <h4>
        Relevant sources {result.liveProvider ? "" : "(mock)"}
      </h4>
      <ol className="sources-list">
        {result.sources.map((s, i) => {
          const n = i + 1;
          return (
            <li key={n} id={`src-${n}`} className="source-card">
              <span className="src-role">{s.role}</span>
              <strong className="src-title">{s.title}</strong>
              {s.citation ? (
                <span className="src-citation">{s.citation}</span>
              ) : null}
              {s.pinpoint ? <span className="src-pin">at {s.pinpoint}</span> : null}
              {s.note ? <span className="src-note">{s.note}</span> : null}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="src-link">
                  View source →
                </a>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
