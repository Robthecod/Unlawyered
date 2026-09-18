/**
 * Regression tests for the Gemini thinking config.
 *
 * Gemini 2.5+ models think by default, adding seconds of invisible latency
 * and eating the output budget before the SOURCES footer (the truncation bug
 * this repo already guards against). thinkingConfigFor() must send exactly
 * the right field per model family — the wrong field is a 400 on every
 * request for that model:
 *  - 3-series        -> thinkingLevel: "low" (thinking can't be disabled)
 *  - 2.5 Flash/Lite  -> thinkingBudget: 0 (thinking fully disabled)
 *  - 2.5 Pro         -> nothing (rejects thinkingBudget 0)
 *  - anything else   -> nothing (never risk 400ing every request)
 */
import { describe, expect, it } from "vitest";
import { thinkingConfigFor } from "../src/providers/gemini";

describe("thinkingConfigFor", () => {
  it("disables thinking on 2.5 flash / flash-lite with thinkingBudget 0", () => {
    expect(thinkingConfigFor("gemini-2.5-flash")).toEqual({
      thinkingConfig: { thinkingBudget: 0 },
    });
    expect(thinkingConfigFor("gemini-2.5-flash-lite")).toEqual({
      thinkingConfig: { thinkingBudget: 0 },
    });
    expect(thinkingConfigFor("Gemini-2.5-Flash")).toEqual({
      thinkingConfig: { thinkingBudget: 0 },
    });
  });

  it("minimises (cannot disable) thinking on 3-series with thinkingLevel low", () => {
    expect(thinkingConfigFor("gemini-3-flash")).toEqual({
      thinkingConfig: { thinkingLevel: "low" },
    });
    expect(thinkingConfigFor("gemini-3.8-flash")).toEqual({
      thinkingConfig: { thinkingLevel: "low" },
    });
    expect(thinkingConfigFor("gemini-3-pro")).toEqual({
      thinkingConfig: { thinkingLevel: "low" },
    });
  });

  it("never sends a thinking config that would 400: 2.5 pro and unknown ids", () => {
    expect(thinkingConfigFor("gemini-2.5-pro")).toEqual({});
    expect(thinkingConfigFor("gemini-1.5-flash")).toEqual({});
    expect(thinkingConfigFor("gemini-2.0-flash")).toEqual({});
    expect(thinkingConfigFor("")).toEqual({});
    // 3-series must NOT carry thinkingBudget (they reject it), and 2.5 must
    // NOT carry thinkingLevel.
    const g3 = thinkingConfigFor("gemini-3-flash").thinkingConfig ?? {};
    expect("thinkingBudget" in g3).toBe(false);
    const g25 = thinkingConfigFor("gemini-2.5-flash").thinkingConfig ?? {};
    expect("thinkingLevel" in g25).toBe(false);
  });
});
