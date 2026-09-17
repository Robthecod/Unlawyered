/**
 * POST /api/documents — the one upload endpoint every document tool shares.
 * Accepts .txt/.md/.pdf/.docx, extracts text, returns metadata + preview.
 * Text is kept in memory per request; the AI tools take the text inline.
 */
import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import type { UploadedDocument } from "@unlawyered/shared";
import { MAX_UPLOAD_BYTES } from "../../config.js";
import { assertUploadAllowed, extractText } from "../../documents/extract.js";
import { asyncHandler, HttpError } from "../util.js";

export const documentsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

documentsRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, "no-file", "No file received. Attach a .txt, .md, .pdf or .docx file.");

    assertUploadAllowed(file.originalname, file.size);

    let text = "";
    try {
      text = await extractText(file.originalname, file.buffer);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(422, "extract-failed", `Could not read "${file.originalname}". Is the file valid and not password-protected?`);
    }

    const textTrimmed = text.trim();
    if (!textTrimmed) {
      throw new HttpError(422, "empty-document", "The file contained no readable text (maybe a scanned PDF?).");
    }

    const doc: UploadedDocument = {
      id: randomUUID(),
      name: file.originalname,
      sizeBytes: file.size,
      characters: textTrimmed.length,
      preview: textTrimmed.slice(0, 200),
      createdAt: new Date().toISOString(),
    };

    res.json({ document: doc, text: textTrimmed });
  }),
);
