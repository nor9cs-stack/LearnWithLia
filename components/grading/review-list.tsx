"use client";

import { useState } from "react";
import { gradeResponseAction } from "@/app/actions/grading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { zh } from "@/lib/i18n/zh";

export type ReviewResponseDto = {
  id: string;
  prompt: string;
  studentAnswer: string;
  reference: string;
  points: string;
  gradingMode: "AUTO" | "MANUAL";
  completed: boolean;
  autoCorrect: boolean | null;
  score: string;
  feedback: string;
};

export type ReviewAttemptDto = {
  id: string;
  isGraded: boolean;
  attemptLabel: string;
  submittedAt: string;
  studentName: string;
  examTitle: string;
  summary: string;
  attemptFeedback: string;
  responses: ReviewResponseDto[];
  unknownWords: { id: string; text: string; questionLabel: string }[];
};

function GradeForm({
  response,
  attemptFeedback,
  onSaved,
}: {
  response: ReviewResponseDto;
  attemptFeedback: string;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  async function save(formData: FormData) {
    setSaving(true);
    try {
      await gradeResponseAction(formData);
      onSaved();
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      action={save}
      className="grade-form"
      data-testid={`review-response-${response.id}`}
    >
      <input type="hidden" name="responseId" value={response.id} />
      <div className="grade-prompt">
        <strong>{response.prompt}</strong>
        <span>{zh.review.studentAnswer(response.studentAnswer)}</span>
        <span>{zh.review.reference(response.reference)}</span>
      </div>
      <div>
        <Label htmlFor={`score-${response.id}`}>
          {zh.review.scoreOutOf(response.points)}
        </Label>
        <Input
          id={`score-${response.id}`}
          name="score"
          type="number"
          min="0"
          max={response.points}
          step="0.01"
          defaultValue={response.score}
          required
        />
      </div>
      <div>
        <Label htmlFor={`feedback-${response.id}`}>
          {zh.review.responseFeedback}
        </Label>
        <Textarea
          id={`feedback-${response.id}`}
          name="feedbackMd"
          defaultValue={response.feedback}
        />
      </div>
      <div>
        <Label htmlFor={`attempt-feedback-${response.id}`}>
          {zh.review.attemptFeedback}
        </Label>
        <Textarea
          id={`attempt-feedback-${response.id}`}
          name="attemptFeedbackMd"
          defaultValue={attemptFeedback}
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? zh.common.loading : zh.review.saveGrade}
      </Button>
    </form>
  );
}

export function ReviewList({ attempts }: { attempts: ReviewAttemptDto[] }) {
  const [hideCompleted, setHideCompleted] = useState(false);
  const [savedResponses, setSavedResponses] = useState<Record<string, true>>(
    {},
  );
  const isCompleted = (response: ReviewResponseDto) =>
    response.completed || Boolean(savedResponses[response.id]);
  const remaining = attempts
    .flatMap((attempt) => attempt.responses)
    .filter((response) => !isCompleted(response)).length;

  return (
    <>
      <div className="review-toolbar">
        <Button
          type="button"
          variant="outline"
          aria-pressed={hideCompleted}
          onClick={() => setHideCompleted((value) => !value)}
        >
          {hideCompleted ? zh.review.showCompleted : zh.review.hideCompleted}
        </Button>
      </div>
      <div className="review-list">
        {attempts.map((attempt) => {
          const allComplete =
            attempt.responses.length > 0 &&
            attempt.responses.every(isCompleted);
          return (
            <Card
              key={attempt.id}
              hidden={hideCompleted && allComplete}
              data-testid={`review-attempt-${attempt.id}`}
            >
              <CardHeader>
                <div className="card-title-row">
                  <Badge variant={attempt.isGraded ? "secondary" : "default"}>
                    {attempt.isGraded ? zh.review.complete : zh.review.pending}
                  </Badge>
                  <span>
                    {attempt.attemptLabel} · {attempt.submittedAt}
                  </span>
                </div>
                <CardTitle>
                  {attempt.studentName} · {attempt.examTitle}
                </CardTitle>
                <CardDescription>{attempt.summary}</CardDescription>
              </CardHeader>
              <CardContent>
                {attempt.responses.map((response) => (
                  <div
                    key={response.id}
                    hidden={hideCompleted && isCompleted(response)}
                    data-completed={isCompleted(response)}
                  >
                    {response.gradingMode === "MANUAL" ? (
                      <GradeForm
                        response={response}
                        attemptFeedback={attempt.attemptFeedback}
                        onSaved={() =>
                          setSavedResponses((current) => ({
                            ...current,
                            [response.id]: true,
                          }))
                        }
                      />
                    ) : (
                      <div
                        className="grade-form auto-grade-row"
                        data-testid={`review-response-${response.id}`}
                      >
                        <div className="grade-prompt">
                          <strong>{response.prompt}</strong>
                          <span>
                            {zh.review.studentAnswer(response.studentAnswer)}
                          </span>
                          <span>{zh.review.reference(response.reference)}</span>
                        </div>
                        <Badge
                          variant={
                            response.autoCorrect ? "secondary" : "outline"
                          }
                        >
                          {zh.review.autoGraded}
                        </Badge>
                        <strong>
                          {zh.common.points(response.score || "0")}
                        </strong>
                      </div>
                    )}
                  </div>
                ))}
                {attempt.unknownWords.length ? (
                  <div className="word-review">
                    <h3>{zh.review.unknownWords}</h3>
                    {attempt.unknownWords.map((word) => (
                      <span key={word.id}>
                        <mark>{word.text}</mark> · {word.questionLabel}
                      </span>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {attempts.length === 0 ? (
          <div className="empty-state">{zh.review.empty}</div>
        ) : null}
        {hideCompleted && attempts.length > 0 && remaining === 0 ? (
          <div className="empty-state">{zh.review.allComplete}</div>
        ) : null}
      </div>
    </>
  );
}
