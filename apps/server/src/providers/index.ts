/**
 * Provider registry — the switchboard. Routes and Settings talk only to this.
 * Adding a vendor = new file + one line here. Nothing else changes.
 */
import type { ProviderId, ProviderInfo } from "@unlawyered/shared";
import { hasKey } from "../settings.js";
import { mockProvider } from "./mock";
import { geminiProvider } from "./gemini";
import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import type { Provider } from "./types";

const REGISTRY: Record<ProviderId, Provider> = {
  mock: mockProvider,
  gemini: geminiProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

export function getProvider(id: ProviderId): Provider {
  const p = REGISTRY[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

export function listProviders(): ProviderInfo[] {
  return (Object.keys(REGISTRY) as ProviderId[]).map((id) => {
    const p = REGISTRY[id];
    const key = hasKey(id);
    return {
      id,
      label: p.label,
      note: p.note,
      requiresKey: p.requiresKey,
      hasKey: id === "mock" ? true : key.present,
      keySource: id === "mock" ? "settings" : key.source,
    };
  });
}
