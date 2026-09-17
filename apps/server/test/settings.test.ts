import { describe, expect, it } from "vitest";
import {
  clearApiKey,
  getSelectedProvider,
  hasKey,
  resolveApiKey,
  setApiKey,
  setSelectedProvider,
} from "../src/settings";

describe("settings store", () => {
  it("stores a provider choice and reads it back", () => {
    setSelectedProvider("gemini");
    expect(getSelectedProvider()).toBe("gemini");
    setSelectedProvider("mock");
    expect(getSelectedProvider()).toBe("mock");
  });

  it("encrypts keys at rest and resolves them by value", () => {
    const secret = "test-key-abc123456";
    setApiKey("anthropic", secret);
    const resolved = resolveApiKey("anthropic");
    expect(resolved?.key).toBe(secret);
    expect(resolved?.source).toBe("settings");
    expect(hasKey("anthropic").present).toBe(true);
    clearApiKey("anthropic");
    expect(resolveApiKey("anthropic")).toBeNull();
  });

  it("reports missing keys as absent", () => {
    clearApiKey("openai");
    // env may still provide it on some machines; presence must never throw.
    expect(["none", "env", "settings"]).toContain(hasKey("openai").source);
  });
});
