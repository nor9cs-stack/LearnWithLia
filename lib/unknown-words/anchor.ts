import { APP_CONFIG } from "@/lib/config";

export type TextAnchor = {
  exactText: string;
  prefix: string;
  suffix: string;
  occurrence: number;
};

export function createTextAnchor(fullText: string, start: number, end: number): TextAnchor {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > fullText.length || start >= end) {
    throw new Error("INVALID_SELECTION");
  }
  const exactText = fullText.slice(start, end).trim();
  if (!exactText || exactText.length > APP_CONFIG.unknownWord.maxLength) {
    throw new Error("INVALID_SELECTION_LENGTH");
  }
  const adjustedStart = fullText.indexOf(exactText, start);
  const adjustedEnd = adjustedStart + exactText.length;
  const prefix = fullText.slice(
    Math.max(0, adjustedStart - APP_CONFIG.unknownWord.contextLength),
    adjustedStart,
  );
  const suffix = fullText.slice(
    adjustedEnd,
    adjustedEnd + APP_CONFIG.unknownWord.contextLength,
  );
  const occurrence = fullText.slice(0, adjustedStart).split(exactText).length - 1;
  return { exactText, prefix, suffix, occurrence };
}

export function resolveTextAnchor(fullText: string, anchor: TextAnchor) {
  const matches: number[] = [];
  let cursor = 0;
  while (cursor <= fullText.length - anchor.exactText.length) {
    const index = fullText.indexOf(anchor.exactText, cursor);
    if (index < 0) break;
    matches.push(index);
    cursor = index + Math.max(anchor.exactText.length, 1);
  }
  const contextual = matches.filter((index) => {
    const prefix = fullText.slice(Math.max(0, index - anchor.prefix.length), index);
    const suffix = fullText.slice(index + anchor.exactText.length, index + anchor.exactText.length + anchor.suffix.length);
    return prefix === anchor.prefix && suffix === anchor.suffix;
  });
  const candidates = contextual.length ? contextual : matches;
  const start = candidates[anchor.occurrence] ?? (candidates.length === 1 ? candidates[0] : undefined);
  return start == null ? null : { start, end: start + anchor.exactText.length };
}

export function removeTextAnchor<T extends { id: string }>(anchors: T[], id: string) {
  return anchors.filter((anchor) => anchor.id !== id);
}
