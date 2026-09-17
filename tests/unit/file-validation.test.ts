import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "@/lib/config";
import { detectExamFileSignature, validateExamFile } from "@/lib/imports/file-validation";

describe("exam upload validation", () => {
  it("detects supported magic bytes", () => {
    expect(detectExamFileSignature(new TextEncoder().encode("%PDF-1.7"))).toBe("PDF");
    expect(detectExamFileSignature(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]))).toBe("DOCX");
    expect(detectExamFileSignature(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe("DOC");
  });

  it("requires extension, declared MIME and signature to agree", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nbody");
    expect(validateExamFile({ name: "exam.pdf", declaredMime: "application/pdf", bytes }).fileType).toBe("PDF");
    expect(() => validateExamFile({ name: "exam.docx", declaredMime: "application/zip", bytes })).toThrow("FILE_SIGNATURE_MISMATCH");
    expect(() => validateExamFile({ name: "exam.pdf", declaredMime: "text/plain", bytes })).toThrow("FILE_MIME_MISMATCH");
  });

  it("keeps unsupported types and oversized files outside the import pipeline", () => {
    expect(() =>
      validateExamFile({
        name: "exam.txt",
        declaredMime: "text/plain",
        bytes: new TextEncoder().encode("plain text"),
      }),
    ).toThrow("INVALID_FILE_EXTENSION");

    expect(() =>
      validateExamFile({
        name: "exam.pdf",
        declaredMime: "application/pdf",
        bytes: new Uint8Array(APP_CONFIG.upload.maxBytes + 1),
      }),
    ).toThrow("INVALID_FILE_SIZE");
  });
});
