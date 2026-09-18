/**
 * Top-level crash guard. Without it, any runtime error during render (e.g. a
 * server response whose shape didn't match the client's assumption) unmounts
 * the entire React tree and the user sees a blank page with no way back.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the console useful — this is the only trace we get in production.
    console.error("UI crashed:", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="card">
          <div className="tool-head">
            <span className="tool-emoji" aria-hidden="true">
              💥
            </span>
            <h2>Something broke on this page</h2>
          </div>
          <p style={{ color: "var(--text-dim)" }}>
            An unexpected error occurred while rendering. Your data was not lost — go back and try
            again.
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "var(--surface-2, rgba(0,0,0,0.2))",
              padding: "0.8rem",
              borderRadius: "8px",
              fontSize: "0.8rem",
              color: "var(--text-dim)",
            }}
          >
            {this.state.error.message}
          </pre>
          <div className="btn-row">
            <button type="button" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button type="button" className="danger" onClick={() => window.location.assign("/")}>
              Go home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
