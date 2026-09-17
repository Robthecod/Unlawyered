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
