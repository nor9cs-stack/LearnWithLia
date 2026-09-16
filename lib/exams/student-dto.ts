type StudentQuestionRecord = {
  id: string;
  type: string;
  promptMd: string;
  points: { toString(): string } | string | number;
  passage: { contentMd: string } | null;
  options: { id: string; contentMd: string }[];
};

type StudentResponseRecord = {
  questionId: string;
  selected: { optionId: string }[];
  textAnswer: string | null;
  booleanAnswer: boolean | null;
  version: number;
};

type StudentUnknownWordRecord = {
  id: string;
  questionId: string;
  exactText: string;
  prefix: string;
  suffix: string;
  occurrence: number;
};

function plainText(markdown: string) {
  return markdown
    .replace(/<[^>]*>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#~-]/g, "")
    .trim();
}

/**
 * Creates the only question shape accepted by the in-progress exam client.
 * Answer keys are deliberately absent from both the input and output types.
 */
export function createStudentExamQuestions(
  questions: StudentQuestionRecord[],
  responses: StudentResponseRecord[],
  unknownWords: StudentUnknownWordRecord[],
) {
  const responseMap = new Map(responses.map((response) => [response.questionId, response]));
  return questions.map((question) => {
    const response = responseMap.get(question.id);
    return {
      id: question.id,
      type: question.type,
      promptText: plainText(question.promptMd),
      sourceText: plainText(`${question.passage?.contentMd ?? ""} ${question.promptMd}`),
      points: question.points.toString(),
      options: question.options.map((option) => ({ id: option.id, content: plainText(option.contentMd) })),
      response: {
        selectedOptionIds: response?.selected.map((item) => item.optionId) ?? [],
        textAnswer: response?.textAnswer ?? "",
        booleanAnswer: response?.booleanAnswer ?? null,
        version: response?.version ?? 0,
      },
      unknownWords: unknownWords
        .filter((word) => word.questionId === question.id)
        .map(({ id, questionId, exactText, prefix, suffix, occurrence }) => ({ id, questionId, exactText, prefix, suffix, occurrence })),
    };
  });
}
