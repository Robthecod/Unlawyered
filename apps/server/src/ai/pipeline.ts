/**
 * The shared AI pipeline used by all five tools:
 *   request -> system prompt (persona + tool instruction + output protocol)
 *           -> provider.generate -> parseAnswer (answer + sources + citations)
 *           -> AiResult envelope
 */
import {
  DEFAULT_MODELS,
  type AiResult,
  type AiStreamEvent,
  type ProviderId,
  type ToolId,
} from "@unlawyered/shared";
import { buildSystemPrompt, TOOL_INSTRUCTIONS } from "../providers/prompt.js";
import { parseAnswer } from "../providers/parse.js";
import { getProvider } from "../providers/index.js";
import { getSelectedProvider, resolveApiKey } from "../settings.js";
import { ProviderError } from "../providers/types.js";

export function resolveProviderOrThrow(providerId: ProviderId) {
  const provider = getProvider(providerId);
  if (provider.requiresKey && !provider.getApiKey()) {
    throw new ProviderError(
      400,
      "missing-key",
      `No ${provider.label} API key configured. Add one in Settings.`,
    );
  }
  return provider;
}

/** The provider the app should use: the one stored in Settings, else mock. */
export function pickProviderId(): ProviderId {
  try {
    const stored = getSelectedProvider();
    if (stored) return stored;
    // Nothing stored (fresh deploy, ephemeral disk, first boot): fall back to
    // the first env-seeded provider with a usable key. Env keys exist so the
    // app works before anyone opens Settings — honoring them only when a real
    // generation calls resolveApiKey would half-work (requests would succeed
    // via mock while the UI claims a real provider is configured).
    for (const id of ["gemini", "openai", "anthropic"] as const) {
      if (resolveApiKey(id)?.key) return id;
    }
    return "mock";
  } catch {
    return "mock";
  }
}

export async function runAiTool(
  tool: ToolId,
  requestedProvider: ProviderId,
  userPayload: string,
): Promise<AiResult> {
  const provider = resolveProviderOrThrow(requestedProvider);
  const system = buildSystemPrompt(toolTitle(tool), TOOL_INSTRUCTIONS[tool]);
  const started = Date.now();

  const { answer, model } = await provider.generate({
    system,
    user: userPayload,
    tool,
  });

  const parsed = parseAnswer(answer);
  return {
    tool,
    provider: provider.id,
    model: model || DEFAULT_MODELS[provider.id],
    answer: parsed.answer,
    sources: parsed.sources,
    citations: parsed.citations,
    liveProvider: provider.id !== "mock",
    latencyMs: Date.now() - started,
  };
}

/**
 * Streaming twin of runAiTool: emits AiStreamEvents to `send` while the
 * model writes, then finishes with the fully parsed AiResult.
 *
 * The SOURCES footer is held back: raw model output ends with "SOURCES:\n1 |
 * ..." lines that only make sense once parsed, so the live preview must not
 * show them. parseAnswer() already splits the footer off — we simply write
 * each delta only up to the footer boundary and let `done` carry the parsed
 * sources for the real panel.
 */
export async function runAiToolStream(
  tool: ToolId,
  requestedProvider: ProviderId,
  userPayload: string,
  send: (event: AiStreamEvent) => void,
): Promise<AiResult> {
  // Resolve the provider INSIDE try: config errors (missing key, etc.) must
  // reach the client as an `error` event. If this ran after writeHead(200) had
  // already been sent by the route, throwing here would end the stream with
  // zero events and the user would see a silent failure.
  try {
    const provider = resolveProviderOrThrow(requestedProvider);
    const system = buildSystemPrompt(toolTitle(tool), TOOL_INSTRUCTIONS[tool]);
    const started = Date.now();

    send({ type: "start" });
    let metaSent = false;

    const emitDelta = (text: string) => {
      if (!metaSent) {
        // First token arrived: endpoint resolution is done and text is on its
        // way — announce the stream before the first visible text. The exact
        // model id only becomes known when the stream completes; `done`
        // carries the authoritative value.
        metaSent = true;
        send({ type: "meta", provider: provider.id, model: DEFAULT_MODELS[provider.id], tool });
      }
      // Hold back anything at/after the SOURCES footer so partial citation
      // lines never flash in the preview.
      send({ type: "delta", text: stripFromSourcesFooter(text) });
    };

    const args = { system, user: userPayload, tool };
    const gen =
      provider.streamGenerate
        ? await provider.streamGenerate(args, emitDelta)
        : await (async () => {
            // Fallback: no streaming support -> one delta with everything.
            const r = await provider.generate(args);
            emitDelta(r.answer);
            return r;
          })();

    const parsed = parseAnswer(gen.answer);
    const result: AiResult = {
      tool,
      provider: provider.id,
      model: gen.model || DEFAULT_MODELS[provider.id],
      answer: parsed.answer,
      sources: parsed.sources,
      citations: parsed.citations,
      liveProvider: provider.id !== "mock",
      latencyMs: Date.now() - started,
    };
    send({ type: "done", result });
    return result;
  } catch (err) {
    const status = err instanceof ProviderError ? err.status : 502;
    const code = err instanceof ProviderError ? err.code : "provider-failed";
    const message = err instanceof Error ? err.message : "Generation failed.";
    send({ type: "error", code, message: message || `Generation failed (HTTP ${status}).` });
    throw err;
  }
}

/**
 * Truncate text at the SOURCES footer boundary, tolerating a footer that is
 * still mid-flight across deltas (e.g. "SOUR", "SOURCES:", "SOURCES:\n1 |").
 * Returns the text up to the footer start, or the text unchanged when no
 * footer has begun yet.
 */
function stripFromSourcesFooter(text: string): string {
  const idx = text.search(/\n\s*(?:\*\*)?sources(?:\*\*)?\s*:/i);
  if (idx !== -1) return text.slice(0, idx);
  // A partial "sources" token at the very end might still grow into the
  // footer — hold it back; the final parse will re-attach anything that was
  // actually body text.
  return text.replace(/\n\s*(?:\*\*)?s(?:o(?:u(?:r(?:c(?:e?s?)?)?)?)?)?\s*$/i, "");
}

function toolTitle(tool: ToolId): string {
  switch (tool) {
    case "explain-law":
      return "Explain an Indian law";
    case "ask":
      return "Answer a legal question (India)";
    case "review-document":
      return "Review a document in plain English";
    case "cross-check":
      return "Cross-check a document against Indian law with citations";
    case "stress-test":
      return "Stress-test this contract adversarially";
  }
}

/** Used by a diagnostics route to report current AI setup without leaking keys. */
export function describeProviderSetup(): { provider: ProviderId; hasKey: boolean } {
  const id = pickProviderId();
  const p = getProvider(id);
  return {
    provider: id,
    hasKey: !p.requiresKey || Boolean(resolveApiKey(id)?.key),
  };
}
