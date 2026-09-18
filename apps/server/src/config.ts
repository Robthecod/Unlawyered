/**
 * Server configuration from environment (all optional).
 * Nothing here is a provider API key for end users — those are entered in
 * Settings and stored encrypted. These env vars only pre-seed defaults for
 * self-hosters who want the app to work before anyone opens Settings.
 */
import { MAX_UPLOAD_BYTES as MAX_UPLOAD_BYTES_SHARED } from "@unlawyered/shared";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "127.0.0.1",
  /** Data directory for the encrypted settings store (gitignored). */
  dataDir: process.env.UNLAWYERED_DATA_DIR ?? path.resolve(here, "../../data"),
  /**
   * Secret used to encrypt API keys at rest. If not provided, one is
   * generated once and persisted next to the data dir.
   */
  secret: process.env.UNLAWYERED_SECRET,
  /** Optional pre-seeded keys (server-side only, never sent to clients). */
  envKeys: {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  } as Partial<Record<"gemini" | "openai" | "anthropic", string>>,
};

/** 30 MB raw upload cap (shared constant); text extracted must still pass the 400k-char check. */
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_BYTES_SHARED;

export const ALLOWED_UPLOAD_EXTENSIONS = [".txt", ".md", ".pdf", ".docx"];

export function ensureDataDir(): string {
  fs.mkdirSync(config.dataDir, { recursive: true });
  return config.dataDir;
}
