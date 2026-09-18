/**
 * POST /api/review-document
 */
import { Router } from "express";
import { ReviewDocumentRequestSchema } from "@unlawyered/shared";
import { runTool, runToolStream, wantsStream } from "./ai-shared.js";
import { asyncHandler, parseBody } from "../util.js";

export const reviewDocumentRouter = Router();

reviewDocumentRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { document, focus } = parseBody(ReviewDocumentRequestSchema, req.body);
    const payload = [
      `The user uploaded a document named "${document.name}" (${document.text.length} characters).`,
      focus ? `The user wants particular attention to: ${focus}` : "",
      ``,
      `DOCUMENT TEXT START`,
      document.text,
      `DOCUMENT TEXT END`,
    ]
      .filter(Boolean)
      .join("\n");
    if (wantsStream(req)) {
      await runToolStream("review-document", payload, res);
      return;
    }
    const result = await runTool("review-document", payload);
    res.json(result);
  }),
);
