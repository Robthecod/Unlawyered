/**
 * The shared AI pipeline used by all five tools:
 *   request -> system prompt (persona + tool instruction + output protocol)
 *           -> provider.generate -> parseAnswer (answer + sources + citations)
 *           -> AiResult envelope
 */
import {
  DEFAULT_MODELS,
  type AiResult,
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
    return getSelectedProvider() ?? "mock";
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
