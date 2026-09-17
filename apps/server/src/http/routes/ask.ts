/**
 * POST /api/ask — the first AI feature wired end-to-end.
 */
import { Router } from "express";
import { AskRequestSchema } from "@unlawyered/shared";
import { runTool } from "./ai-shared.js";
import { asyncHandler, parseBody } from "../util.js";

export const askRouter = Router();

askRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { question, jurisdiction } = parseBody(AskRequestSchema, req.body);
    const payload = [
      `The user asks (jurisdiction: ${jurisdiction}):`,
      ``,
      question,
    ].join("\n");
    const result = await runTool("ask", payload);
    res.json(result);
  }),
);
