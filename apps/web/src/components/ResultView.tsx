/**
 * Shared result view for all five tools: meta badges, a structured body
 * ("IN PLAIN TERMS" callout + "THE DETAILS"), the sources panel, and the
 * disclaimer. Presentation only — the AiResult data flow is unchanged.
 */
import type { AiResult } from "@unlawyered/shared";
import { Markdown } from "./Markdown";
import { SourcesPanel } from "./SourcesPanel";

/**
 * Pull the model's mandated "In plain terms:" opener out of the markdown so
 * it can be showcased as a callout. If it isn't there (mock answers vary),
 * render the whole answer as the details body instead.
 */
function splitPlainTerms(answer: string): { plain: string | null; rest: string } {
  const m = answer.match(/(?:^|\n)\s*(?:\*\*)?in plain terms:?\s*(?:\*\*)?\s*/i);
  if (!m || m.index === undefined) return { plain: null, rest: answer };
  const from = m.index + m[0].length;
  const nextHeading = answer.slice(from).search(/\n#{1,4}\s|\n\*\*[^*\n]+\*\*\s*\n/);
  const end = nextHeading === -1 ? answer.length : from + nextHeading;
  return {
    plain: answer.slice(from, end).trim(),
    rest: answer.slice(end).trim(),
  };
}

export function ResultView({ result }: { result: AiResult }) {
  const { plain, rest } = splitPlainTerms(result.answer);

  return (
    <div className="result" style={{ marginTop: "1.4rem" }}>
      <div className="result-meta">
        <span className="badge warn">{result.tool}</span>
        <span className="badge">
          via {result.provider} · {result.model}
        </span>
        <span className="badge">{result.liveProvider ? "live provider" : "mock output"}</span>
        <span className="badge">{(result.latencyMs / 1000).toFixed(1)}s</span>
        <span className="badge ok">
          {result.sources.length} source{result.sources.length === 1 ? "" : "s"}
        </span>
      </div>

      {plain !== null && plain.length > 0 ? (
        <div className="plain-terms">
          <span className="plain-chip">In simple terms</span>
          <p>{plain}</p>
        </div>
      ) : null}

      {rest.trim() ? (
        <>
          <span className="details-chip">The details</span>
          <div className="result-body">
            <Markdown text={rest} sourcesCount={result.sources.length} />
          </div>
        </>
      ) : null}

      <SourcesPanel result={result} />

      <div className="disclaimer">
        <span aria-hidden="true">⚠️</span>
        <span>
          <strong>Not legal advice.</strong> UNLAWYERED provides general legal information and
          AI-assisted analysis. It is not a substitute for advice from a qualified legal
          professional — verify every claim against primary sources.
        </span>
      </div>
    </div>
  );
}
