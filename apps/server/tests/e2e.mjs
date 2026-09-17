#!/usr/bin/env node
/**
 * Live end-to-end check against a RUNNING server.
 *   node tests/e2e.mjs [baseUrl]
 * Defaults to http://127.0.0.1:8787. Exercises the milestone-1 connection
 * check, one AI tool, and the upload endpoint with the mock provider.
 */
const BASE = process.argv[2] ?? "http://127.0.0.1:8787";
let failures = 0;

function check(name, cond, extra = "") {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name} ${extra}`);
  }
}

async function j(url, opts) {
  const res = await fetch(url, opts);
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  return { res, body };
}

console.log(`UNLAWYERED e2e -> ${BASE}\n`);

/* 1. Milestone-1 connection check */
const health = await j(`${BASE}/api/health`);
check("health returns 200", health.res.status === 200);
check("health payload ok", health.body?.ok === true && health.body?.service === "unlawyered-server");

/* 2. Provider is configured (default mock) */
await j(`${BASE}/api/settings/provider`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ provider: "mock" }),
});
const provs = await j(`${BASE}/api/settings/providers`);
check("providers listed", Array.isArray(provs.body?.providers) && provs.body.providers.length >= 4);
check("no key material in providers payload", !JSON.stringify(provs.body).match(/apiKey/));

/* 3. First AI feature end-to-end */
const ask = await j(`${BASE}/api/ask`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ question: "Can my landlord keep my deposit for painting the walls?" }),
});
check("ask returns 200", ask.res.status === 200);
check("ask envelope has tool/provider/answer/sources", Boolean(ask.body?.tool && ask.body?.provider && ask.body?.answer && Array.isArray(ask.body?.sources)));

/* 4. Reusable upload endpoint */
const form = new FormData();
form.append("file", new Blob(["RENT AGREEMENT\n1. Deposit Rs. 5,00,000.\n"], { type: "text/plain" }), "agreement.txt");
const up = await j(`${BASE}/api/documents`, { method: "POST", body: form });
check("upload returns 200", up.res.status === 200);
check("upload extracts text", typeof up.body?.text === "string" && up.body.text.includes("Deposit"));

/* 5. Remaining tools respond with the envelope */
for (const [path, payload] of [
  ["/api/explain-law", { lawName: "Transfer of Property Act 1882" }],
  ["/api/review-document", { document: { name: "a.txt", text: "Agreement with deposit clause." } }],
  ["/api/cross-check", { document: { name: "a.txt", text: "Agreement with deposit clause." } }],
  ["/api/stress-test", { document: { name: "a.txt", text: "Clause 1: terminate without notice." } }],
]) {
  const r = await j(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  check(`${path} -> 200 with sources`, r.res.status === 200 && Array.isArray(r.body?.sources));
}

/* 6. Validation still rejects garbage */
const bad = await j(`${BASE}/api/ask`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ question: "x" }),
});
check("validation rejects bad input", bad.res.status === 400);

console.log(failures === 0 ? "\nAll e2e checks passed." : `\n${failures} e2e check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
