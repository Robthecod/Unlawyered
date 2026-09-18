/**
 * OpenAI provider — REST chat-completions call, no SDK dependency.
 */
import { DEFAULT_MODELS } from "@unlawyered/shared";
import { resolveApiKey } from "../settings.js";
import { createSseLineParser, ProviderError, wrapVendorError, type Provider } from "./types";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export const openaiProvider: Provider = {
  id: "openai",
  label: "OpenAI",
  note: "Needs an OpenAI API key from platform.openai.com. Pay per use.",
  requiresKey: true,
  getApiKey: () => resolveApiKey("openai")?.key ?? null,
  async testConnection() {
    await generateOnce({ system: "ping", user: "reply with the single word: pong", maxTokens: 5 }, "testConnection");
    return { model: DEFAULT_MODELS.openai };
  },
  async generate(args) {
    const { answer } = await generateOnce(args, "generate");
    return { answer, model: DEFAULT_MODELS.openai };
  },

  /**
   * Streaming chat-completions (stream: true). Deltas map 1:1 to the vendor's
   * SSE frames; resolves with the full answer once [DONE] arrives.
   */
  async streamGenerate(args, onDelta) {
    const { answer } = await streamGenerateOnce(args, onDelta, "streamGenerate");
    return { answer, model: DEFAULT_MODELS.openai };
  },
};

async function generateOnce(
  args: { system: string; user: string; maxTokens?: number },
  op: string,
): Promise<{ answer: string }> {
  const apiKey = resolveApiKey("openai")?.key;
  if (!apiKey) {
    throw new ProviderError(400, "missing-key", "No OpenAI API key configured. Add one in Settings.");
  }

  const model = DEFAULT_MODELS.openai;
  const res = await withRetry(
    () =>
      fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.user },
          ],
          temperature: 0.2,
          max_tokens: args.maxTokens ?? 4096,
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
    choices?: Array<{ message?: { content?: string } }>;
  };
  const answer = json.choices?.[0]?.message?.content ?? "";
  if (!answer.trim()) {
    throw new ProviderError(502, "empty-answer", "OpenAI returned an empty response.");
  }
  return { answer };
}

interface OpenAiStreamChunk {
  choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
}

async function streamGenerateOnce(
  args: { system: string; user: string; maxTokens?: number },
  onDelta: (text: string) => void,
  op: string,
): Promise<{ answer: string; model: string }> {
  const apiKey = resolveApiKey("openai")?.key;
  if (!apiKey) {
    throw new ProviderError(400, "missing-key", "No OpenAI API key configured. Add one in Settings.");
  }

  const model = DEFAULT_MODELS.openai;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      temperature: 0.2,
      max_tokens: args.maxTokens ?? 4096,
      stream: true,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw mapStatus(res.status, text);
  }
  if (!res.body) {
    throw new ProviderError(502, "upstream", "OpenAI returned no response body to stream.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let answer = "";
  let truncated = false;

  const handleData = (data: string) => {
    if (!data || data === "[DONE]") return;
    let chunk: OpenAiStreamChunk;
    try {
      chunk = JSON.parse(data) as OpenAiStreamChunk;
    } catch {
      return;
    }
    const choice = chunk.choices?.[0];
    // finish_reason "length" = the output-token cap was hit mid-answer.
    if (choice?.finish_reason === "length") truncated = true;
    const text = choice?.delta?.content ?? "";
    if (text) {
      answer += text;
      onDelta(text);
    }
  };
  const { feed, flush } = createSseLineParser(handleData);

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      feed(decoder.decode(value, { stream: true }));
    }
    feed(decoder.decode());
    flush();
  } finally {
    reader.releaseLock();
  }

  if (!answer.trim()) {
    throw new ProviderError(502, "empty-answer", "OpenAI returned an empty response.");
  }
  if (truncated) {
    throw new ProviderError(
      502,
      "truncated-answer",
      "OpenAI hit the output token limit and the answer was cut off, likely before its SOURCES footer. Try a shorter document, or ask about fewer sections at once.",
    );
  }
  return { answer, model };
}

function mapStatus(status: number, detail: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(401, "invalid-key", "OpenAI rejected the API key. Check it in Settings.", detail);
  }
  if (status === 429) {
    return new ProviderError(429, "rate-limited", "OpenAI rate limit hit. Wait a moment and try again.", detail);
  }
  if (status >= 500) {
    return new ProviderError(502, "upstream", "OpenAI had a server error. Try again.", detail);
  }
  return new ProviderError(502, "upstream", `OpenAI request failed (HTTP ${status}).`, detail);
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
  throw wrapVendorError(`OpenAI (${op})`, lastErr);
}
