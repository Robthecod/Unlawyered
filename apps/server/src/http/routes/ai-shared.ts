/**
 * Shared plumbing for the five AI tool routes: resolve the configured provider
 * (mock fallback), run the pipeline, and return the AiResult envelope.
 */
import type { AiResult, ProviderId } from "@unlawyered/shared";
import { pickProviderId, runAiTool } from "../../ai/pipeline.js";

export async function runTool(tool: Parameters<typeof runAiTool>[0], userPayload: string): Promise<AiResult> {
  const providerId = pickProviderId();
  return runAiTool(tool, providerId as ProviderId, userPayload);
}
