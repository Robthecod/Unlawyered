import type { CSSProperties } from "react";
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

/** Angles (deg) placing the five tools evenly around the orbit, starting top. */
const ORBIT_ANGLES = [-90, -18, 54, 126, 198];

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
        <div className="orbit-stage">
          <div className="orbit-ring" aria-hidden="true">
            <span className="orbit-dot" />
            <span className="orbit-dot two" />
          </div>

          {/* Center hub — the catchphrase everything revolves around. */}
          <div className="orbit-hub">
            <span className="orbit-kicker">5 tools</span>
            <strong>
              Pick your
              <br />
              <em>problem</em>
            </strong>
            <span className="orbit-sub">click one →</span>
          </div>

          {/* The five tools in orbit. Nesting: frame (static angle) → arm
              (animated revolution) → radius placement → upright (animated
              counter-spin) → card. Rotations cancel exactly, so cards stay
              upright; hover pauses the ride for easy aiming. */}
          {TOOLS.map((t, i) => (
            <div key={t.to} className="tool-orbit" style={{ "--angle": `${ORBIT_ANGLES[i]}deg` } as CSSProperties}>
              <div className="orbit-arm">
                <div className="orbit-pos">
                  <div className="orbit-upright">
                    <Link
                      to={t.to}
                      className={`orbit-card ${t.accent}`}
                      onMouseEnter={(e) => {
                        const stage = e.currentTarget.closest<HTMLElement>(".orbit-stage");
                        if (stage) stage.style.setProperty("--play", "paused");
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.currentTarget.closest<HTMLElement>(".orbit-stage");
                        if (stage) stage.style.setProperty("--play", "running");
                      }}
                    >
                      <span className="tool-num">{t.num}</span>
                      <span className="icon" aria-hidden="true">
                        {t.icon}
                      </span>
                      <strong className="orbit-title">{t.title}</strong>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
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
