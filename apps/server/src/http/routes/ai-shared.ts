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

  // Keep-alive pings keep proxies and Render's edge from closing an idle
  // stream while the first token is still pending (endpoint resolution,
  // provider queueing, and Gemini first-token latency can easily exceed 15s).
  // Render's edge terminates idle upstream connections at ~15s, so the ping
  // must land BEFORE that: first ping immediately (flushes response head
  // through buffering proxies too), then every 5s for the stream's life.
  res.write(": ping\n\n");
  const ping = setInterval(() => res.write(": ping\n\n"), 5_000);
  let sawTerminal = false;
  try {
    const providerId = pickProviderId();
    await runAiToolStream(tool, providerId as ProviderId, userPayload, (event) => {
      if (event.type === "error" || event.type === "done") sawTerminal = true;
      send(event);
    });
  } catch {
    // runAiToolStream already emitted an `error` event; the response ends here.
  }
  // Belt and braces: if generation died without a terminal event (e.g. an
  // exception between emissions), never end the stream bare — the client
  // would otherwise report a vague "ended before it finished".
  if (!sawTerminal) send({ type: "error", code: "incomplete-stream", message: "The answer generation ended unexpectedly. Please try again." });
  clearInterval(ping);
  res.end();
}
