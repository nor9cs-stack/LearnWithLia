import "server-only";

import { zh } from "@/lib/i18n/zh";

export type ExtractionResult =
  | { status: "READY"; text: string }
  | { status: "OCR_REQUIRED"; text: "" }
  | { status: "FAILED"; text: ""; code: string; message: string };

type DiagnosticError = {
  name: string;
  code?: string;
  message: string;
  stack?: string;
  cause?: DiagnosticError | DiagnosticError[];
};

const sensitiveValuePattern = /(authorization|cookie|password|secret|session|token|key)(\s*[:=]\s*)([^\s,;]+)/gi;
const urlPattern = /https?:\/\/[^\s"')]+/gi;

function sanitizeDiagnosticText(value: string) {
  return value
    .replace(urlPattern, (candidate) => {
      try {
        const url = new URL(candidate);
        url.username = "";
        url.password = "";
        url.search = "";
        url.hash = "";
        return url.origin + url.pathname;
      } catch {
        return "[REDACTED_URL]";
      }
    })
    .replace(sensitiveValuePattern, "$1$2[REDACTED]")
    .slice(0, 4_000);
}

function serializeDiagnosticError(error: unknown, depth = 0): DiagnosticError {
  if (!(error instanceof Error)) {
    return { name: "NonError", message: sanitizeDiagnosticText(String(error)) };
  }

  const rawCode = Reflect.get(error, "code");
  const rawCause = Reflect.get(error, "cause");
  const diagnostic: DiagnosticError = {
    name: error.name || "Error",
    ...(typeof rawCode === "string" ? { code: sanitizeDiagnosticText(rawCode) } : {}),
    message: sanitizeDiagnosticText(error.message),
    ...(error.stack ? { stack: sanitizeDiagnosticText(error.stack) } : {}),
  };

  if (depth >= 4 || rawCause === undefined) return diagnostic;
  diagnostic.cause = Array.isArray(rawCause)
    ? rawCause.slice(0, 8).map((cause) => serializeDiagnosticError(cause, depth + 1))
    : serializeDiagnosticError(rawCause, depth + 1);
  return diagnostic;
}

function extractionErrorCode(error: unknown, fileType: "PDF" | "DOCX" | "DOC") {
  if (fileType === "DOC") return "DOC_EXTRACTION_FAILED";
  if (fileType !== "PDF") return "EXTRACTION_FAILED";

  const diagnostic = JSON.stringify(serializeDiagnosticError(error));
  if (/pdf\.worker\.mjs|setting up fake worker failed/i.test(diagnostic)) return "PDF_RUNTIME_WORKER_UNAVAILABLE";
  if (/failed to load native binding|canvas-linux/i.test(diagnostic)) return "PDF_RUNTIME_NATIVE_BINDING_UNAVAILABLE";
  if (/InvalidPDFException|invalid pdf|pdf structure/i.test(diagnostic)) return "INVALID_PDF";
  return "EXTRACTION_FAILED";
}

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
  } catch (error) {
    console.error("[exam-import] extraction failed", {
      fileType,
      error: serializeDiagnosticError(error),
    });
    return {
      status: "FAILED",
      text: "",
      code: extractionErrorCode(error, fileType),
      message: fileType === "DOC" ? zh.imports.docFailed : zh.imports.failed,
    };
  }
}
