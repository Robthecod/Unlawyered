/**
 * Gemini provider — talks to Google's Generative Language API over plain REST,
 * so the server has zero SDK dependency for it. Key comes from the settings
 * store / env, never the client.
 *
 * Model handling: instead of hardcoding a model id (which 404s once Google
 * retires it), we ask Google which models THIS key can actually use
 * (GET /v1beta/models) and pick the best generally-available flash model.
 * The result is cached per key for 10 minutes.
 */
import { resolveApiKey } from "../settings.js";
import { createSseLineParser, ProviderError, wrapVendorError, type Provider } from "./types";

const API_BASES = [
  "https://generativelanguage.googleapis.com/v1beta",
  "https://generativelanguage.googleapis.com/v1",
];

interface GeminiModelInfo {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

const modelCache = new Map<string, { model: string; base: string; at: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Default output cap for real generation. 4096 truncated long answers (e.g.
 * clause-by-clause cross-checks) before the model could write its SOURCES
 * footer, which silently dropped every citation. 8192 fits the output limit
 * of every generally-available Gemini chat model.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

/**
 * Gemini 2.5+ models "think" (hidden multi-pass reasoning) before answering
 * by default. That adds several seconds of invisible latency per answer and
 * burns the output budget before the mandatory SOURCES footer is written —
 * a direct cause of the truncation bug this file already guards against.
 * Plain-English legal explanation doesn't need deep reasoning, so turn it
 * down wherever the model family allows:
 *  - 2.5 Flash / Flash-Lite: thinkingBudget 0 disables thinking entirely.
 *  - 3-series: thinking cannot be disabled; thinkingLevel "low" minimises it
 *    (they reject the old thinkingBudget field, so never send both).
 *  - 2.5 Pro / unknown ids: send nothing — invalid config would 400 every
 *    request for that model.
 */
export function thinkingConfigFor(model: string): { thinkingConfig?: { thinkingBudget?: number; thinkingLevel?: string } } {
  const m = model.toLowerCase();
  if (/^gemini-3/.test(m)) {
    return { thinkingConfig: { thinkingLevel: "low" } };
  }
  if (/^gemini-2\.5/.test(m) && !/pro/.test(m)) {
    return { thinkingConfig: { thinkingBudget: 0 } };
  }
  return {};
}

/** Models that recently failed real requests; value = blocked-until timestamp. */
const modelBlocklist = new Map<string, number>();
const BLOCKLIST_TTL_MS = 2 * 60 * 1000;

export const geminiProvider: Provider = {
  id: "gemini",
  label: "Google Gemini",
  note: "Needs a Gemini API key from Google AI Studio (aistudio.google.com). Free tier available.",
  requiresKey: true,
  getApiKey: () => resolveApiKey("gemini")?.key ?? null,
  async testConnection() {
    const { model } = await resolveEndpoint();
    await generateOnce(
      { system: "ping", user: "reply with the single word: pong", maxTokens: 5 },
      "testConnection",
      // A 5-token probe may stop with MAX_TOKENS; that still proves connectivity.
      { allowTruncated: true },
    );
    return { model };
  },
  async generate(args) {
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { answer } = await generateOnce(args, "generate");
        const { model } = await resolveEndpoint();
        return { answer, model };
      } catch (err) {
        lastErr = err;
        const code = err instanceof ProviderError ? err.code : "";
        const transient =
          code === "upstream" || code === "model-unavailable" || code === "no-usable-model" || code === "rate-limited";
        if (!transient) throw err;
        // Block this model for a couple of minutes and force a re-probe so the
        // next attempt fails over to a different, healthy model.
        const key = resolveApiKey("gemini")?.key;
        if (key) {
          const cached = modelCache.get(key);
          if (cached) {
            modelBlocklist.set(`${cached.base}|${cached.model}`, Date.now() + 2 * 60 * 1000);
            modelCache.delete(key);
          }
        }
        if (attempt === 3) break;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    throw lastErr;
  },

  /**
   * Streaming generation over :streamGenerateContent?alt=sse. Same endpoint
   * resolution, model failover and error mapping as generate(); the retry
   * loop only restarts when NO delta has been emitted yet — once text has
   * reached the client, a retry would duplicate it.
   */
  async streamGenerate(args, onDelta) {
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let emitted = false;
      const onDeltaOnceEmitted = (text: string) => {
        emitted = true;
        onDelta(text);
      };
      try {
        const { answer, model } = await streamGenerateOnce(args, onDeltaOnceEmitted, "streamGenerate");
        return { answer, model };
      } catch (err) {
        lastErr = err;
        if (emitted) throw err; // client already saw text — no safe retry
        const code = err instanceof ProviderError ? err.code : "";
        const transient =
          code === "upstream" || code === "model-unavailable" || code === "no-usable-model" || code === "rate-limited";
        if (!transient) throw err;
        const key = resolveApiKey("gemini")?.key;
        if (key) {
          const cached = modelCache.get(key);
          if (cached) {
            modelBlocklist.set(`${cached.base}|${cached.model}`, Date.now() + 2 * 60 * 1000);
            modelCache.delete(key);
          }
        }
        if (attempt === 3) break;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    throw lastErr;
  },
};

function requireKey(): string {
  const apiKey = resolveApiKey("gemini")?.key;
  if (!apiKey) {
    throw new ProviderError(400, "missing-key", "No Gemini API key configured. Add one in Settings.");
  }
  return apiKey;
}

/**
 * Resolve (api base, model) for this key: try each API version until
 * /models answers, then pick the best usable chat model. Cached per key.
 */
async function resolveEndpoint(): Promise<{ model: string; base: string }> {
  const apiKey = requireKey();
  const cached = modelCache.get(apiKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { model: cached.model, base: cached.base };
  }

  let lastError: ProviderError | null = null;
  for (const base of API_BASES) {
    try {
      const candidates = await listModelsForBase(base, apiKey);
      const model = await firstUsableModel(base, apiKey, candidates);
      modelCache.set(apiKey, { model, base, at: Date.now() });
      return { model, base };
    } catch (err) {
      lastError = err instanceof ProviderError ? err : wrapVendorError("Gemini (listModels)", err);
      // A 404 on /models means this API version is gone for this key — try the next one.
      if (!(lastError.code === "model-unavailable" || lastError.code === "upstream")) throw lastError;
    }
  }
  throw lastError ?? new ProviderError(502, "no-models", "Could not reach the Gemini API.");
}

async function listModelsForBase(base: string, apiKey: string): Promise<string[]> {
  const res = await withRetry(
    () =>
      fetch(`${base}/models?pageSize=200`, {
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(30_000),
      }),
    "listModels",
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw mapStatus(res.status, text);
  }

  const json = (await res.json()) as { models?: GeminiModelInfo[] };
  const candidates = (json.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((id) => /^gemini/.test(id))
    .filter((id) => !/tts|image|audio|embed|aqa|veo|imagen|native-audio|live/.test(id));

  if (candidates.length === 0) {
    throw new ProviderError(
      502,
      "no-models",
      "Your Gemini key is valid, but no chat models are visible to it. If the key has API restrictions, allow the Generative Language API.",
    );
  }

  return candidates.sort((a, b) => scoreModel(b) - scoreModel(a) || b.localeCompare(a));
}

/**
 * Preference score: generally-available flash models first (cheap + fast),
 * stable releases over experimental ones. Ordering matters less than before
 * because candidates are actually probed before use.
 */
function scoreModel(id: string): number {
  let s = 0;
  if (/flash/.test(id)) s += 6;
  else if (/pro/.test(id)) s += 3;
  if (/lite|nano|thinking/.test(id)) s -= 2;
  if (/exp|preview/.test(id)) s -= 5;
  return s;
}

/**
 * Some models answer 429 (quota) or 503 (overloaded) for a given key even when
 * listed. Probe candidates in preference order with a tiny request and use the
 * first that actually responds. Probes cost ~5 tokens and run only when the
 * model cache is cold.
 */
async function firstUsableModel(base: string, apiKey: string, candidates: string[]): Promise<string> {
  const now = Date.now();
  const toProbe = candidates
    .filter((id) => (modelBlocklist.get(`${base}|${id}`) ?? 0) < now)
    .slice(0, 8);
  for (const id of toProbe) {
    try {
      const res = await fetch(`${base}/models/${id}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return id;
      if (res.status === 401 || res.status === 403) {
        throw mapStatus(res.status, await res.text().catch(() => ""));
      }
      // 429 / 503 / 404 / anything else: this model is not usable right now.
      await res.body?.cancel().catch(() => {});
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      // Network hiccup on one probe: try the next candidate.
    }
  }
  throw new ProviderError(
    502,
    "no-usable-model",
    "Every Gemini model visible to your key is currently rate-limited or overloaded. Wait a minute and try again — the free tier shares small per-minute quotas across models.",
  );
}

async function generateOnce(
  args: { system: string; user: string; maxTokens?: number },
  op: string,
  opts: { allowTruncated?: boolean } = {},
): Promise<{ answer: string }> {
  const apiKey = requireKey();
  const { model, base } = await resolveEndpoint();
  const url = `${base}/models/${model}:generateContent`;
  const body = {
    system_instruction: { parts: [{ text: args.system }] },
    contents: [{ role: "user", parts: [{ text: args.user }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: args.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      // Real generation only; the tiny testConnection / availability probes
      // stay untouched so their 5-token semantics keep working everywhere.
      ...thinkingConfigFor(model),
    },
  };

  const res = await withRetry(
    () =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      }),
    op,
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw mapStatus(res.status, text);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> } | null;
    }>;
  };
  const candidate = json.candidates?.[0];
  const answer = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  // A MAX_TOKENS finish means the answer was cut off mid-stream — almost
  // always before the SOURCES footer. Fail loudly instead of returning an
  // uncited answer that looks legitimate (the "sources: 0" bug).
  if (!opts.allowTruncated && candidate?.finishReason === "MAX_TOKENS") {
    throw new ProviderError(
      502,
      "truncated-answer",
      "Gemini hit the output token limit and the answer was cut off, likely before its SOURCES footer. Try a shorter document, or ask about fewer sections at once.",
    );
  }
  if (!answer.trim()) {
    throw new ProviderError(502, "empty-answer", "Gemini returned an empty response.");
  }
  return { answer };
}

function mapStatus(status: number, detail: string): ProviderError {
  if (status === 400 && /api key/i.test(detail)) {
    return new ProviderError(401, "invalid-key", "Gemini rejected the API key. Check it in Settings.", detail);
  }
  if (status === 401 || status === 403) {
    return new ProviderError(
      401,
      "invalid-key",
      "Gemini rejected the API key (HTTP 401/403). Check the key in Settings — if it has API restrictions, allow the Generative Language API.",
      detail,
    );
  }
  if (status === 404) {
    return new ProviderError(
      502,
      "model-unavailable",
      "Gemini said the requested model does not exist (HTTP 404). UNLAWYERED auto-detects available models, so retry; if this persists, the key may be restricted to other models.",
      detail,
    );
  }
  if (status === 429) {
    return new ProviderError(429, "rate-limited", "Gemini rate limit hit. Wait a moment and try again.", detail);
  }
  if (status >= 500) {
    return new ProviderError(502, "upstream", "Gemini had a server error. Try again.", detail);
  }
  return new ProviderError(502, "upstream", `Gemini request failed (HTTP ${status}).`, detail);
}

interface GeminiStreamChunk {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> } | null;
  }>;
}

/**
 * One streaming attempt against :streamGenerateContent?alt=sse. Emits text
 * deltas as they arrive; resolves with the full concatenated answer. Applies
 * the same MAX_TOKENS / empty-answer guards as generateOnce so a truncated
 * stream fails loudly instead of resolving with an uncited half-answer.
 */
async function streamGenerateOnce(
  args: { system: string; user: string; maxTokens?: number },
  onDelta: (text: string) => void,
  op: string,
): Promise<{ answer: string; model: string }> {
  const apiKey = requireKey();
  const { model, base } = await resolveEndpoint();
  const url = `${base}/models/${model}:streamGenerateContent?alt=sse`;
  const body = {
    system_instruction: { parts: [{ text: args.system }] },
    contents: [{ role: "user", parts: [{ text: args.user }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: args.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      ...thinkingConfigFor(model),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw mapStatus(res.status, text);
  }
  if (!res.body) {
    throw new ProviderError(502, "upstream", "Gemini returned no response body to stream.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let answer = "";
  let truncated = false;

  const handleData = (data: string) => {
    if (!data || data === "[DONE]") return;
    let chunk: GeminiStreamChunk;
    try {
      chunk = JSON.parse(data) as GeminiStreamChunk;
    } catch {
      return; // keep-alive or partial frame — ignore
    }
    const candidate = chunk.candidates?.[0];
    if (candidate?.finishReason === "MAX_TOKENS") truncated = true;
    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (text) {
      answer += text;
      onDelta(text);
    }
  };
  const feed = createSseLineParser(handleData);

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      feed(decoder.decode(value, { stream: true }));
    }
    feed(decoder.decode()); // flush any final partial line
  } finally {
    reader.releaseLock();
  }

  if (truncated) {
    throw new ProviderError(
      502,
      "truncated-answer",
      "Gemini hit the output token limit and the answer was cut off, likely before its SOURCES footer. Try a shorter document, or ask about fewer sections at once.",
    );
  }
  if (!answer.trim()) {
    throw new ProviderError(502, "empty-answer", "Gemini returned an empty response.");
  }
  return { answer, model };
}

/** Upstream 5xx / model-404 flaps are transient and worth retrying. */
const RETRYABLE_CODES = new Set(["upstream", "model-unavailable"]);

async function withRetry<T>(fn: () => Promise<T>, op: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = !(err instanceof ProviderError) || RETRYABLE_CODES.has(err.code);
      if (!retryable) throw err;
      if (attempt === 3) break;
      await new Promise((r) => setTimeout(r, 800 * 2 ** (attempt - 1)));
    }
  }
  if (lastErr instanceof ProviderError) throw lastErr;
  throw wrapVendorError(`Gemini (${op})`, lastErr);
}
