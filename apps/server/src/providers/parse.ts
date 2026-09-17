/**
 * Answer parser: models are asked to append a SOURCES footer listing the
 * sources their inline [1]-style markers refer to. This splits the footer off
 * and turns it into structured Source objects so the UI can render claims
 * next to sources.
 */
import type { CitationMarker, Source } from "@unlawyered/shared";

export interface ParsedAnswer {
  answer: string;
  sources: Source[];
  citations: CitationMarker[];
}

const SOURCES_HEADING = /\n\s*(?:\*\*)?sources(?:\*\*)?\s*:\s*\n?/i;

function inferRole(title: string, citation?: string): Source["role"] {
  const hay = `${title} ${citation ?? ""}`.toLowerCase();
  if (/(v\.|versus|air\s+\d{4}|scr|sc\s+@|supreme court|high court|judgment)/.test(hay)) return "case";
  if (/(act|section\s|article\s|constitution|code|rules|regulation|ordinance|amendment)/.test(hay)) return "statute";
  return "secondary";
}

/** Parse one footer line: `1 | Title | citation | pinpoint | note` (fields 3-5 optional). */
function parseSourceLine(line: string): Source | null {
  const cleaned = line.replace(/^\s*\*+\s*/, "").trim();
  if (!cleaned) return null;
  const parts = cleaned.split("|").map((p) => p.trim());
  if (parts.length < 2) return null;
  const first = parts[0] ?? "";
  const numbered = /^\d{1,2}[.)]?$/.test(first);
  const title = numbered ? (parts[1] ?? "") : first;
  if (!title) return null;
  const rest = (numbered ? parts.slice(2) : parts.slice(1)).filter(Boolean);
  const source: Source = {
    title,
    role: inferRole(title, rest[0]),
  };
  if (rest[0]) source.citation = rest[0];
  if (rest[1]) source.pinpoint = rest[1];
  if (rest[2]) source.note = rest[2];
  return source;
}

export function parseAnswer(raw: string): ParsedAnswer {
  let body = raw.trim();
  let tail = "";

  const m = body.match(SOURCES_HEADING);
  if (m && m.index !== undefined) {
    tail = body.slice(m.index + m[0].length);
    body = body.slice(0, m.index);
  }

  const sources: Source[] = [];
  if (tail.trim()) {
    for (const line of tail.split(/\r?\n/)) {
      const parsed = parseSourceLine(line);
      if (parsed) sources.push(parsed);
    }
  }

  // Inline [n] markers -> source indexes. Deduped by marker text.
  const citations: CitationMarker[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(/\[(\d{1,2})\]/g)) {
    const marker = match[0];
    if (seen.has(marker)) continue;
    seen.add(marker);
    citations.push({ marker, sourceIndex: Number(match[1]) - 1 });
  }

  return { answer: body.trim(), sources, citations };
}
