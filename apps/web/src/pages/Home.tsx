import { Link } from "react-router-dom";

const TOOLS = [
  {
    to: "/explain-law",
    num: "01",
    accent: "accent-mustard",
    icon: "📖",
    title: "Explain a law",
    desc: "What an Indian statute actually says, in plain English — scope, key parts, misconceptions.",
    cta: "Explain a law →",
  },
  {
    to: "/ask",
    num: "02",
    accent: "accent-teal",
    icon: "💬",
    title: "Ask a legal question",
    desc: "The general rule, the exceptions, and what it means for you — grounded in Indian law.",
    cta: "Ask a question →",
  },
  {
    to: "/review-document",
    num: "03",
    accent: "accent-coral",
    icon: "📄",
    title: "Review my document",
    desc: "What your agreement says in plain English, what's one-sided, and what's missing.",
    cta: "Review a document →",
  },
  {
    to: "/cross-check",
    num: "04",
    accent: "accent-violet",
    icon: "⚖️",
    title: "Cross-check against Indian law",
    desc: "Clause-by-clause validity check with citations to the Constitution, statutes and cases.",
    cta: "Cross-check →",
  },
  {
    to: "/stress-test",
    num: "05",
    accent: "accent-sky",
    icon: "🔥",
    title: "Stress-test my contract",
    desc: "An adversarial read: how each clause could be used against you, and what to redraft.",
    cta: "Stress-test →",
  },
];

/** Mini sample questions shown as chips on the featured Ask panel. */
const SAMPLE_QUESTIONS = [
  "Can my landlord keep my deposit?",
  "What is a legal notice?",
  "Is an 11-month rent agreement valid?",
];

/** Rotating accent palette for the featured panel's icon on hover. */
const FEATURED_ACCENTS = ["var(--coral)", "var(--teal)", "var(--sky)", "var(--violet)"];

const STEPS = [
  {
    num: "01",
    title: "Ask or upload",
    desc: "Start with a question, legal text, contract, or judgment — whatever you're staring at.",
  },
  {
    num: "02",
    title: "UNLAWYERED analyzes",
    desc: "The AI processes and structures the information against Indian law.",
  },
  {
    num: "03",
    title: "Understand",
    desc: "Get a clearer explanation, with relevant sources where available.",
  },
];

export function Home() {
  // The featured Ask card lives outside the grid (see below); the grid keeps
  // the other four tools so rows never half-fill.
  const gridTools = TOOLS.filter((t) => t.to !== "/ask");
  const featured = TOOLS.find((t) => t.to === "/ask")!;

  return (
    <div>
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="home-hero">
        <div>
          <span className="hero-kicker">Legal AI, minus the jargon</span>
          <h1>
            Law is <span className="hl mustard">complicated</span>.
            <br />
            Understanding it <span className="hl teal">shouldn't</span> be.
          </h1>
          <p className="hero-sub">
            UNLAWYERED turns complicated legal language, documents, and judgments into
            explanations people can actually understand.
          </p>
          <div className="hero-ctas">
            <Link to="/ask" className="btn-link btn-lg">
              Ask a legal question →
            </Link>
            <a href="#tools" className="btn-link secondary">
              Explore tools
            </a>
          </div>
        </div>

        {/* -------- Product mockup: the real Ask flow, stylized -------- */}
        <div className="hero-mock">
          <div className="mock-card">
            <div className="mock-title">
              <span className="mock-dots">
                <span />
                <span />
                <span />
              </span>
              UNLAWYERED · Ask
            </div>
            <div className="mock-q">
              “What happens if my landlord doesn't return my deposit?”
            </div>
            <div className="mock-body">
              <span className="mock-chip" style={{ background: "var(--teal)" }}>
                In plain terms
              </span>
              <p className="mock-plain" style={{ margin: 0 }}>
                Your deposit is your money held as security. The landlord can only deduct
                for genuine damage — not normal wear and tear.
              </p>
              <span className="mock-chip" style={{ background: "var(--mustard)" }}>
                Relevant law
              </span>
              <div className="mock-law">
                <strong>Indian Contract Act, 1872</strong>
                <br />
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.8em" }}>Section 171</span> — bailment
                and the duty to return.
              </div>
              <div className="mock-badge-row">
                <span className="mock-src">📎 2 sources</span>
                <span className="badge">Model-checked citations</span>
              </div>
            </div>
          </div>
          <div className="mock-sticker">Not legal advice. Just clarity.</div>
        </div>
      </section>

      {/* ------------------------------ Tools ------------------------------ */}
      <section id="tools">
        <div className="section-head">
          <span className="kicker">The tools</span>
          <h2>Five ways to stop feeling lost in legal text</h2>
          <p>
            Pick the one that matches your problem. Every answer shows its sources next
            to the claims — legal information, never legal advice.
          </p>
        </div>
        <div className="tool-grid">
          {gridTools.map((t) => (
            <Link key={t.to} to={t.to} className={`tool-card ${t.accent}`}>
              <span className="tool-num">{t.num}</span>
              <span className="icon" aria-hidden="true">
                {t.icon}
              </span>
              <h3>{t.title}</h3>
              <p>{t.desc}</p>
              <span className="tool-cta">{t.cta}</span>
            </Link>
          ))}
        </div>

        {/* Featured Ask panel — keeps the section a full rectangle, no empty corner. */}
        <Link
          to={featured.to}
          className="tool-card tool-featured"
          onMouseMove={(e) => {
            const el = e.currentTarget.querySelector<HTMLElement>(".icon");
            if (el) {
              const rect = e.currentTarget.getBoundingClientRect();
              const idx = Math.floor(
                ((e.clientX - rect.left) / Math.max(1, rect.width)) * FEATURED_ACCENTS.length,
              );
              el.style.background = FEATURED_ACCENTS[Math.min(idx, FEATURED_ACCENTS.length - 1)] ?? "";
            }
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget.querySelector<HTMLElement>(".icon");
            if (el) el.style.background = "";
          }}
        >
          <span className="tool-num">{featured.num}</span>
          <span className="icon" aria-hidden="true">
            {featured.icon}
          </span>
          <span className="feat-start">start here</span>
          <h3>{featured.title}</h3>
          <p>{featured.desc}</p>
          <div className="feat-chips">
            {SAMPLE_QUESTIONS.map((q) => (
              <span key={q} className="feat-chip">
                {q}
              </span>
            ))}
          </div>
          <span className="tool-cta">{featured.cta}</span>
        </Link>
      </section>

      {/* ---------------------------- How it works ---------------------------- */}
      <section>
        <div className="section-head">
          <span className="kicker" style={{ background: "var(--coral)" }}>
            How it works
          </span>
          <h2>From legalese to plain English in three steps</h2>
        </div>
        <div className="hiw-steps">
          {STEPS.map((s) => (
            <div key={s.num} className="hiw-step">
              <span className="step-num">{s.num}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
