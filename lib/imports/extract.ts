import "server-only";

import { zh } from "@/lib/i18n/zh";

export type ExtractionResult =
  | { status: "READY"; text: string }
  | { status: "OCR_REQUIRED"; text: "" }
  | { status: "FAILED"; text: ""; code: string; message: string };

async function installPdfJsNodePrimitives() {
  const canvas = await import("@napi-rs/canvas");
  const primitives = {
    DOMMatrix: canvas.DOMMatrix,
    ImageData: canvas.ImageData,
    Path2D: canvas.Path2D,
  } as const;

  for (const [name, implementation] of Object.entries(primitives)) {
    if (Reflect.get(globalThis, name) === undefined) {
      Reflect.set(globalThis, name, implementation);
    }
  }
}

async function extractPdfText(bytes: Uint8Array): Promise<ExtractionResult> {
  await installPdfJsNodePrimitives();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    const text = result.text.trim();
    if (text.replace(/\s/g, "").length < 20) return { status: "OCR_REQUIRED", text: "" };
    return { status: "READY", text };
  } finally {
    await parser.destroy();
  }
}

export async function extractExamText(bytes: Uint8Array, fileType: "PDF" | "DOCX" | "DOC"): Promise<ExtractionResult> {
  try {
    if (fileType === "PDF") {
      return await extractPdfText(bytes);
    }
    if (fileType === "DOCX") {
      const { default: mammoth } = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      const text = result.value.trim();
      return text ? { status: "READY", text } : { status: "FAILED", text: "", code: "EMPTY_DOCX", message: zh.imports.emptyDocx };
    }
    const { default: WordExtractor } = await import("word-extractor");
    const extractor = new WordExtractor();
    const result = await extractor.extract(Buffer.from(bytes));
    const text = result.getBody().trim();
    return text ? { status: "READY", text } : { status: "FAILED", text: "", code: "EMPTY_DOC", message: zh.imports.emptyDoc };
  } catch {
    return {
      status: "FAILED",
      text: "",
      code: fileType === "DOC" ? "DOC_EXTRACTION_FAILED" : "EXTRACTION_FAILED",
      message: fileType === "DOC" ? zh.imports.docFailed : zh.imports.failed,
    };
  }
}
