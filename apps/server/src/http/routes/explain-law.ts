/**
 * POST /api/explain-law
 */
import { Router } from "express";
import { ExplainLawRequestSchema } from "@unlawyered/shared";
import { runTool, runToolStream, wantsStream } from "./ai-shared.js";
import { asyncHandler, parseBody } from "../util.js";

export const explainLawRouter = Router();

explainLawRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { lawName, aspect } = parseBody(ExplainLawRequestSchema, req.body);
    const payload = [
      `Explain this Indian law: ${lawName}`,
      aspect ? `Focus especially on: ${aspect}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (wantsStream(req)) {
      await runToolStream("explain-law", payload, res);
      return;
    }
    const result = await runTool("explain-law", payload);
    res.json(result);
  }),
);
