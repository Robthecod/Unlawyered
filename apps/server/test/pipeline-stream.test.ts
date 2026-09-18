/**
 * Pipeline streaming tests.
 *
 * runAiToolStream must emit the documented event sequence
 * (start -> meta -> delta* -> done) and must NEVER let the SOURCES footer —
 * or any prefix of it — appear in delta text: the live preview would flash
 * partial citation lines that only make sense once parsed. The done event
 * carries the fully parsed AiResult instead.
 *
 * fetch is stubbed, so this also exercises the gemini streamGenerate parser
 * across chunk boundaries without network access.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiStreamEvent } from "@unlawyered/shared";
import { runAiToolStream } from "../src/ai/pipeline";

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-stream";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function collect() {
  const events: AiStreamEvent[] = [];
  return { events, send: (e: AiStreamEvent) => events.push(e) };
}

describe("runAiToolStream (mock provider)", () => {
  it("emits start -> meta -> delta* -> done in order with a parsed result", async () => {
    // Provider id passed directly — no global settings mutation, so this
    // file cannot race the API test suites on the shared settings store.
    const { events, send } = collect();

    const result = await runAiToolStream("ask", "mock", "Can my landlord keep my deposit?", send);

    expect(events[0]?.type).toBe("start");
    const types = events.map((e) => e.type);
    expect(types.indexOf("start")).toBeLessThan(types.indexOf("meta"));
    expect(types.indexOf("meta")).toBeLessThan(types.indexOf("delta"));
    expect(types.filter((t) => t === "delta").length).toBeGreaterThan(1);
    expect(events[events.length - 1]?.type).toBe("done");

    expect(result.tool).toBe("ask");
    expect(result.provider).toBe("mock");
    expect(result.sources.length).toBe(2);
    // Deltas must not contain the footer; the parsed answer must not either.
    const deltaText = events
      .filter((e): e is Extract<AiStreamEvent, { type: "delta" }> => e.type === "delta")
      .map((e) => e.text)
      .join("");
    expect(deltaText).not.toContain("SOURCES:");
  });
});

describe("runAiToolStream (gemini via stubbed SSE)", () => {
  it("streams deltas from :streamGenerateContent and withholds the footer", async () => {
    const full =
      "In plain terms: yes, mostly.\n\n**The details**\n- Deposit must be returned [1]\n\nSOURCES:\n1 | Indian Contract Act, 1872 | s. 171 | s. 171 | bailment";
    const chunks = [
      "data: " + JSON.stringify({ candidates: [{ content: { parts: [{ text: "In plain terms: yes," }] } }] }) + "\n\n",
      "data: " + JSON.stringify({ candidates: [{ content: { parts: [{ text: " mostly." }] } }] }) + "\n\n",
      "data: " +
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "\n\n**The details**\n- Deposit must be returned [1]\n\nSOURCES:\n1 | Ind" }] } }] }) +
        "\n\n",
      "data: " + JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "ian Contract Act, 1872 | s. 171 | s. 171 | bailment" }] } }] }) + "\n\n",
    ];

    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/models?")) {
        return new Response(
          JSON.stringify({ models: [{ name: "models/gemini-test-flash", supportedGenerationMethods: ["generateContent"] }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes(":generateContent") && !url.includes("streamGenerateContent")) {
        // availability probe
        return new Response("{}", { status: 200 });
      }
      if (url.includes(":streamGenerateContent")) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            for (const c of chunks) controller.enqueue(encoder.encode(c));
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { events, send } = collect();
    const result = await runAiToolStream("ask", "gemini", "question", send);

    const deltaText = events
      .filter((e): e is Extract<AiStreamEvent, { type: "delta" }> => e.type === "delta")
      .map((e) => e.text)
      .join("");
    // Body streamed live...
    expect(deltaText).toContain("In plain terms: yes, mostly.");
    expect(deltaText).toContain("Deposit must be returned [1]");
    // ...but never any part of the footer.
    expect(deltaText).not.toContain("SOURCES:");
    expect(deltaText).not.toContain("Indian Contract Act");

    // Final parsed result carries the sources.
    expect(result.answer).not.toContain("SOURCES:");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.title).toBe("Indian Contract Act, 1872");
    expect(result.model).toBe("gemini-test-flash");

    const genUrl = String(fetchMock.mock.calls.find((c) => String(c[0]).includes(":streamGenerateContent"))?.[0]);
    expect(genUrl).toContain("alt=sse");
  });
});
