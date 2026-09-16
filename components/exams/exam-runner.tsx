"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkMinus, Highlighter, Send } from "lucide-react";
import { saveResponseAction, submitAttemptAction } from "@/app/actions/attempts";
import { deleteUnknownWordAction, saveUnknownWordAction } from "@/app/actions/unknown-words";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createTextAnchor, removeTextAnchor, resolveTextAnchor, type TextAnchor } from "@/lib/unknown-words/anchor";
import { questionTypeLabel, zh } from "@/lib/i18n/zh";

type Answer = {
  selectedOptionIds: string[];
  textAnswer: string;
  booleanAnswer: boolean | null;
  version: number;
};

type SavedWord = TextAnchor & { id: string; questionId: string };

type RunnerQuestion = {
  id: string;
  type: string;
  promptText: string;
  sourceText: string;
  points: string;
  options: { id: string; content: string }[];
  response: Answer;
  unknownWords: SavedWord[];
};

function HighlightedText({ text, words }: { text: string; words: SavedWord[] }) {
  const ranges = words
    .map((word) => ({ word, range: resolveTextAnchor(text, word) }))
    .filter((item): item is { word: SavedWord; range: { start: number; end: number } } => item.range !== null)
    .sort((left, right) => left.range.start - right.range.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const { word, range } of ranges) {
    if (range.start < cursor) continue;
    parts.push(text.slice(cursor, range.start));
    parts.push(<mark className="unknown-highlight" key={word.id}>{text.slice(range.start, range.end)}</mark>);
    cursor = range.end;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function ExamRunner({ attemptId, attemptNumber, expiresAt, questions }: { attemptId: string; attemptNumber: number; expiresAt: string | null; questions: RunnerQuestion[] }) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => Object.fromEntries(questions.map((question) => [question.id, question.response])));
  const [words, setWords] = useState<SavedWord[]>(() => questions.flatMap((question) => question.unknownWords));
  const [saveState, setSaveState] = useState<string>(zh.runner.autosave);
  const [remaining, setRemaining] = useState<number | null>(() => expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : null);
  const [pending, startTransition] = useTransition();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const answersRef = useRef(answers);
  const dirtyGenerations = useRef(new Map<string, number>());
  const inFlightSaves = useRef(new Map<string, Promise<boolean>>());
  const sourceRef = useRef<HTMLDivElement>(null);
  const question = questions[activeIndex];

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now())), 1_000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (remaining !== 0) return;
    startTransition(async () => {
      await submitAttemptAction({ attemptId });
      router.refresh();
    });
  }, [attemptId, remaining, router]);

  const answeredCount = useMemo(() => Object.values(answers).filter((answer) => answer.selectedOptionIds.length || answer.textAnswer.trim() || answer.booleanAnswer !== null).length, [answers]);

  if (!question) return null;
  const activeQuestion = question;

  async function persistAnswer(questionId: string, next: Answer, generation: number) {
    setSaveState(zh.runner.saving);
    const result = await saveResponseAction({ attemptId, questionId, expectedVersion: next.version, selectedOptionIds: next.selectedOptionIds, textAnswer: next.textAnswer || null, booleanAnswer: next.booleanAnswer });
    if (result.ok) {
      const latest = answersRef.current[questionId] ?? next;
      const saved = { ...latest, version: result.version };
      answersRef.current = { ...answersRef.current, [questionId]: saved };
      setAnswers((current) => ({ ...current, [questionId]: { ...current[questionId]!, version: result.version } }));
      if (dirtyGenerations.current.get(questionId) === generation) {
        dirtyGenerations.current.delete(questionId);
      }
      setSaveState(zh.runner.saved);
      return true;
    }
    if (result.reason === "EXPIRED" || result.reason === "ALREADY_SUBMITTED") {
      router.refresh();
    } else {
      setSaveState(result.reason === "CONFLICT" ? zh.runner.conflict : zh.runner.saveFailed);
    }
    return false;
  }

  function queueSave(questionId: string, next: Answer) {
    setAnswers((current) => ({ ...current, [questionId]: next }));
    answersRef.current = { ...answersRef.current, [questionId]: next };
    const generation = (dirtyGenerations.current.get(questionId) ?? 0) + 1;
    dirtyGenerations.current.set(questionId, generation);
    const previous = timers.current.get(questionId);
    if (previous) clearTimeout(previous);
    setSaveState(zh.runner.waiting);
    timers.current.set(questionId, setTimeout(async () => {
      const task = persistAnswer(questionId, next, generation);
      inFlightSaves.current.set(questionId, task);
      await task;
      if (inFlightSaves.current.get(questionId) === task) inFlightSaves.current.delete(questionId);
    }, 650));
  }

  async function flushPendingAnswers() {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    await Promise.all(inFlightSaves.current.values());
    for (const [questionId, generation] of [...dirtyGenerations.current.entries()]) {
      const answer = answersRef.current[questionId];
      if (answer && !(await persistAnswer(questionId, answer, generation))) return false;
    }
    return true;
  }

  async function confirmAndSubmit() {
    if (!window.confirm(zh.runner.confirmSubmit)) return;
    setSaveState(zh.runner.savingFinal);
    if (!(await flushPendingAnswers())) return;
    await submitAttemptAction({ attemptId });
    router.refresh();
  }

  async function markSelection() {
    const container = sourceRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.rangeCount !== 1 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      setSaveState(zh.runner.selectInside);
      return;
    }
    const before = range.cloneRange();
    before.selectNodeContents(container);
    before.setEnd(range.startContainer, range.startOffset);
    try {
      const anchor = createTextAnchor(container.textContent ?? "", before.toString().length, before.toString().length + range.toString().length);
      const result = await saveUnknownWordAction({ attemptId, questionId: activeQuestion.id, ...anchor });
      setWords((current) => current.some((item) => item.id === result.word.id) ? current : [...current, { id: result.word.id, questionId: result.word.questionId, exactText: result.word.exactText, prefix: result.word.prefix, suffix: result.word.suffix, occurrence: result.word.occurrence }]);
      selection.removeAllRanges();
      setSaveState(zh.runner.marked);
    } catch {
      setSaveState(zh.runner.selectionTooLong);
    }
  }

  const currentAnswer = answers[question.id] ?? question.response;
  const currentWords = words.filter((word) => word.questionId === question.id);
  const minutes = remaining == null ? null : Math.floor(remaining / 60_000);
  const seconds = remaining == null ? null : Math.floor((remaining % 60_000) / 1_000);

  return (
    <div className="runner-layout">
      <aside className="question-nav" aria-label={zh.runner.navigation}>
        <div><strong>{zh.common.attempt(attemptNumber)}</strong>{remaining == null ? <span>{zh.common.untimed}</span> : <span className={remaining < 5 * 60_000 ? "time-warning" : ""}>{minutes}:{String(seconds).padStart(2, "0")}</span>}</div>
        <Progress value={(answeredCount / questions.length) * 100}/><p>{zh.runner.answered(answeredCount, questions.length)}</p>
        <div className="question-nav-grid">{questions.map((item, index) => { const answered = answers[item.id]?.selectedOptionIds.length || answers[item.id]?.textAnswer.trim() || answers[item.id]?.booleanAnswer !== null; return <button key={item.id} className={`${index === activeIndex ? "active" : ""} ${answered ? "answered" : ""}`} type="button" onClick={() => setActiveIndex(index)} aria-label={zh.runner.goToQuestion(index + 1)}>{index + 1}</button>; })}</div>
        <Button type="button" onClick={() => startTransition(confirmAndSubmit)} disabled={pending}><Send/>{pending ? zh.runner.submitting : zh.runner.submitExam}</Button>
      </aside>
      <section className="question-surface" aria-labelledby={`question-${question.id}`}>
        <header><span>{zh.common.question(activeIndex + 1)}</span><BadgeText>{questionTypeLabel(question.type)} · {zh.common.points(question.points)}</BadgeText></header>
        <div ref={sourceRef} className="question-source" id={`question-${question.id}`}><HighlightedText text={question.sourceText} words={currentWords}/></div>
        <div className="highlight-actions"><Button type="button" size="sm" variant="outline" onClick={() => void markSelection()}><Highlighter/>{zh.runner.markUnknown}</Button>{currentWords.map((word) => <button type="button" key={word.id} onClick={async () => { await deleteUnknownWordAction({ id: word.id, attemptId }); setWords((current) => removeTextAnchor(current, word.id)); }}><BookmarkMinus/>{zh.runner.removeUnknown(word.exactText)}</button>)}</div>
        <div className="answer-area">
          {(question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE") ? question.options.map((option) => <label className="answer-option" key={option.id}><input type={question.type === "SINGLE_CHOICE" ? "radio" : "checkbox"} name={`question-${question.id}`} checked={currentAnswer.selectedOptionIds.includes(option.id)} onChange={(event) => { const selected = question.type === "SINGLE_CHOICE" ? [option.id] : event.target.checked ? [...currentAnswer.selectedOptionIds, option.id] : currentAnswer.selectedOptionIds.filter((id) => id !== option.id); queueSave(question.id, { ...currentAnswer, selectedOptionIds: selected }); }}/><span>{option.content}</span></label>) : null}
          {question.type === "TRUE_FALSE" ? <div className="true-false"><Button type="button" variant={currentAnswer.booleanAnswer === true ? "default" : "outline"} onClick={() => queueSave(question.id, { ...currentAnswer, booleanAnswer: true })}>{zh.common.correct}</Button><Button type="button" variant={currentAnswer.booleanAnswer === false ? "default" : "outline"} onClick={() => queueSave(question.id, { ...currentAnswer, booleanAnswer: false })}>{zh.common.incorrect}</Button></div> : null}
          {["FILL_BLANK", "SHORT_ANSWER", "ESSAY"].includes(question.type) ? <textarea aria-label={zh.runner.yourAnswer} rows={question.type === "ESSAY" ? 10 : 4} value={currentAnswer.textAnswer} onChange={(event) => queueSave(question.id, { ...currentAnswer, textAnswer: event.target.value })} placeholder={zh.runner.answerPlaceholder}/> : null}
        </div>
        <footer><span role="status">{saveState}</span><div><Button type="button" variant="ghost" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => index - 1)}>{zh.runner.previous}</Button><Button type="button" disabled={activeIndex === questions.length - 1} onClick={() => setActiveIndex((index) => index + 1)}>{zh.runner.next}</Button></div></footer>
      </section>
    </div>
  );
}

function BadgeText({ children }: { children: React.ReactNode }) {
  return <small>{children}</small>;
}
