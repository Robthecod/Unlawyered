/**
 * API integration tests for the SSE streaming mode of the AI tool endpoints.
 *
 * The JSON contract is unchanged (existing suites cover it); here we pin the
 * streaming contract: Accept: text/event-stream yields an SSE response whose
 * event sequence is start -> meta -> delta* -> done, whose deltas never
 * contain the SOURCES footer, and whose done event carries the same AiResult
 * shape the JSON path returns. Validation errors still surface as normal
 * 400 JSON responses even when streaming was requested.
 */
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { AiStreamEvent } from "@unlawyered/shared";
import { createApp } from "../src/app";
import { getSelectedProvider, setSelectedProvider } from "../src/settings";

const app = createApp();

const providerBefore = getSelectedProvider();
afterAll(() => {
  setSelectedProvider(providerBefore ?? "mock");
});

/** Parse an SSE body into typed events (data: lines only). */
function parseSse(text: string): AiStreamEvent[] {
  return text
    .split("\n\n")
    .map((frame) => frame.split("\n").find((l) => l.startsWith("data:")) ?? "")
    .filter((l) => l.startsWith("data:"))
    .map((l) => JSON.parse(l.slice(5).trim()) as AiStreamEvent);
}

describe("POST /api/ask (streaming)", () => {
  it("streams the full event sequence and ends with a parsed result", async () => {
    await request(app).post("/api/settings/provider").send({ provider: "mock" }).expect(200);
    const res = await request(app)
      .post("/api/ask")
      .set("Accept", "text/event-stream")
      .send({ question: "Can my landlord keep my deposit for painting?" })
      .expect(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");

    const events = parseSse(res.text);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("start");
    expect(types).toContain("meta");
    expect(types.filter((t) => t === "delta").length).toBeGreaterThan(1);
    expect(types[types.length - 1]).toBe("done");

    const done = events[events.length - 1] as Extract<AiStreamEvent, { type: "done" }>;
    expect(done.result.tool).toBe("ask");
    expect(done.result.answer).toContain("In plain terms");
    expect(done.result.sources.length).toBe(2);
    expect(done.result.liveProvider).toBe(false);

    const deltaText = events
      .filter((e): e is Extract<AiStreamEvent, { type: "delta" }> => e.type === "delta")
      .map((e) => e.text)
      .join("");
    expect(deltaText).not.toContain("SOURCES:");
  });

  it("still validates the body even when streaming was requested", async () => {
    await request(app)
      .post("/api/ask")
      .set("Accept", "text/event-stream")
      .send({ question: "x" })
      .expect(400);
  });

  it("keeps plain JSON responses for clients that did not ask for SSE", async () => {
    const res = await request(app)
      .post("/api/ask")
      .send({ question: "Can my landlord keep my deposit?" })
      .expect(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body.tool).toBe("ask");
  });
});

describe("other tool endpoints (streaming)", () => {
  const doc = {
    name: "agreement.txt",
    text: "RENT AGREEMENT\n1. Deposit Rs. 5,00,000.\n2. Termination without notice.",
  };

  it("stress-test streams when asked", async () => {
    const res = await request(app)
      .post("/api/stress-test")
      .set("Accept", "text/event-stream")
      .send({ document: doc, side: "my" })
      .expect(200);
    const events = parseSse(res.text);
    expect(events[events.length - 1]?.type).toBe("done");
    const done = events[events.length - 1] as Extract<AiStreamEvent, { type: "done" }>;
    expect(done.result.tool).toBe("stress-test");
  });

  it("cross-check and review-document stream when asked", async () => {
    for (const [url, body] of [
      ["/api/cross-check", { document: doc }],
      ["/api/review-document", { document: doc }],
    ] as const) {
      const res = await request(app).post(url).set("Accept", "text/event-stream").send(body).expect(200);
      const events = parseSse(res.text);
      expect(events[events.length - 1]?.type).toBe("done");
    }
  });

  it("explain-law streams when asked", async () => {
    const res = await request(app)
      .post("/api/explain-law")
      .set("Accept", "text/event-stream")
      .send({ lawName: "Transfer of Property Act 1882" })
      .expect(200);
    const events = parseSse(res.text);
    expect(events[events.length - 1]?.type).toBe("done");
  });
});
