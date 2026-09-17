import { createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { APP_CONFIG } from "@/lib/config";

const extensionToType = { pdf: "PDF", docx: "DOCX", doc: "DOC" } as const;
const allowedDeclaredMime = {
  PDF: ["application/pdf"],
  DOCX: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
  DOC: ["application/msword", "application/x-ole-storage"],
} as const;

export type ValidatedExamFile = {
  fileType: keyof typeof allowedDeclaredMime;
  detectedMime: string;
  sha256: string;
};

export function detectExamFileSignature(bytes: Uint8Array): ValidatedExamFile["fileType"] | null {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "PDF";
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "DOCX";
  const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (bytes.length >= ole.length && ole.every((byte, index) => bytes[index] === byte)) return "DOC";
  return null;
}

export function validateExamFile(input: {
  name: string;
  declaredMime: string;
  bytes: Uint8Array;
}): ValidatedExamFile {
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > APP_CONFIG.upload.maxBytes) {
    throw new Error("INVALID_FILE_SIZE");
  }
  const extension = input.name.split(".").pop()?.toLowerCase() as keyof typeof extensionToType | undefined;
  const expectedType = extension ? extensionToType[extension] : undefined;
  if (!expectedType) throw new Error("INVALID_FILE_EXTENSION");
  const detectedType = detectExamFileSignature(input.bytes);
  if (!detectedType || detectedType !== expectedType) throw new Error("FILE_SIGNATURE_MISMATCH");
  if (!(allowedDeclaredMime[detectedType] as readonly string[]).includes(input.declaredMime)) {
    throw new Error("FILE_MIME_MISMATCH");
  }
  return {
    fileType: detectedType,
    detectedMime:
      detectedType === "PDF"
        ? "application/pdf"
        : detectedType === "DOCX"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/msword",
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
  };
}

export async function validateExamFileContent(input: {
  name: string;
  declaredMime: string;
  bytes: Uint8Array;
}) {
  const validated = validateExamFile(input);
  const detected = await fileTypeFromBuffer(input.bytes);
  const validDetectedMimes: Record<ValidatedExamFile["fileType"], readonly string[]> = {
    PDF: ["application/pdf"],
    DOCX: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    DOC: ["application/x-cfb", "application/x-ole-storage", "application/msword"],
  };
  if (!detected || !validDetectedMimes[validated.fileType].includes(detected.mime)) {
    throw new Error("FILE_CONTENT_TYPE_MISMATCH");
  }
  return { ...validated, detectedMime: validDetectedMimes[validated.fileType][0]! };
}

export async function validateTextbookPdfContent(input: {
  name: string;
  declaredMime: string;
  bytes: Uint8Array;
}) {
  const validated = await validateExamFileContent(input);
  if (validated.fileType !== "PDF") throw new Error("TEXTBOOK_PDF_REQUIRED");
  return validated;
}
