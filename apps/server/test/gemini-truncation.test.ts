/**
 * Regression tests for the Gemini truncation bug.
 *
 * Bug: a response that stopped with finishReason MAX_TOKENS was returned as
 * if it were complete, silently losing the mandatory SOURCES footer — the UI
 * then showed "0 sources" next to a half-finished answer.
 *
 * Contract under test:
 *  - real generation runs with the raised 8192-token output cap
 *  - a MAX_TOKENS generation throws ProviderError("truncated-answer")
 *  - a normal STOP generation still resolves with the answer + model
 *  - the tiny testConnection probe stays exempt (a 5-token "pong" may stop
 *    on MAX_TOKENS and must still count as a successful connectivity check)
 *
 * fetch is stubbed by URL (models list / availability probe / generation), so
 * the stub is insensitive to the provider's module-level model cache: warm or
 * cold, every request gets a valid response. No network, no real key usage —
 * the key comes from the env override set below before config.ts loads.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiProvider } from "../src/providers/gemini";

// config.ts snapshots process.env at import time, so the env key must be set
// before the module graph loads (vi.hoisted runs ahead of imports).
vi.hoisted(() => {
  process.env.GEMINI_API_KEY =
    process.env.GEMINI_API_KEY ?? "test-key-gemini-truncation";
});

const MODEL_ID = "gemini-test-flash";

function okRes(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function geminiResponse(finishReason: string, text: string): unknown {
  return {
    candidates: [{ finishReason, content: { parts: [{ text }] } }],
  };
}

interface RecordedCall {
  url: string;
  body: {
    contents?: Array<{ parts?: Array<{ text?: string }> }>;
    generationConfig?: { maxOutputTokens?: number };
  };
}

/**
 * URL-aware fetch stub: GET /models -> model list, POST generateContent with
 * the literal probe text "ping" -> {} (probe OK), anything else -> the
 * scripted generation response. Returns the recorded generateContent calls.
 */
function stubGeminiFetch(generationResponse: unknown) {
  const calls: RecordedCall[] = [];
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/models?")) {
      return okRes({
        models: [
          {
            name: `models/${MODEL_ID}`,
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      });
    }
    const parsed = JSON.parse(String(init?.body ?? "{}")) as RecordedCall["body"];
    calls.push({ url, body: parsed });
    const text = parsed.contents?.[0]?.parts?.[0]?.text;
    if (text === "ping") return okRes({}); // availability probe -> usable
    return okRes(generationResponse);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gemini truncation regression", () => {
  it("generates with the raised 8192-token output cap", async () => {
    const calls = stubGeminiFetch(geminiResponse("STOP", "In plain terms: ok."));
    await geminiProvider.generate({
      system: "system prompt",
      user: "ask something",
      tool: "ask",
    });
    const generation = calls.find(
      (c) => c.body.contents?.[0]?.parts?.[0]?.text === "ask something",
    );
    expect(generation).toBeDefined();
    expect(generation?.body.generationConfig?.maxOutputTokens).toBe(8192);
  });

  it("throws truncated-answer (not an uncited answer) when MAX_TOKENS cuts the reply", async () => {
    stubGeminiFetch(
      geminiResponse(
        "MAX_TOKENS",
        "In plain terms: half an answer with no SOURCES foot",
      ),
    );
    await expect(
      geminiProvider.generate({
        system: "system prompt",
        user: "cross-check this long document",
        tool: "cross-check",
      }),
    ).rejects.toMatchObject({
      name: "ProviderError",
      code: "truncated-answer",
      status: 502,
    });
  });

  it("resolves normally when the model finishes with STOP", async () => {
    const answer =
      "In plain terms: done.\n\nSOURCES:\n1 | Indian Contract Act, 1872 | s. 10 | s. 10 | validity";
    stubGeminiFetch(geminiResponse("STOP", answer));

    const result = await geminiProvider.generate({
      system: "system prompt",
      user: "ask something",
      tool: "ask",
    });
    expect(result.answer).toContain("SOURCES:");
    expect(result.model).toBe(MODEL_ID);
  });

  it("testConnection stays exempt: a MAX_TOKENS pong still succeeds", async () => {
    stubGeminiFetch(geminiResponse("MAX_TOKENS", "po"));

    const { model } = await geminiProvider.testConnection();
    expect(model).toBe(MODEL_ID);
  });

  it("empty MAX_TOKENS output (thinking-only budget) surfaces as truncated-answer, not empty-answer", async () => {
    stubGeminiFetch({
      candidates: [{ finishReason: "MAX_TOKENS", content: null }],
    });

    await expect(
      geminiProvider.generate({
        system: "system prompt",
        user: "ask something",
        tool: "ask",
      }),
    ).rejects.toMatchObject({
      name: "ProviderError",
      code: "truncated-answer",
      status: 502,
    });
  });
});
