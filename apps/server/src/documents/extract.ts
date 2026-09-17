/**
 * Document text extraction: .txt/.md read as UTF-8, .pdf via unpdf (a
 * serverless-friendly build of a current Mozilla pdf.js), .docx via mammoth.
 * Validates extension before parsing.
 *
 * PDF errors are mapped to precise, actionable messages: a genuinely
 * encrypted PDF says "password-protected"; a scanned image-only PDF says
 * "no selectable text"; anything else surfaces the real cause instead of a
 * generic (and misleading) password claim.
 */
import { ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES } from "../config.js";
import { badRequest } from "../http/util.js";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function assertUploadAllowed(name: string, size: number): void {
  const ext = extOf(name);
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    throw badRequest(`Unsupported file type "${ext || name}". Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}`);
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw badRequest(`File too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).`);
  }
}

/**
 * Map a failed PDF extraction to a precise HttpError. The old pdf.js 1.x
 * stack reported every parse failure as "PasswordException" (or crashed on
 * modern PDF features like cross-reference streams), which made ordinary
 * PDFs look password-protected. This classifier tells the truth instead.
 */
function pdfError(name: string, err: unknown): never {
  const raw = err instanceof Error ? err.message : String(err);
  const code =
    typeof err === "object" && err !== null && "name" in err
      ? String((err as { name?: unknown }).name)
      : "";

  if (/password/i.test(code) || /password/i.test(raw)) {
    throw badRequest(
      `"${name}" is password-protected. Remove the password (re-save or print-to-PDF without one) and try again.`,
    );
  }
  if (/no text|image|scanned/i.test(raw)) {
    throw badRequest(
      `"${name}" contains no selectable text — it looks like a scan or image-only PDF. Export a text PDF (e.g. via print → Save as PDF) and try again.`,
    );
  }
  if (/corrupt|invalid|structure|parse|xref/i.test(raw)) {
    throw badRequest(
      `"${name}" could not be read — the file may be corrupted or only partially downloaded. Re-export it and try again.`,
    );
  }
  throw badRequest(`Could not extract text from "${name}": ${raw}`);
}

export async function extractText(name: string, buf: Buffer): Promise<string> {
  const ext = extOf(name);
  switch (ext) {
    case ".txt":
    case ".md":
      return buf.toString("utf8");
    case ".pdf": {
      try {
        // extractText unconditionally loads the serverless build of pdf.js
        // (v5.x) — no fetch, no worker, no Bun-compat flag needed under Node.
        const { extractText: extractPdfText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(new Uint8Array(buf));
        const { text, totalPages } = await extractPdfText(pdf, { mergePages: true });
        if (!text.trim()) {
          throw new Error(
            "no selectable text found — the PDF is likely a scan or image-only export",
          );
        }
        return totalPages > 1 ? `${text}\n` : text;
      } catch (err) {
        pdfError(name, err);
      }
    }
    case ".docx": {
      const mammoth = (await import("mammoth")) as {
        extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
      };
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value;
    }
    default:
      throw badRequest(`Unsupported file type "${ext}".`);
  }
}
