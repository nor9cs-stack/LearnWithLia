import { z } from "zod";

export const textbookMetadataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).optional(),
  studentIds: z.array(z.string().cuid()).max(500).default([]),
});

export const textbookAssignmentSchema = z.object({
  textbookId: z.string().cuid(),
  studentIds: z.array(z.string().cuid()).max(500),
});

export const textbookIdSchema = z.object({ textbookId: z.string().cuid() });
export const textbookDownloadModeSchema = z.enum(["0", "1"]).catch("0");

export function sanitizePdfFileName(name: string) {
  const base =
    name
      .split(/[\\/]/)
      .pop()
      ?.replace(/[\u0000-\u001f\u007f]/g, "")
      .trim() ?? "";
  const candidate = base.slice(0, 240);
  return candidate.toLowerCase().endsWith(".pdf") && candidate.length > 4
    ? candidate
    : "textbook.pdf";
}
