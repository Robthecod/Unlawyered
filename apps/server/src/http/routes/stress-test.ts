/**
 * POST /api/stress-test
 */
import { Router } from "express";
import { StressTestRequestSchema } from "@unlawyered/shared";
import { runTool } from "./ai-shared.js";
import { asyncHandler, parseBody } from "../util.js";

export const stressTestRouter = Router();

stressTestRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { document, side, concern } = parseBody(StressTestRequestSchema, req.body);
    const payload = [
      `The user uploaded a contract named "${document.name}" (${document.text.length} characters).`,
      `Stress-test it from the perspective of the ${side === "my" ? "user's side (the party who uploaded it)" : "other side (the counterparty)"}.`,
      concern ? `The user is especially worried about: ${concern}` : "",
      ``,
      `CONTRACT TEXT START`,
      document.text,
      `CONTRACT TEXT END`,
    ]
      .filter(Boolean)
      .join("\n");
    const result = await runTool("stress-test", payload);
    res.json(result);
  }),
);
