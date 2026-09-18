/**
 * API integration tests over the real Express app. Uses the default mock
 * provider, so no vendor keys are needed. The vitest config points the suite
 * at a per-run temp data dir, so these tests cannot touch the real settings
 * store; the restore below keeps the test store itself tidy.
 */
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { getSelectedProvider, setSelectedProvider } from "../src/settings";

const app = createApp();

// Tests mutate the shared settings store; restore whatever the user had.
const providerBefore = getSelectedProvider();
afterAll(() => {
  setSelectedProvider(providerBefore ?? "mock");
});

describe("GET /api/health", () => {
  it("responds 200 with service info", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("unlawyered-server");
  });
});

describe("settings", () => {
  it("lists providers with key status but never key values", async () => {
    const res = await request(app).get("/api/settings/providers").expect(200);
    expect(res.body.providers.length).toBeGreaterThanOrEqual(4);
    for (const p of res.body.providers) {
      expect(Object.keys(JSON.parse(JSON.stringify(p)))).not.toContain("apiKey");
    }
  });

  it("rejects invalid provider ids", async () => {
    await request(app)
      .post("/api/settings/provider")
      .send({ provider: "nope" })
      .expect(400);
  });

  it("rejects too-short keys", async () => {
    await request(app)
      .post("/api/settings/key")
      .send({ provider: "gemini", apiKey: "short" })
      .expect(400);
  });

  it("round-trips provider selection", async () => {
    await request(app).post("/api/settings/provider").send({ provider: "mock" }).expect(200);
    const res = await request(app).get("/api/settings/providers").expect(200);
    expect(res.body.selected).toBe("mock");
  });
});

describe("POST /api/ask", () => {
  it("returns an AiResult envelope with sources on the happy path", async () => {
    await request(app).post("/api/settings/provider").send({ provider: "mock" }).expect(200);
    const res = await request(app)
      .post("/api/ask")
      .send({ question: "Can my landlord keep my deposit for painting?" })
      .expect(200);
    expect(res.body.tool).toBe("ask");
    expect(res.body.provider).toBe("mock");
    expect(res.body.answer).toContain("In plain terms");
    expect(Array.isArray(res.body.sources)).toBe(true);
    expect(res.body.liveProvider).toBe(false);
  });

  it("validates the question", async () => {
    await request(app).post("/api/ask").send({ question: "x" }).expect(400);
    await request(app).post("/api/ask").send({}).expect(400);
  });
});

describe("POST /api/documents", () => {
  it("accepts a text upload and extracts text", async () => {
    const res = await request(app)
      .post("/api/documents")
      .attach("file", Buffer.from("RENT AGREEMENT\n1. Deposit Rs. 5,00,000."), "agreement.txt")
      .expect(200);
    expect(res.body.document.name).toBe("agreement.txt");
    expect(res.body.text).toContain("Deposit");
  });

  it("rejects unsupported file types", async () => {
    await request(app)
      .post("/api/documents")
      .attach("file", Buffer.from("MZ..."), "evil.exe")
      .expect(400);
  });

  it("rejects oversized uploads with a clear 413 (not a generic 500)", async () => {
    const big = Buffer.alloc(31 * 1024 * 1024, 65); // 31 MB of 'A'
    const res = await request(app)
      .post("/api/documents")
      .attach("file", big, { filename: "big.txt", contentType: "text/plain" })
      .expect(413);
    expect(res.body.error?.code).toBe("file-too-large");
  });
});

describe("document tools", () => {
  const doc = {
    name: "agreement.txt",
    text: "RENT AGREEMENT\n1. Deposit Rs. 5,00,000.\n2. Termination without notice.",
  };

  it("review-document returns an answer with sources", async () => {
    const res = await request(app)
      .post("/api/review-document")
      .send({ document: doc })
      .expect(200);
    expect(res.body.tool).toBe("review-document");
    expect(res.body.answer.length).toBeGreaterThan(50);
  });

  it("cross-check returns sources array", async () => {
    const res = await request(app)
      .post("/api/cross-check")
      .send({ document: doc, jurisdiction: "India" })
      .expect(200);
    expect(res.body.tool).toBe("cross-check");
    expect(Array.isArray(res.body.sources)).toBe(true);
  });

  it("stress-test accepts side and concern", async () => {
    const res = await request(app)
      .post("/api/stress-test")
      .send({ document: doc, side: "my", concern: "termination" })
      .expect(200);
    expect(res.body.tool).toBe("stress-test");
  });

  it("rejects empty document text", async () => {
    await request(app)
      .post("/api/review-document")
      .send({ document: { name: "empty.txt", text: "" } })
      .expect(400);
  });
});

describe("explain tools", () => {
  it("explain-law works", async () => {
    const res = await request(app)
      .post("/api/explain-law")
      .send({ lawName: "Transfer of Property Act 1882" })
      .expect(200);
    expect(res.body.tool).toBe("explain-law");
  });

  it("removed explain-judgment route returns 404", async () => {
    await request(app)
      .post("/api/explain-judgment")
      .send({ caseName: "Kesavananda Bharati v. State of Kerala" })
      .expect(404);
  });
});
