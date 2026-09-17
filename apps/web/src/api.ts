/**
 * API client. Every call goes to OUR backend (same origin in dev via the
 * Vite proxy) — never directly to an AI vendor. Keys never pass through here
 * except the one deliberate Settings POST to our own server.
 */
import type {
  AiResult,
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
  return handleWithRetry<UploadedDoc>("/api/documents", {
    method: "POST",
    body: form,
  });
}

/* ------------------------------------------------------------------ */
/* AI tools                                                            */
/* ------------------------------------------------------------------ */

export async function askLegalQuestion(args: {
  question: string;
  jurisdiction?: string;
}): Promise<AiResult> {
  return postJson<AiResult>("/api/ask", args);
}

export async function explainLaw(args: {
  lawName: string;
  aspect?: string;
}): Promise<AiResult> {
  return postJson<AiResult>("/api/explain-law", args);
}

export async function reviewDocument(args: {
  document: DocumentInput;
  focus?: string;
}): Promise<AiResult> {
  return postJson<AiResult>("/api/review-document", args);
}

export async function crossCheckDocument(args: {
  document: DocumentInput;
  jurisdiction?: string;
}): Promise<AiResult> {
  return postJson<AiResult>("/api/cross-check", args);
}

export async function stressTestContract(args: {
  document: DocumentInput;
  side?: "my" | "other";
  concern?: string;
}): Promise<AiResult> {
  return postJson<AiResult>("/api/stress-test", args);
}
