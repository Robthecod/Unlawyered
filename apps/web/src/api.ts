/**
 * API client. Every call goes to OUR backend (same origin in dev via the
 * Vite proxy) — never directly to an AI vendor. Keys never pass through here
 * except the one deliberate Settings POST to our own server.
 */
import type {
  AiResult,
  AiStreamEvent,
  DocumentInput,
  ProviderInfo,
  UploadedDocument,
} from "@unlawyered/shared";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Render's free tier spins the API down after ~15 idle minutes and a cold
 * start takes ~50s, while Netlify's proxy times out at ~30s — so the first
 * request after a quiet spell dies with HTTP 502/503/504 even though the
 * backend is fine. Instead of making the user press the button again (the
 * old "click it twice" behaviour), we retry transparently: the first retry
 * re-issues the exact same request after the backend has had time to wake
 * (its own keep-alive pinger may have started the wake-up already), then a
 * short backoff covers slow deploys. Only network/proxy failures retry —
 * real API errors (400/401/429/500 with a JSON body) surface immediately.
 */
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [45_000, 15_000, 15_000];

function isGatewayTimeout(err: unknown): boolean {
  return (
    err instanceof TypeError || // network-level failure (fetch throws TypeError)
    (err instanceof ApiError && RETRYABLE_STATUS.has(err.status))
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let code = `http-${res.status}`;
    let message = `Request failed (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      if (body.error?.message) {
        code = body.error.code ?? code;
        message = body.error.message;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

/**
 * Fetch with transparent wake-up retries for gateway timeouts.
 * POSTs must be retried verbatim: the AI tools are idempotent (each call is
 * a fresh analysis; nothing is stored server-side), so a request that died
 * in the proxy after reaching the backend just runs twice harmlessly.
 */
async function handleWithRetry<T>(url: string, init: RequestInit): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await handle<T>(await fetch(url, init));
    } catch (err) {
      lastErr = err;
      if (attempt === RETRY_DELAYS_MS.length || !isGatewayTimeout(err)) throw err;
      await sleep(RETRY_DELAYS_MS[attempt] ?? 15_000);
    }
  }
  throw lastErr;
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** JSON POST that survives Render cold starts (see handleWithRetry). */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  return handleWithRetry<T>(url, jsonRequest(body));
}

/* ------------------------------------------------------------------ */
/* Health (milestone-1 connection check)                               */
/* ------------------------------------------------------------------ */

export interface HealthInfo {
  ok: boolean;
  service: string;
  version: string;
  time: string;
}

export async function getHealth(): Promise<HealthInfo> {
  return handle<HealthInfo>(await fetch("/api/health"));
}

/**
 * Wake the backend without waiting for a real answer: fired as a background
 * keep-alive when any AI tool page loads, so by the time the user hits a
 * submit button the cold start is usually already over.
 */
export function warmBackend(): void {
  void getHealth().catch(() => {
    /* offline is fine — the retry logic in postJson covers the rest */
  });
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export interface ProvidersResponse {
  providers: ProviderInfo[];
  selected: string | null;
}

export async function getProviders(): Promise<ProvidersResponse> {
  return handle<ProvidersResponse>(await fetch("/api/settings/providers"));
}

export async function setProvider(provider: string): Promise<void> {
  await handle(await fetch("/api/settings/provider", jsonRequest({ provider })));
}

export async function setProviderKey(provider: string, apiKey: string): Promise<void> {
  await handle(await fetch("/api/settings/key", jsonRequest({ provider, apiKey })));
}

export async function clearProviderKey(provider: string): Promise<void> {
  await handle(
    await fetch("/api/settings/key", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider }),
    }),
  );
}

export interface TestConnectionResultShape {
  ok: boolean;
  provider: string;
  model?: string;
  latencyMs?: number;
  detail: string;
}

export async function testProvider(provider: string): Promise<TestConnectionResultShape> {
  return handle<TestConnectionResultShape>(
    await fetch("/api/settings/test", jsonRequest({ provider })),
  );
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export interface UploadedDoc extends UploadedDocument {
  /** Full extracted text — held in memory only, used by document tools. */
  text: string;
}

export async function uploadDocument(file: File): Promise<UploadedDoc> {
  const form = new FormData();
  form.append("file", file);
  // Server shape: { document: UploadedDocument, text: string } — unwrap it.
  // (A bare cast here once shipped a nested object as if it were flat, and the
  // first render of doc.characters threw, blanking the whole page.)
  const res = await handleWithRetry<{ document: UploadedDocument; text: string }>(
    "/api/documents",
    { method: "POST", body: form },
  );
  return { ...res.document, text: res.text };
}

/* ------------------------------------------------------------------ */
/* AI tools (streaming)                                                */
/* ------------------------------------------------------------------ */

export interface StreamCallbacks {
  /** Provider/model announced just before the first visible token. */
  onMeta?: (meta: { provider: string; model: string; tool: string }) => void;
  /** Successive answer text; concatenation approximates the final answer
   *  (minus the held-back SOURCES footer). */
  onDelta: (text: string) => void;
}

/**
 * POST an AI tool request and consume its SSE stream.
 *
 * Cold-start retry: identical policy to handleWithRetry, but only while NO
 * event has arrived yet — once the stream has produced anything, the request
 * is committed and failures surface immediately (retrying would restart the
 * answer from scratch and duplicate text the user already read).
 */
async function postJsonStream<T>(url: string, body: unknown, cb: StreamCallbacks): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let gotEvent = false;
    try {
      const res = await fetch(url, {
        ...jsonRequest(body),
        headers: { "content-type": "application/json", accept: "text/event-stream" },
      });
      if (!res.ok) {
        // Non-SSE error responses (400/401/429/500 with a JSON body) surface
        // immediately — same contract as handle().
        await handle<unknown>(res);
      }
      if (!res.body) throw new TypeError("Streaming not supported by this browser");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: T | null = null;

      const handleEvent = (event: AiStreamEvent) => {
        gotEvent = true;
        switch (event.type) {
          case "meta":
            cb.onMeta?.({ provider: event.provider, model: event.model, tool: event.tool });
            break;
          case "delta":
            cb.onDelta(event.text);
            break;
          case "done":
            finalResult = event.result as T;
            break;
          case "error":
            throw new ApiError(502, event.code, event.message);
          case "start":
            break;
        }
      };

      // SSE frames: `data: <json>\n\n` (comment pings start with ':').
      const processData = (data: string) => {
        const trimmed = data.trim();
        if (!trimmed) return;
        handleEvent(JSON.parse(trimmed) as AiStreamEvent);
      };
      const feed = (chunk: string) => {
        buffer += chunk;
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).replace(/\r$/, "");
          buffer = buffer.slice(idx + 1);
          if (line.startsWith("data:")) processData(line.slice(5));
          // ':' comment lines are keep-alive pings — ignore.
        }
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          feed(decoder.decode(value, { stream: true }));
        }
        feed(decoder.decode());
      } finally {
        reader.releaseLock();
      }

      if (finalResult !== null) return finalResult;
      throw new ApiError(502, "incomplete-stream", "The answer stream ended before it finished.");
    } catch (err) {
      lastErr = err;
      // Retry only for cold-start failures AND only before any event reached us.
      if (gotEvent || attempt === RETRY_DELAYS_MS.length || !isGatewayTimeout(err)) throw err;
      await sleep(RETRY_DELAYS_MS[attempt] ?? 15_000);
    }
  }
  throw lastErr;
}

/* ------------------------------------------------------------------ */
/* AI tools                                                            */
/* ------------------------------------------------------------------ */

export async function askLegalQuestion(
  args: { question: string; jurisdiction?: string },
  cb: StreamCallbacks,
): Promise<AiResult> {
  return postJsonStream<AiResult>("/api/ask", args, cb);
}

export async function explainLaw(
  args: { lawName: string; aspect?: string },
  cb: StreamCallbacks,
): Promise<AiResult> {
  return postJsonStream<AiResult>("/api/explain-law", args, cb);
}

export async function reviewDocument(
  args: { document: DocumentInput; focus?: string },
  cb: StreamCallbacks,
): Promise<AiResult> {
  return postJsonStream<AiResult>("/api/review-document", args, cb);
}

export async function crossCheckDocument(
  args: { document: DocumentInput; jurisdiction?: string },
  cb: StreamCallbacks,
): Promise<AiResult> {
  return postJsonStream<AiResult>("/api/cross-check", args, cb);
}

export async function stressTestContract(
  args: { document: DocumentInput; side?: "my" | "other"; concern?: string },
  cb: StreamCallbacks,
): Promise<AiResult> {
  return postJsonStream<AiResult>("/api/stress-test", args, cb);
}
