/**
 * Anthropic provider — REST messages call, no SDK dependency.
 */
import { DEFAULT_MODELS } from "@unlawyered/shared";
import { resolveApiKey } from "../settings.js";
import { ProviderError, wrapVendorError, type Provider } from "./types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const anthropicProvider: Provider = {
  id: "anthropic",
  label: "Anthropic Claude",
  note: "Needs an Anthropic API key from console.anthropic.com. Pay per use.",
  requiresKey: true,
  getApiKey: () => resolveApiKey("anthropic")?.key ?? null,
  async testConnection() {
    await generateOnce({ system: "ping", user: "reply with the single word: pong", maxTokens: 5 }, "testConnection");
    return { model: DEFAULT_MODELS.anthropic };
  },
  async generate(args) {
    const { answer } = await generateOnce(args, "generate");
    return { answer, model: DEFAULT_MODELS.anthropic };
  },
};

async function generateOnce(
  args: { system: string; user: string; maxTokens?: number },
  op: string,
): Promise<{ answer: string }> {
  const apiKey = resolveApiKey("anthropic")?.key;
  if (!apiKey) {
    throw new ProviderError(400, "missing-key", "No Anthropic API key configured. Add one in Settings.");
  }

  const model = DEFAULT_MODELS.anthropic;
  const res = await withRetry(
    () =>
      fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          system: args.system,
          max_tokens: args.maxTokens ?? 4096,
          messages: [{ role: "user", content: args.user }],
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(90_000),
      }),
    op,
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw mapStatus(res.status, text);
  }

  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const answer = (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  if (!answer.trim()) {
    throw new ProviderError(502, "empty-answer", "Anthropic returned an empty response.");
  }
  return { answer };
}

function mapStatus(status: number, detail: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(401, "invalid-key", "Anthropic rejected the API key. Check it in Settings.", detail);
  }
  if (status === 429) {
    return new ProviderError(429, "rate-limited", "Anthropic rate limit hit. Wait a moment and try again.", detail);
  }
  if (status >= 500) {
    return new ProviderError(502, "upstream", "Anthropic had a server error. Try again.", detail);
  }
  return new ProviderError(502, "upstream", `Anthropic request failed (HTTP ${status}).`, detail);
}

async function withRetry<T>(fn: () => Promise<T>, op: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err instanceof ProviderError) throw err; // mapped errors don't retry
      if (attempt === 3) break;
      const backoff = 400 * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw wrapVendorError(`Anthropic (${op})`, lastErr);
}
