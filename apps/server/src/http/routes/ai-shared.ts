/**
 * Shared plumbing for the five AI tool routes: resolve the configured provider
 * (mock fallback), run the pipeline, and return the AiResult envelope — or,
 * when the client sends Accept: text/event-stream, stream the answer over SSE.
 */
import type { AiResult, AiStreamEvent, ProviderId } from "@unlawyered/shared";
import type { Request, Response } from "express";
import { pickProviderId, runAiTool, runAiToolStream } from "../../ai/pipeline.js";

export async function runTool(tool: Parameters<typeof runAiTool>[0], userPayload: string): Promise<AiResult> {
  const providerId = pickProviderId();
  return runAiTool(tool, providerId as ProviderId, userPayload);
}

/** True when the client asked for the streamed variant of a tool endpoint. */
export function wantsStream(req: Request): boolean {
  return (req.headers.accept ?? "").includes("text/event-stream");
}

/**
 * Stream an AI tool over SSE. Emits the typed AiStreamEvent sequence
 * (start -> meta -> delta* -> done | error), then ends the response. Errors
 * BEFORE the response starts fall through to the normal error middleware;
 * once streaming has begun, errors travel as `error` events (headers are
 * already sent — an HTTP error code is no longer possible).
 */
export async function runToolStream(
  tool: Parameters<typeof runAiTool>[0],
  userPayload: string,
  res: Response,
): Promise<void> {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no", // disable Netlify/nginx response buffering
  });

  const send = (event: AiStreamEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Comment ping keeps proxies from closing an idle stream during the (up to
  // ~50 s) cold start before the first token arrives.
  const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
  try {
    const providerId = pickProviderId();
    await runAiToolStream(tool, providerId as ProviderId, userPayload, send);
  } catch {
    // runAiToolStream already emitted an `error` event; the response ends here.
  } finally {
    clearInterval(ping);
    res.end();
  }
}
