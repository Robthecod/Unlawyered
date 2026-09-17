/**
 * Minimal, dependency-free markdown renderer for AI answers.
 * Everything is rendered as React nodes (no dangerouslySetInnerHTML), so model
 * output can never inject HTML. Supports headings, lists, blockquotes, bold,
 * italics, code spans, and UNLAWYERED [n] citation markers, which become
 * anchor links to the matching entry in the Sources panel.
 */
import { Fragment, type ReactNode } from "react";

const INLINE_TOKEN = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[\d{1,2}\])/g;

function renderInline(text: string, sourcesCount: number, keyBase: string): ReactNode[] {
  const parts = text.split(INLINE_TOKEN).filter((p) => p !== "");
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    if (/^\[\d{1,2}\]$/.test(part)) {
      const n = Number(part.slice(1, -1));
      if (n >= 1 && n <= sourcesCount) {
        return (
          <a key={key} className="cite" href={`#src-${n}`} title={`Source ${n}`}>
            [{n}]
          </a>
        );
      }
      return <span key={key}>{part}</span>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function Markdown({ text, sourcesCount = 0 }: { text: string; sourcesCount?: number }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  let quote: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const p = para.join(" ");
      blocks.push(<p key={`p-${blocks.length}`}>{renderInline(p, sourcesCount, `p${blocks.length}`)}</p>);
      para = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      blocks.push(
        <blockquote key={`q-${blocks.length}`}>
          {renderInline(quote.join(" "), sourcesCount, `q${blocks.length}`)}
        </blockquote>,
      );
      quote = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((item, i) => (
        <li key={`li-${blocks.length}-${i}`}>{renderInline(item, sourcesCount, `l${blocks.length}i${i}`)}</li>
      ));
      blocks.push(
        list.ordered ? <ol key={`ol-${blocks.length}`}>{items}</ol> : <ul key={`ul-${blocks.length}`}>{items}</ul>,
      );
      list = null;
    }
  };
  const flushAll = () => {
    flushPara();
    flushQuote();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = heading[1]?.length ?? 1;
      const content = renderInline(heading[2] ?? "", sourcesCount, `h${blocks.length}`);
      if (level === 1) blocks.push(<h3 key={`h-${blocks.length}`}>{content}</h3>);
      else if (level === 2) blocks.push(<h4 key={`h-${blocks.length}`}>{content}</h4>);
      else blocks.push(<h5 key={`h-${blocks.length}`}>{content}</h5>);
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      flushList();
      quote.push(line.replace(/^>\s?/, ""));
      continue;
    }
    flushQuote();

    const ol = line.match(/^\d{1,2}[.)]\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ol[1] ?? "");
      continue;
    }
    if (ul) {
      flushPara();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(ul[1] ?? "");
      continue;
    }
    flushList();

    if (line.trim() === "") {
      flushPara();
      continue;
    }
    para.push(line.trim());
  }
  flushAll();

  return <div className="result-body">{blocks}</div>;
}
