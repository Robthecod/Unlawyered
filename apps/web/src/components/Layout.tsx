/**
 * App shell: Memphis backdrop, sticky header (wordmark + nav + CTA), a live
 * backend connection indicator, and a dark footer with the legal disclaimer.
 * Routing/health-check logic unchanged from the original implementation.
 */
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { getHealth } from "../api";
import { Logo } from "./Logo";
import { AnimatedBackground } from "./AnimatedBackground";
import { AdaptiveCursor } from "./AdaptiveCursor";

function ConnectionPill() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const check = () =>
      getHealth()
        .then(() => alive && setOk(true))
        .catch(() => alive && setOk(false));
    void check();
    const t = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <span className="conn-pill" title="Live check of the UNLAWYERED backend (/api/health)">
      <span className={`dot${ok === true ? " ok" : ""}`} />
      {ok === null ? "checking…" : ok ? "connected" : "offline"}
    </span>
  );
}

export function Layout() {
  return (
    <>
      <AnimatedBackground />
      <AdaptiveCursor />
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand">
            <Logo height={38} />
          </Link>
          <span className="tagline">Legal AI for people who don't speak legal</span>
          <nav className="nav" aria-label="Primary">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/explain-law">Explain a Law</NavLink>
            <NavLink to="/ask">Ask</NavLink>
            <NavLink to="/review-document">Review</NavLink>
            <NavLink to="/cross-check">Cross-check</NavLink>
            <NavLink to="/stress-test">Stress-test</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
          <div className="btn-row" style={{ margin: 0, gap: "0.6rem" }}>
            <ConnectionPill />
            <Link to="/ask" className="btn-link" style={{ whiteSpace: "nowrap" }}>
              Try a tool →
            </Link>
          </div>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="brand-name">UNLAWYERED</span>
            <p className="footer-tagline">Legal AI for people who don't speak legal.</p>
            <p className="footer-disclaimer">
              UNLAWYERED provides general legal information and AI-assisted analysis. It is not a
              substitute for advice from a qualified legal professional. Laws and interpretations
              can change, and outputs should be independently verified before being relied upon.
            </p>
          </div>
          <div className="footer-col">
            <h4>Explore</h4>
            <nav className="footer-links" aria-label="Footer">
              <Link to="/ask">Ask a question</Link>
              <Link to="/explain-law">Explain a law</Link>
              <Link to="/review-document">Review a document</Link>
              <Link to="/cross-check">Cross-check</Link>
              <Link to="/stress-test">Stress-test</Link>
              <Link to="/settings">Settings</Link>
            </nav>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <nav className="footer-links" aria-label="Legal">
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Use</Link>
            </nav>
          </div>
        </div>
        <p className="footer-copy" style={{ maxWidth: 1180, margin: "1.6rem auto 0" }}>
          © {new Date().getFullYear()} UNLAWYERED
        </p>
      </footer>
    </>
  );
}
