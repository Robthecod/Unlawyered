/**
 * 404 — page not found. A gavel-banged verdict with a route home.
 */
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";

export function NotFound() {
  return (
    <div className="notfound">
      <Logo size={72} />
      <p className="nf-kicker">COURT ADJOURNED</p>
      <h1 className="nf-code">404</h1>
      <h2 className="nf-title">Objection sustained.</h2>
      <p className="nf-text">
        This page is not on the record. It may have been struck down, moved, or
        never existed in the first place — and in law, if it isn't on the
        record, it didn't happen.
      </p>
      <div className="btn-row nf-actions">
        <Link className="btn-link" to="/">
          ← Back to the record (home)
        </Link>
        <Link className="btn-link secondary" to="/settings">
          Open Settings
        </Link>
      </div>
      <p className="nf-hint">Not legal advice either.</p>
    </div>
  );
}
