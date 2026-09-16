export type ParsedDraftQuestion = {
  promptMd: string;
  type: "SINGLE_CHOICE" | "FILL_BLANK" | "SHORT_ANSWER";
  gradingMode: "AUTO" | "MANUAL";
  options: string[];
};

const questionStart = /^\s*(\d{1,3})[.)、．]\s*(.+)$/;
const optionStart = /^\s*[A-H][.)、．]\s*(.+)$/i;

export function parseDraftQuestions(text: string): ParsedDraftQuestion[] {
  const blocks: string[][] = [];
  let current: string[] | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const start = line.match(questionStart);
    if (start) {
      if (current?.length) blocks.push(current);
      current = [start[2] ?? ""];
    } else if (current) {
      current.push(line);
    }
  }
  if (current?.length) blocks.push(current);

  const questions: ParsedDraftQuestion[] = [];
  for (const block of blocks) {
    const options = block.slice(1).map((line) => line.match(optionStart)?.[1]).filter((value): value is string => Boolean(value));
    const promptLines = block.filter((line, index) => index === 0 || !optionStart.test(line));
    const promptMd = promptLines.join("\n").trim();
    if (!promptMd) continue;
    if (options.length >= 2) questions.push({ promptMd, type: "SINGLE_CHOICE", gradingMode: "AUTO", options });
    else if (/_{3,}|＿{3,}|\(\s*\)/.test(promptMd)) questions.push({ promptMd, type: "FILL_BLANK", gradingMode: "AUTO", options: [] });
    else questions.push({ promptMd, type: "SHORT_ANSWER", gradingMode: "MANUAL", options: [] });
  }
  return questions;
}
