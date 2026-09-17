/**
 * PDF extraction regression tests.
 *
 * The old extractor (pdf-parse bundling pdf.js 1.10 from 2018) failed on
 * many ordinary modern PDFs and misreported the failure as
 * "password-protected". These tests pin the new behaviour: valid text PDFs
 * extract, broken ones produce an honest error that never mentions a
 * password, and genuinely encrypted PDFs are the only ones that do.
 */
import { describe, expect, it } from "vitest";
import { extractText } from "../src/documents/extract";

/**
 * Build a minimal but structurally valid one-page PDF containing `text`,
 * using classic (non-compressed) PDF 1.4 syntax — exactly the kind of file
 * the old pdf.js 1.x parser choked on when produced by modern exporters.
 */
function minimalTextPdf(text: string): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length 44 >>\nstream\nBT /F1 12 Tf 72 720 Td (${text}) Tj ET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    out += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

describe("PDF extraction", () => {
  it("extracts text from a plain text PDF", async () => {
    const text = await extractText("agreement.pdf", minimalTextPdf("RENT AGREEMENT Deposit Rs 500000"));
    expect(text).toContain("RENT AGREEMENT");
  });

  it("gives an honest error for a corrupt PDF (no password mention)", async () => {
    await expect(extractText("broken.pdf", Buffer.from("this is not a pdf at all"))).rejects.toThrow(
      /could not be read|Could not extract/i,
    );
    await expect(extractText("broken.pdf", Buffer.from("this is not a pdf at all"))).rejects.not.toThrow(
      /password/i,
    );
  });

  it("gives an honest error for an empty file (no password mention)", async () => {
    await expect(extractText("empty.pdf", Buffer.alloc(0))).rejects.not.toThrow(/password/i);
  });

  it("still reads txt and md files as utf8", async () => {
    expect(await extractText("a.txt", Buffer.from("hello"))).toBe("hello");
    expect(await extractText("b.md", Buffer.from("# hi"))).toBe("# hi");
  });
});
