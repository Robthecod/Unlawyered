/**
 * Settings routes. Keys flow browser -> backend once, get encrypted at rest,
 * and are never returned to any client.
 */
import { Router } from "express";
import {
  SetKeyRequestSchema,
  SetProviderRequestSchema,
  ProviderIdSchema,
  type ProviderInfo,
  type TestConnectionResult,
} from "@unlawyered/shared";
import {
  clearApiKey,
  getSelectedProvider,
  setApiKey,
  setSelectedProvider,
} from "../../settings.js";
import { getProvider, listProviders } from "../../providers/index.js";
import { asyncHandler, badRequest, parseBody } from "../util.js";

export const settingsRouter = Router();

settingsRouter.get("/providers", (_req, res) => {
  const providers: ProviderInfo[] = listProviders();
  res.json({ providers, selected: getSelectedProvider() });
});

settingsRouter.post(
  "/provider",
  asyncHandler(async (req, res) => {
    const { provider } = parseBody(SetProviderRequestSchema, req.body);
    setSelectedProvider(provider);
    res.json({ ok: true, provider });
  }),
);

settingsRouter.post(
  "/key",
  asyncHandler(async (req, res) => {
    const { provider, apiKey } = parseBody(SetKeyRequestSchema, req.body);
    if (provider === "mock") throw badRequest("The Mock provider doesn't use a key.");
    setApiKey(provider, apiKey);
    res.json({ ok: true, provider, hasKey: true });
  }),
);

settingsRouter.delete(
  "/key",
  asyncHandler(async (req, res) => {
    const parsed = ProviderIdSchema.safeParse(req.body?.provider);
    if (!parsed.success) throw badRequest("provider is required");
    const removed = clearApiKey(parsed.data);
    res.json({ ok: true, removed });
  }),
);

settingsRouter.post(
  "/test",
  asyncHandler(async (req, res) => {
    const parsed = ProviderIdSchema.safeParse(req.body?.provider);
    if (!parsed.success) throw badRequest("provider is required");
    const provider = getProvider(parsed.data);
    const started = Date.now();
    try {
      const { model } = await provider.testConnection();
      const result: TestConnectionResult = {
        ok: true,
        provider: provider.id,
        model,
        latencyMs: Date.now() - started,
        detail: `${provider.label} responded in ${Date.now() - started} ms using ${model}.`,
      };
      res.json(result);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Connection failed.";
      const status = (err as { status?: number }).status ?? 502;
      const result: TestConnectionResult = { ok: false, provider: provider.id, detail };
      res.status(status === 400 ? 400 : 502).json(result);
    }
  }),
);
