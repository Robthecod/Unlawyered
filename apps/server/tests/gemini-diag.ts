/**
 * Gemini diagnostics: list models visible to the stored key and probe each
 * candidate with a tiny request. Run: npx tsx apps/server/tests/gemini-diag.ts
 * The key is read from the local encrypted store and sent only to Google.
 */
import { resolveApiKey } from "../src/settings.js";

const BASES = [
  "https://generativelanguage.googleapis.com/v1beta",
  "https://generativelanguage.googleapis.com/v1",
];

const key = resolveApiKey("gemini")?.key;
if (!key) {
  console.error("No Gemini key stored. Save one in Settings first.");
  process.exit(1);
}

let models: Array<{ name: string; supportedGenerationMethods?: string[] }> = [];
let workingBase = "";

for (const base of BASES) {
  const res = await fetch(`${base}/models?pageSize=200`, {
    headers: { "x-goog-api-key": key },
  });
  console.log(`GET ${base}/models -> HTTP ${res.status}`);
  if (res.ok) {
    const json = (await res.json()) as { models?: typeof models };
    models = json.models ?? [];
    workingBase = base;
    break;
  } else {
    console.log(await res.text().catch(() => ""));
  }
}

if (!models.length) {
  console.error("Could not list models with this key.");
  process.exit(1);
}

console.log(`\nWorking API base: ${workingBase}`);
console.log(`Models visible to this key: ${models.length}\n`);

const chat = models
  .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
  .map((m) => m.name.replace(/^models\//, ""))
  .filter((id) => /^gemini/.test(id))
  .filter((id) => !/tts|image|audio|embed|aqa|veo|imagen|native-audio|live/.test(id));

console.log("Chat-capable candidates:");
for (const id of chat) console.log(`  - ${id}`);

console.log("\nProbing each candidate with a tiny generateContent request...\n");
for (const id of chat) {
  const res = await fetch(`${workingBase}/models/${id}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "say pong" }] }],
      generationConfig: { maxOutputTokens: 5 },
    }),
  }).catch((e) => null);

  if (!res) {
    console.log(`  ${id}: network error`);
    continue;
  }
  if (res.ok) {
    console.log(`  ${id}: OK ✅`);
  } else {
    const t = await res.text().catch(() => "");
    const reason = res.status === 429 ? "429 quota" : `HTTP ${res.status}`;
    console.log(`  ${id}: ${reason} ${t.slice(0, 90)}`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}
