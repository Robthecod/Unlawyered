/**
 * Provider layer contracts — the ONLY abstraction over AI vendors.
 * Adding a provider = one file + one registry entry in ./index.ts.
 */
import type { ProviderId, ToolId } from "@unlawyered/shared";

export interface GenerateArgs {
  /** Full system prompt (persona + tool instruction + output protocol). */
  system: string;
  /** Full user turn (the question / document payload). */
  user: string;
  /** Which UNLAWYERED tool is calling — used by the mock and for logging. */
  tool: ToolId;
  maxTokens?: number;
}

export interface GenerateResult {
  answer: string;
  model: string;
}

export interface Provider {
  id: ProviderId;
  label: string;
  note: string;
  requiresKey: boolean;
  /** Resolve the API key (server-side only) or null. */
  getApiKey: () => string | null;
  /** Cheap connectivity test. Throws ProviderError on failure. */
  testConnection: () => Promise<{ model: string }>;
  /** Main generation entry point. Throws ProviderError on failure. */
  generate: (args: GenerateArgs) => Promise<GenerateResult>;
  /**
   * Streaming generation: invokes onDelta with successive text chunks and
   * resolves with the FULL answer + model once complete. Optional — callers
   * must fall back to generate() when absent. Must not call onDelta after
   * rejecting.
   */
  streamGenerate?: (
    args: GenerateArgs,
    onDelta: (text: string) => void,
  ) => Promise<GenerateResult>;
}

/**
 * Incremental SSE parser shared by every streaming provider. Feed it raw
 * chunks; it emits complete `data:` payload strings across chunk boundaries
 * (multi-line `data:` frames are joined with \n, per the SSE spec).
 */
export function createSseLineParser(onData: (data: string) => void): (chunk: string) => void {
  let buffer = "";
  return (chunk) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (line.startsWith("data:")) {
        onData(line.slice(5).trimStart());
      }
      // event:/id:/retry:/comments: are irrelevant here — all vendors encode
      // the payload type inside the JSON data itself.
    }
  };
}

/** Error with a user-safe message and an HTTP status for route handlers. */
export class ProviderError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "ProviderError";
  }
}

/** Map a failed outbound vendor call to a user-safe ProviderError. */
export function wrapVendorError(provider: string, err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  return new ProviderError(502, "provider-failed", `${provider} request failed: ${msg}`, err);
}
