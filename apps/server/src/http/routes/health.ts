/**
 * GET /api/health — the front end <-> back end connection check.
 * Intentionally dependency-free so it works even if the AI layer is broken.
 */
import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "unlawyered-server",
    version: "0.1.0",
    time: new Date().toISOString(),
  });
});
