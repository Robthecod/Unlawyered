import { describe, expect, it } from "vitest";
import { parseAnswer } from "../src/providers/parse";

describe("parseAnswer", () => {
  it("splits the SOURCES footer from the body", () => {
    const raw = [
      "In plain terms: yes, you can.",
      "",
      "**More detail**",
      "- Point one [1]",
      "",
      "SOURCES:",
      "1 | Indian Contract Act, 1872 | s. 10 | s. 10 | essentials of a valid contract",
    ].join("\n");

    const out = parseAnswer(raw);
    expect(out.answer).not.toContain("SOURCES:");
    expect(out.answer).toContain("In plain terms");
    expect(out.sources).toHaveLength(1);
    expect(out.sources[0]?.title).toBe("Indian Contract Act, 1872");
    expect(out.sources[0]?.citation).toBe("s. 10");
    expect(out.sources[0]?.role).toBe("statute");
    expect(out.citations).toEqual([{ marker: "[1]", sourceIndex: 0 }]);
  });

  it("handles case-law sources", () => {
    const raw = `Text [2].\n\nSOURCES:\n1 | Constitution of India | Art. 21 | | fundamental right\n2 | Kesavananda Bharati v. State of Kerala | AIR 1973 SC 1461 | para 50 | basic structure`;
    const out = parseAnswer(raw);
    expect(out.sources).toHaveLength(2);
    expect(out.sources[0]?.role).toBe("statute");
    expect(out.sources[1]?.role).toBe("case");
    expect(out.citations.map((c) => c.sourceIndex)).toEqual([1]);
  });

  it("tolerates answers without a footer", () => {
    const out = parseAnswer("Just some text, no sources.");
    expect(out.answer).toBe("Just some text, no sources.");
    expect(out.sources).toHaveLength(0);
    expect(out.citations).toHaveLength(0);
  });

  it("ignores junk lines in the footer", () => {
    const raw = "Body.\n\nSOURCES:\nnot a source line\n1 | Real Statute | s. 1";
    const out = parseAnswer(raw);
    expect(out.sources).toHaveLength(1);
    expect(out.sources[0]?.title).toBe("Real Statute");
  });
});
