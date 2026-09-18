/**
 * Streaming-hardening regression tests, written after live verification of
 * the deployed stress-test tool showed a real answer cut mid-sentence with
 * zero sources: the terminal SSE frame (which carries the vendor's
 * truncation signal) was silently dropped, and nothing else detected it.
 *
 * Three layers must hold:
 *  1. createSseLineParser must flush a trailing frame not terminated by a
 *     newline — vendors put their TERMINAL frame last.
 *  2. Every streaming provider must map its truncation signal (Gemini
 *     finishReason=MAX_TOKENS, OpenAI finish_reason=length, Anthropic
 *     stop_reason=max_tokens) to a loud "truncated-answer" error.
 *  3. runAiToolStream must emit an `error` event (not an empty stream) when
 *     the provider has no key configured.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSseLineParser } from "../src/providers/types";
import type { AiStreamEvent } from "@unlawyered/shared";
import { runAiToolStream } from "../src/ai/pipeline";
import { setSelectedProvider, setApiKey, clearApiKey } from "../src/settings";
import { config } from "../src/config";

const savedEnvKeys = { ...config.envKeys };

afterEach(() => {
  vi.unstubAllGlobals();
  clearApiKey("gemini");
  clearApiKey("openai");
  clearApiKey("anthropic");
  config.envKeys = savedEnvKeys;
});

describe("createSseLineParser", () => {
  it("flushes a trailing frame not terminated by a newline", () => {
    const got: string[] = [];
    const { feed, flush } = createSseLineParser((d) => got.push(d));
    feed('data: {"ok":true}\n\ndata: {"last":true}');
    flush();
    expect(got).toEqual(['{"ok":true}', '{"last":true}']);
  });

  it("emits nothing extra when the stream ends cleanly with newlines", () => {
    const got: string[] = [];
    const { feed, flush } = createSseLineParser((d) => got.push(d));
    feed("data: one\n\ndata: two\n\n");
    flush();
    expect(got).toEqual(["one", "two"]);
  });
});

function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(f));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("stream truncation detection per provider", () => {
  it("gemini: MAX_TOKENS on an unterminated final frame -> truncated-answer", async () => {
    setApiKey("gemini", "test-key-trunc");
    const terminal =
      "data: " +
      JSON.stringify({
        candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "" }] } }],
      });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes("/models?")) {
          return new Response(
            JSON.stringify({ models: [{ name: "models/gemini-test", supportedGenerationMethods: ["generateContent"] }] }),
            { status: 200 },
          );
        }
        if (url.includes(":generateContent")) return new Response("{}", { status: 200 });
        if (url.includes(":streamGenerateContent")) {
          // Deliberately NO trailing newline after the terminal frame.
          return sseResponse([
            'data: {"candidates":[{"content":{"parts":[{"text":"half an ans"}]}}]}\n\n',
            terminal,
          ]);
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    const events: AiStreamEvent[] = [];
    await expect(runAiToolStream("ask", "gemini", "q", (e) => events.push(e))).rejects.toThrow(/token limit/);
    expect(events.at(-1)?.type).toBe("error");
    const err = events.at(-1) as Extract<AiStreamEvent, { type: "error" }>;
    expect(err.code).toBe("truncated-answer");
  });

  it("openai: finish_reason=length -> truncated-answer", async () => {
    setSelectedProvider("openai");
    setApiKey("openai", "sk-test-trunc");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          'data: {"choices":[{"delta":{"content":"partial ans"}}]}\n\n',
          'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n',
          "data: [DONE]\n\n",
        ]),
      ),
    );

    const events: AiStreamEvent[] = [];
    await expect(runAiToolStream("ask", "openai", "q", (e) => events.push(e))).rejects.toThrow(/token limit/);
    expect(events.at(-1)?.type).toBe("error");
    expect((events.at(-1) as Extract<AiStreamEvent, { type: "error" }>).code).toBe("truncated-answer");
  });

  it("anthropic: stop_reason=max_tokens -> truncated-answer", async () => {
    setSelectedProvider("anthropic");
    setApiKey("anthropic", "sk-ant-test-trunc");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"partial ans"}}\n\n',
          'data: {"type":"message_delta","delta":{"stop_reason":"max_tokens"}}\n\n',
        ]),
      ),
    );

    const events: AiStreamEvent[] = [];
    await expect(runAiToolStream("ask", "anthropic", "q", (e) => events.push(e))).rejects.toThrow(/token limit/);
    expect(events.at(-1)?.type).toBe("error");
    expect((events.at(-1) as Extract<AiStreamEvent, { type: "error" }>).code).toBe("truncated-answer");
  });
});

describe("runAiToolStream missing-key handling", () => {
  it("emits an error event when the provider has no key", async () => {
    setSelectedProvider("openai");
    clearApiKey("openai");
    // Neutralize any env-provided key: config.envKeys is captured at module
    // load, so it can hold a real key even with no stored one.
    (config as { envKeys: Record<string, string | undefined> }).envKeys = {};

    const events: AiStreamEvent[] = [];
    await expect(runAiToolStream("ask", "openai", "q", (e) => events.push(e))).rejects.toThrow();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("error");
    expect((events[0] as Extract<AiStreamEvent, { type: "error" }>).code).toBe("missing-key");
  });
});
