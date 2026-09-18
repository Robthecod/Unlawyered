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
  (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      // Multer rejects oversized uploads with MulterError(LIMIT_FILE_SIZE);
      // surfacing it raw would fall through to the generic 500 handler.
      if (err instanceof Error && "code" in err && (err as { code?: string }).code === "LIMIT_FILE_SIZE") {
        next(
          new HttpError(
            413,
            "file-too-large",
            `File too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB). Split it or export fewer pages.`,
          ),
        );
        return;
      }
      next(err);
    });
  },
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, "no-file", "No file received. Attach a .txt, .md, .pdf or .docx file.");

    assertUploadAllowed(file.originalname, file.size);

    let text = "";
    try {
      text = await extractText(file.originalname, file.buffer);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      // extractText maps PDF/docx failures to precise messages already; this is
      // the rare escape hatch (e.g. mammoth throwing on a malformed docx), so
      // keep it neutral — do NOT mention "password-protected" (the #1 false lead).
      throw new HttpError(422, "extract-failed", `Could not read "${file.originalname}". The file may be malformed — try re-exporting it (e.g. print → Save as PDF) and upload again.`);
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
