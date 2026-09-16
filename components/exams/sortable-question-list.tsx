"use client";

import { useState, useTransition } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Save, Trash2 } from "lucide-react";
import { deleteQuestionAction, duplicateQuestionAction, reorderQuestionsAction, updateQuestionAction } from "@/app/actions/exams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { questionTypeLabel, zh } from "@/lib/i18n/zh";

export type QuestionEditorItem = {
  id: string;
  type: string;
  gradingMode: string;
  promptMd: string;
  passageMd: string;
  points: string;
  optionsText: string;
  correctOptionKeys: string;
  trueFalseAnswer: string;
  acceptableAnswers: string;
  numericAnswer: string;
  numericTolerance: string;
  referenceAnswerMd: string;
  rubricMd: string;
  gradingNotesMd: string;
  caseSensitive: boolean;
  trimWhitespace: boolean;
  normalizePunctuation: boolean;
};

function SortableQuestion({ question, number }: { question: QuestionEditorItem; number: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`question-editor ${isDragging ? "dragging" : ""}`}>
      <div className="question-editor-head">
        <button type="button" className="drag-handle" aria-label={zh.questionEditor.dragQuestion(number)} {...attributes} {...listeners}><GripVertical /></button>
        <div><strong>{zh.common.question(number)}</strong><span>{questionTypeLabel(question.type)} · {zh.common.points(question.points)}</span></div>
        <div className="row-actions">
          <form action={duplicateQuestionAction}><input type="hidden" name="questionId" value={question.id}/><Button type="submit" size="sm" variant="outline"><Copy/>{zh.questionEditor.copy}</Button></form>
          <form action={deleteQuestionAction}><input type="hidden" name="questionId" value={question.id}/><Button type="submit" size="sm" variant="ghost"><Trash2/>{zh.questionEditor.delete}</Button></form>
        </div>
      </div>
      <details>
        <summary>{zh.questionEditor.edit}</summary>
        <form action={updateQuestionAction} className="question-form">
          <input type="hidden" name="questionId" value={question.id}/>
          <div className="form-span-2"><Label htmlFor={`passage-${question.id}`}>{zh.questionEditor.passage}</Label><Textarea id={`passage-${question.id}`} name="passageMd" defaultValue={question.passageMd} placeholder={zh.questionEditor.passagePlaceholder} /></div>
          <div className="form-span-2"><Label htmlFor={`prompt-${question.id}`}>{zh.questionEditor.prompt}</Label><Textarea id={`prompt-${question.id}`} name="promptMd" defaultValue={question.promptMd} required /></div>
          <div><Label htmlFor={`type-${question.id}`}>{zh.questionEditor.type}</Label><select id={`type-${question.id}`} name="type" defaultValue={question.type}>{["SINGLE_CHOICE","MULTIPLE_CHOICE","TRUE_FALSE","FILL_BLANK","SHORT_ANSWER","ESSAY"].map((type) => <option value={type} key={type}>{questionTypeLabel(type)}</option>)}</select></div>
          <div><Label htmlFor={`mode-${question.id}`}>{zh.questionEditor.gradingMode}</Label><select id={`mode-${question.id}`} name="gradingMode" defaultValue={question.gradingMode}><option value="AUTO">{zh.questionEditor.automatic}</option><option value="MANUAL">{zh.questionEditor.manual}</option></select></div>
          <div><Label htmlFor={`points-${question.id}`}>{zh.questionEditor.points}</Label><Input id={`points-${question.id}`} name="points" type="number" min="0.01" step="0.01" defaultValue={question.points} required /></div>
          <div className="form-span-2"><Label htmlFor={`options-${question.id}`}>{zh.questionEditor.options}</Label><Textarea id={`options-${question.id}`} name="optionsText" defaultValue={question.optionsText} /></div>
          <div><Label htmlFor={`keys-${question.id}`}>{zh.questionEditor.correctOptions}</Label><Input id={`keys-${question.id}`} name="correctOptionKeys" defaultValue={question.correctOptionKeys} placeholder={zh.questionEditor.correctOptionsPlaceholder} /></div>
          <div><Label htmlFor={`bool-${question.id}`}>{zh.questionEditor.trueFalseAnswer}</Label><select id={`bool-${question.id}`} name="trueFalseAnswer" defaultValue={question.trueFalseAnswer}><option value="">{zh.common.notProvided}</option><option value="true">{zh.common.correct}</option><option value="false">{zh.common.incorrect}</option></select></div>
          <div className="form-span-2"><Label htmlFor={`accepted-${question.id}`}>{zh.questionEditor.acceptableAnswers}</Label><Textarea id={`accepted-${question.id}`} name="acceptableAnswers" defaultValue={question.acceptableAnswers} /></div>
          <div><Label htmlFor={`numeric-${question.id}`}>{zh.questionEditor.numericAnswer}</Label><Input id={`numeric-${question.id}`} name="numericAnswer" type="number" step="any" defaultValue={question.numericAnswer} /></div>
          <div><Label htmlFor={`tolerance-${question.id}`}>{zh.questionEditor.numericTolerance}</Label><Input id={`tolerance-${question.id}`} name="numericTolerance" type="number" min="0" step="any" defaultValue={question.numericTolerance} /></div>
          <div className="form-span-2"><Label htmlFor={`reference-${question.id}`}>{zh.questionEditor.referenceAnswer}</Label><Textarea id={`reference-${question.id}`} name="referenceAnswerMd" defaultValue={question.referenceAnswerMd} /></div>
          <div className="form-span-2"><Label htmlFor={`rubric-${question.id}`}>{zh.questionEditor.rubric}</Label><Textarea id={`rubric-${question.id}`} name="rubricMd" defaultValue={question.rubricMd} /></div>
          <div className="form-span-2"><Label htmlFor={`notes-${question.id}`}>{zh.questionEditor.gradingNotes}</Label><Textarea id={`notes-${question.id}`} name="gradingNotesMd" defaultValue={question.gradingNotesMd} /></div>
          <label className="check-row"><input type="checkbox" name="caseSensitive" defaultChecked={question.caseSensitive}/>{zh.questionEditor.caseSensitive}</label>
          <label className="check-row"><input type="checkbox" name="trimWhitespace" defaultChecked={question.trimWhitespace}/>{zh.questionEditor.trimWhitespace}</label>
          <label className="check-row"><input type="checkbox" name="normalizePunctuation" defaultChecked={question.normalizePunctuation}/>{zh.questionEditor.normalizePunctuation}</label>
          <div className="form-span-2"><Button type="submit"><Save/>{zh.questionEditor.save}</Button></div>
        </form>
      </details>
    </article>
  );
}

export function SortableQuestionList({ versionId, initialQuestions }: { versionId: string; initialQuestions: QuestionEditorItem[] }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function onDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = questions.findIndex((item) => item.id === event.active.id);
    const newIndex = questions.findIndex((item) => item.id === event.over?.id);
    const next = arrayMove(questions, oldIndex, newIndex);
    setQuestions(next);
    startTransition(async () => {
      try { await reorderQuestionsAction({ versionId, orderedQuestionIds: next.map((item) => item.id) }); }
      catch { setQuestions(questions); }
    });
  }

  return (
    <div aria-busy={pending}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={questions.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="question-list">{questions.map((question, index) => <SortableQuestion key={question.id} question={question} number={index + 1}/>)}</div>
        </SortableContext>
      </DndContext>
      {pending ? <p className="save-indicator" role="status">{zh.questionEditor.savingOrder}</p> : null}
    </div>
  );
}
