/**
 * Mock provider — deterministic, keyless. Useful for local dev, tests, and the
 * e2e run, so the full request -> parse -> response pipeline is exercised
 * without any vendor. It speaks the same SOURCES footer protocol as real
 * providers, so parse.ts and the UI sources pipeline are genuinely tested.
 */
import type { GenerateArgs, Provider } from "./types";
import { ProviderError } from "./types";

function mockAnswer(tool: string, user: string): string {
  const q = user.slice(0, 160).replace(/\s+/g, " ").trim();
  const topic =
    tool === "explain-law" ? "the law you named"
    : tool === "review-document" ? "your document"
    : tool === "cross-check" ? "your document"
    : tool === "stress-test" ? "your contract"
    : "your question";

  return `**In plain terms:** this is a mock answer about ${topic}. Replace the Mock provider in Settings with a real one (e.g. Gemini) for real analysis.

**What this covers**
- Your input started with: "${q}"
- Tool: \`${tool}\` — the full pipeline (prompt -> provider -> parser -> API -> UI) ran for real.
- Sources below are mock sources so you can see how citations render.

**What to do next**
- Open **Settings**, choose a real provider, paste an API key, hit Test connection.
- Re-run this tool to get real Indian-law analysis with live sources.

**Important:** mock answers are not legal information of any quality.

SOURCES:
1 | Constitution of India | Art. 21 | Art. 21 | mock citation for pipeline demonstration
2 | Indian Contract Act, 1872 | s. 10 | s. 10 | mock citation for pipeline demonstration`;
}

export const mockProvider: Provider = {
  id: "mock",
  label: "Mock (no key needed)",
  note: "Deterministic fake answers for trying the app and running tests. Not legal information.",
  requiresKey: false,
  getApiKey: () => "mock",
  async testConnection() {
    return { model: "mock-1" };
  },
  async generate({ tool, user }: GenerateArgs) {
    // Simulate a little latency so the UI behaves realistically.
    await new Promise((r) => setTimeout(r, 150));
    if (user.trim().length === 0) {
      throw new ProviderError(400, "empty-input", "No input was provided.");
    }
    return { answer: mockAnswer(tool, user), model: "mock-1" };
  },
};
