/**
 * POST /api/cross-check
 */
import { Router } from "express";
import { CrossCheckRequestSchema } from "@unlawyered/shared";
import { runTool } from "./ai-shared.js";
import { asyncHandler, parseBody } from "../util.js";

export const crossCheckRouter = Router();

crossCheckRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { document, jurisdiction } = parseBody(CrossCheckRequestSchema, req.body);
    const payload = [
      `The user uploaded a document named "${document.name}" (${document.text.length} characters).`,
      `Jurisdiction to check against: ${jurisdiction}`,
      ``,
      `DOCUMENT TEXT START`,
      document.text,
      `DOCUMENT TEXT END`,
    ].join("\n");
    const result = await runTool("cross-check", payload);
    res.json(result);
  }),
);
