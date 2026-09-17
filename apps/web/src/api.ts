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

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
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
  return handle<UploadedDoc>(
    await fetch("/api/documents", { method: "POST", body: form }),
  );
}

/* ------------------------------------------------------------------ */
/* AI tools                                                            */
/* ------------------------------------------------------------------ */

export async function askLegalQuestion(args: {
  question: string;
  jurisdiction?: string;
}): Promise<AiResult> {
  return handle<AiResult>(await fetch("/api/ask", jsonRequest(args)));
}

export async function explainLaw(args: {
  lawName: string;
  aspect?: string;
}): Promise<AiResult> {
  return handle<AiResult>(await fetch("/api/explain-law", jsonRequest(args)));
}

export async function reviewDocument(args: {
  document: DocumentInput;
  focus?: string;
}): Promise<AiResult> {
  return handle<AiResult>(await fetch("/api/review-document", jsonRequest(args)));
}

export async function crossCheckDocument(args: {
  document: DocumentInput;
  jurisdiction?: string;
}): Promise<AiResult> {
  return handle<AiResult>(await fetch("/api/cross-check", jsonRequest(args)));
}

export async function stressTestContract(args: {
  document: DocumentInput;
  side?: "my" | "other";
  concern?: string;
}): Promise<AiResult> {
  return handle<AiResult>(await fetch("/api/stress-test", jsonRequest(args)));
}
