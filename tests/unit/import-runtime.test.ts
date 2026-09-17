import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const parserMocks = vi.hoisted(() => ({
  extractDoc: vi.fn(),
  extractDocx: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/exams/submission", () => ({ submitAttempt: vi.fn() }));
vi.mock("mammoth", () => ({
  default: { extractRawText: parserMocks.extractDocx },
}));
vi.mock("word-extractor", () => ({
  default: class WordExtractor {
    extract(bytes: Buffer) {
      return parserMocks.extractDoc(bytes);
    }
  },
}));

describe("server import runtime", () => {
  it("loads the Inngest route without DOMMatrix and serves GET", async () => {
    const previousInngestDev = process.env.INNGEST_DEV;
    process.env.INNGEST_DEV = "1";
    Reflect.deleteProperty(globalThis, "DOMMatrix");

    try {
      const { GET, POST, PUT } = await import("@/app/api/inngest/route");

      expect(Reflect.get(globalThis, "DOMMatrix")).toBeUndefined();
      expect(GET).toBeTypeOf("function");
      expect(POST).toBeTypeOf("function");
      expect(PUT).toBeTypeOf("function");

      const response = await GET(new NextRequest("http://localhost/api/inngest"), {});
      expect(response.status).toBe(200);
    } finally {
      if (previousInngestDev === undefined) delete process.env.INNGEST_DEV;
      else process.env.INNGEST_DEV = previousInngestDev;
    }
  });

  it("extracts known text from a real PDF fixture in Node", async () => {
    Reflect.deleteProperty(globalThis, "DOMMatrix");
    const [{ extractExamText }, fixture] = await Promise.all([
      import("@/lib/imports/extract"),
      readFile(new URL("../fixtures/minimal-text.pdf", import.meta.url)),
    ]);

    const result = await extractExamText(new Uint8Array(fixture), "PDF");

    expect(result.status).toBe("READY");
    expect(result.text).toContain("LearnWithLia PDF extraction fixture text");
    expect(Reflect.get(globalThis, "DOMMatrix")).toBeTypeOf("function");
  });

  it("keeps DOCX extraction on its format-specific loader", async () => {
    parserMocks.extractDocx.mockResolvedValueOnce({ value: "LearnWithLia DOCX extraction remains available" });
    const { extractExamText } = await import("@/lib/imports/extract");

    await expect(extractExamText(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]), "DOCX")).resolves.toEqual({
      status: "READY",
      text: "LearnWithLia DOCX extraction remains available",
    });
  });

  it("keeps DOC extraction on its format-specific loader", async () => {
    parserMocks.extractDoc.mockResolvedValueOnce({
      getBody: () => "LearnWithLia legacy DOC extraction remains available",
    });
    const { extractExamText } = await import("@/lib/imports/extract");

    await expect(extractExamText(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0]), "DOC")).resolves.toEqual({
      status: "READY",
      text: "LearnWithLia legacy DOC extraction remains available",
    });
  });
});
