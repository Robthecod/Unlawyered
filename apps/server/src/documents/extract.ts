/**
 * Document text extraction: .txt/.md read as UTF-8, .pdf via pdf-parse,
 * .docx via mammoth. Validates extension before parsing.
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

export async function extractText(name: string, buf: Buffer): Promise<string> {
  const ext = extOf(name);
  switch (ext) {
    case ".txt":
    case ".md":
      return buf.toString("utf8");
    case ".pdf": {
      // Deep-import avoids pdf-parse's index.js debug-mode bug under ESM.
      const mod = (await import("pdf-parse/lib/pdf-parse.js")) as {
        default: (b: Buffer) => Promise<{ text: string }>;
      };
      const parsed = await mod.default(buf);
      return parsed.text;
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
