import "server-only";

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import WordExtractor from "word-extractor";
import { zh } from "@/lib/i18n/zh";

export type ExtractionResult =
  | { status: "READY"; text: string }
  | { status: "OCR_REQUIRED"; text: "" }
  | { status: "FAILED"; text: ""; code: string; message: string };

export async function extractExamText(bytes: Uint8Array, fileType: "PDF" | "DOCX" | "DOC"): Promise<ExtractionResult> {
  try {
    if (fileType === "PDF") {
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
    if (fileType === "DOCX") {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      const text = result.value.trim();
      return text ? { status: "READY", text } : { status: "FAILED", text: "", code: "EMPTY_DOCX", message: zh.imports.emptyDocx };
    }
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
