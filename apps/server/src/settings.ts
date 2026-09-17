/**
 * Settings store: provider selection + per-provider API keys.
 *
 * Security model:
 * - Keys arrive from the browser only via the Settings API and are NEVER
 *   echoed back to any client (not even masked — the API returns booleans).
 * - At rest they are AES-256-GCM encrypted with a machine-local secret
 *   (UNLAWYERED_SECRET, or an auto-generated secret file next to the data dir).
 * - The data directory is gitignored.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config, ensureDataDir } from "./config.js";
import type { ProviderId } from "@unlawyered/shared";

const DATA_FILE = "settings.json";
const SECRET_FILE = ".secret";

interface StoredSettings {
  version: 1;
  provider: ProviderId | null;
  /** provider id -> AES-256-GCM encrypted key (base64 iv:tag:ciphertext) */
  encryptedKeys: Partial<Record<ProviderId, string>>;
}

let cachedSecret: Buffer | null = null;

function getSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  const dir = ensureDataDir();

  if (config.secret) {
    cachedSecret = scryptSync(config.secret, "unlawyered.v1", 32);
    return cachedSecret;
  }

  const secretPath = path.join(dir, SECRET_FILE);
  if (fs.existsSync(secretPath)) {
    cachedSecret = scryptSync(fs.readFileSync(secretPath, "utf8").trim(), "unlawyered.v1", 32);
    return cachedSecret;
  }

  const generated = randomBytes(32).toString("hex");
  fs.writeFileSync(secretPath, generated, { encoding: "utf8", mode: 0o600 });
  cachedSecret = scryptSync(generated, "unlawyered.v1", 32);
  return cachedSecret;
}

function settingsPath(): string {
  return path.join(ensureDataDir(), DATA_FILE);
}

function readSettings(): StoredSettings {
  const p = settingsPath();
  if (!fs.existsSync(p)) {
    return { version: 1, provider: null, encryptedKeys: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as StoredSettings;
    if (parsed.version !== 1) throw new Error("unknown settings version");
    return parsed;
  } catch {
    // Corrupt store: start fresh rather than crash the server.
    return { version: 1, provider: null, encryptedKeys: {} };
  }
}

function writeSettings(s: StoredSettings): void {
  const tmp = settingsPath() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, settingsPath());
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSecret(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

function decrypt(payload: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", getSecret(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function getSelectedProvider(): ProviderId | null {
  return readSettings().provider;
}

export function setSelectedProvider(provider: ProviderId): void {
  const s = readSettings();
  s.provider = provider;
  writeSettings(s);
}

/** Store a key encrypted. Never returns the key itself. */
export function setApiKey(provider: ProviderId, apiKey: string): void {
  const s = readSettings();
  s.encryptedKeys[provider] = encrypt(apiKey);
  // Convenience: selecting a key usually means intent to use that provider.
  s.provider = provider;
  writeSettings(s);
}

export function clearApiKey(provider: ProviderId): boolean {
  const s = readSettings();
  if (!(provider in s.encryptedKeys)) return false;
  delete s.encryptedKeys[provider];
  writeSettings(s);
  return true;
}

/** Does a usable key exist for this provider (stored or env)? "env" wins visibility. */
export function hasKey(provider: ProviderId): { present: boolean; source: "settings" | "env" | "none" } {
  const env = (config.envKeys as Record<string, string | undefined>)[provider];
  if (env && env.trim().length > 0) return { present: true, source: "env" };
  const stored = readSettings().encryptedKeys[provider];
  if (stored && decrypt(stored) !== null) return { present: true, source: "settings" };
  return { present: false, source: "none" };
}

/**
 * Resolve the key for an outbound provider call. Env wins over stored.
 * Returns null when no usable key exists.
 */
export function resolveApiKey(provider: ProviderId): { key: string; source: "settings" | "env" } | null {
  const env = (config.envKeys as Record<string, string | undefined>)[provider];
  if (env && env.trim().length > 0) return { key: env.trim(), source: "env" };
  const stored = readSettings().encryptedKeys[provider];
  if (stored) {
    const key = decrypt(stored);
    if (key) return { key, source: "settings" };
  }
  return null;
}
