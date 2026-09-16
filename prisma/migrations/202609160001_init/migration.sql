-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'ENABLED', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'ESSAY');

-- CreateEnum
CREATE TYPE "GradingMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'PENDING_REVIEW', 'GRADED');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PDF', 'DOCX', 'DOC');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'QUEUED', 'PROCESSING', 'READY_FOR_REVIEW', 'OCR_REQUIRED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "emailNormalized" TEXT,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "studentNumberNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherStudent" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamVersion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "instructionsMd" TEXT,
    "totalPoints" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passage" (
    "id" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "title" TEXT,
    "contentMd" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "passageId" TEXT,
    "type" "QuestionType" NOT NULL,
    "gradingMode" "GradingMode" NOT NULL,
    "promptMd" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "points" DECIMAL(8,2) NOT NULL,
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "trimWhitespace" BOOLEAN NOT NULL DEFAULT true,
    "normalizePunctuation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionKey" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionKey" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "trueFalseAnswer" BOOLEAN,
    "numericAnswer" DECIMAL(18,6),
    "numericTolerance" DECIMAL(18,6),
    "referenceAnswerMd" TEXT,
    "rubricMd" TEXT,
    "gradingNotesMd" TEXT,

    CONSTRAINT "QuestionKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionCorrectOption" (
    "questionKeyId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "QuestionCorrectOption_pkey" PRIMARY KEY ("questionKeyId","optionId")
);

-- CreateTable
CREATE TABLE "AcceptableAnswer" (
    "id" TEXT NOT NULL,
    "questionKeyId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,

    CONSTRAINT "AcceptableAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "availableFrom" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "maxAttempts" INTEGER,
    "timeLimitMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "autoCorrectCount" INTEGER,
    "autoQuestionCount" INTEGER,
    "autoScore" DECIMAL(10,2),
    "pendingManualCount" INTEGER,
    "finalScore" DECIMAL(10,2),
    "teacherFeedbackMd" TEXT,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "textAnswer" TEXT,
    "booleanAnswer" BOOLEAN,
    "numericAnswer" DECIMAL(18,6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "autoCorrect" BOOLEAN,
    "autoScore" DECIMAL(8,2),
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseSelectedOption" (
    "responseId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "ResponseSelectedOption_pkey" PRIMARY KEY ("responseId","optionId")
);

-- CreateTable
CREATE TABLE "UnknownWord" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "exactText" VARCHAR(160) NOT NULL,
    "prefix" VARCHAR(160) NOT NULL,
    "suffix" VARCHAR(160) NOT NULL,
    "occurrence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnknownWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualGrade" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "graderId" TEXT NOT NULL,
    "score" DECIMAL(8,2) NOT NULL,
    "feedbackMd" TEXT,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "declaredMime" TEXT NOT NULL,
    "detectedMime" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "importStatus" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "extractedText" TEXT,
    "importErrorCode" TEXT,
    "importMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_archivedAt_idx" ON "User"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_studentNumberNormalized_key" ON "StudentProfile"("studentNumberNormalized");

-- CreateIndex
CREATE INDEX "StudentProfile_studentNumber_idx" ON "StudentProfile"("studentNumber");

-- CreateIndex
CREATE INDEX "TeacherStudent_studentId_idx" ON "TeacherStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherStudent_teacherId_studentId_key" ON "TeacherStudent"("teacherId", "studentId");

-- CreateIndex
CREATE INDEX "Exam_ownerId_status_idx" ON "Exam"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Exam_archivedAt_idx" ON "Exam"("archivedAt");

-- CreateIndex
CREATE INDEX "ExamVersion_examId_status_idx" ON "ExamVersion"("examId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExamVersion_examId_versionNumber_key" ON "ExamVersion"("examId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Passage_examVersionId_order_key" ON "Passage"("examVersionId", "order");

-- CreateIndex
CREATE INDEX "Question_passageId_idx" ON "Question"("passageId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_examVersionId_order_key" ON "Question"("examVersionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_optionKey_key" ON "QuestionOption"("questionId", "optionKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_order_key" ON "QuestionOption"("questionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionKey_questionId_key" ON "QuestionKey"("questionId");

-- CreateIndex
CREATE INDEX "QuestionCorrectOption_optionId_idx" ON "QuestionCorrectOption"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "AcceptableAnswer_questionKeyId_normalizedValue_key" ON "AcceptableAnswer"("questionKeyId", "normalizedValue");

-- CreateIndex
CREATE INDEX "Assignment_studentProfileId_dueAt_idx" ON "Assignment"("studentProfileId", "dueAt");

-- CreateIndex
CREATE INDEX "Assignment_assignedById_idx" ON "Assignment"("assignedById");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_examVersionId_studentProfileId_key" ON "Assignment"("examVersionId", "studentProfileId");

-- CreateIndex
CREATE INDEX "Attempt_studentId_submittedAt_idx" ON "Attempt"("studentId", "submittedAt");

-- CreateIndex
CREATE INDEX "Attempt_status_submittedAt_idx" ON "Attempt"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Attempt_examVersionId_idx" ON "Attempt"("examVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_assignmentId_attemptNumber_key" ON "Attempt"("assignmentId", "attemptNumber");

-- CreateIndex
CREATE INDEX "Response_questionId_idx" ON "Response"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_attemptId_questionId_key" ON "Response"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "ResponseSelectedOption_optionId_idx" ON "ResponseSelectedOption"("optionId");

-- CreateIndex
CREATE INDEX "UnknownWord_questionId_idx" ON "UnknownWord"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "UnknownWord_attemptId_questionId_exactText_prefix_suffix_oc_key" ON "UnknownWord"("attemptId", "questionId", "exactText", "prefix", "suffix", "occurrence");

-- CreateIndex
CREATE UNIQUE INDEX "ManualGrade_responseId_key" ON "ManualGrade"("responseId");

-- CreateIndex
CREATE INDEX "ManualGrade_graderId_gradedAt_idx" ON "ManualGrade"("graderId", "gradedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UploadedFile_storagePath_key" ON "UploadedFile"("storagePath");

-- CreateIndex
CREATE INDEX "UploadedFile_examVersionId_importStatus_idx" ON "UploadedFile"("examVersionId", "importStatus");

-- CreateIndex
CREATE INDEX "UploadedFile_uploadedById_createdAt_idx" ON "UploadedFile"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherStudent" ADD CONSTRAINT "TeacherStudent_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherStudent" ADD CONSTRAINT "TeacherStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamVersion" ADD CONSTRAINT "ExamVersion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passage" ADD CONSTRAINT "Passage_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "ExamVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "ExamVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionKey" ADD CONSTRAINT "QuestionKey_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionCorrectOption" ADD CONSTRAINT "QuestionCorrectOption_questionKeyId_fkey" FOREIGN KEY ("questionKeyId") REFERENCES "QuestionKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionCorrectOption" ADD CONSTRAINT "QuestionCorrectOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "QuestionOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptableAnswer" ADD CONSTRAINT "AcceptableAnswer_questionKeyId_fkey" FOREIGN KEY ("questionKeyId") REFERENCES "QuestionKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "ExamVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "ExamVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseSelectedOption" ADD CONSTRAINT "ResponseSelectedOption_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseSelectedOption" ADD CONSTRAINT "ResponseSelectedOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "QuestionOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnknownWord" ADD CONSTRAINT "UnknownWord_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnknownWord" ADD CONSTRAINT "UnknownWord_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualGrade" ADD CONSTRAINT "ManualGrade_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualGrade" ADD CONSTRAINT "ManualGrade_graderId_fkey" FOREIGN KEY ("graderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "ExamVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Published exam content is immutable at the database boundary. Status-only
-- transitions on ExamVersion remain possible so an enabled version can be
-- disabled or archived without rewriting its historical content.
CREATE OR REPLACE FUNCTION prevent_published_version_content_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' AND (
    NEW."examId" IS DISTINCT FROM OLD."examId" OR
    NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" OR
    NEW."title" IS DISTINCT FROM OLD."title" OR
    NEW."instructionsMd" IS DISTINCT FROM OLD."instructionsMd" OR
    NEW."totalPoints" IS DISTINCT FROM OLD."totalPoints" OR
    NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt"
  ) THEN
    RAISE EXCEPTION 'Published exam versions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ExamVersion_immutable_content"
BEFORE UPDATE ON "ExamVersion"
FOR EACH ROW EXECUTE FUNCTION prevent_published_version_content_update();

CREATE OR REPLACE FUNCTION require_draft_exam_version()
RETURNS TRIGGER AS $$
DECLARE
  parent_version_id TEXT;
  parent_status "ExamStatus";
  row_data JSONB;
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  IF TG_TABLE_NAME = 'Passage' OR TG_TABLE_NAME = 'Question' THEN
    parent_version_id := row_data->>'examVersionId';
  ELSIF TG_TABLE_NAME = 'QuestionOption' THEN
    SELECT "examVersionId" INTO parent_version_id FROM "Question" WHERE "id" = row_data->>'questionId';
  ELSIF TG_TABLE_NAME = 'QuestionKey' THEN
    SELECT "examVersionId" INTO parent_version_id FROM "Question" WHERE "id" = row_data->>'questionId';
  ELSIF TG_TABLE_NAME = 'AcceptableAnswer' THEN
    SELECT q."examVersionId" INTO parent_version_id
    FROM "QuestionKey" k JOIN "Question" q ON q."id" = k."questionId"
    WHERE k."id" = row_data->>'questionKeyId';
  ELSIF TG_TABLE_NAME = 'QuestionCorrectOption' THEN
    SELECT q."examVersionId" INTO parent_version_id
    FROM "QuestionKey" k JOIN "Question" q ON q."id" = k."questionId"
    WHERE k."id" = row_data->>'questionKeyId';
  END IF;

  SELECT "status" INTO parent_status FROM "ExamVersion" WHERE "id" = parent_version_id;
  IF parent_status IS DISTINCT FROM 'DRAFT'::"ExamStatus" THEN
    RAISE EXCEPTION 'Published exam version content is immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Passage_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "Passage" FOR EACH ROW EXECUTE FUNCTION require_draft_exam_version();
CREATE TRIGGER "Question_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "Question" FOR EACH ROW EXECUTE FUNCTION require_draft_exam_version();
CREATE TRIGGER "QuestionOption_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "QuestionOption" FOR EACH ROW EXECUTE FUNCTION require_draft_exam_version();
CREATE TRIGGER "QuestionKey_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "QuestionKey" FOR EACH ROW EXECUTE FUNCTION require_draft_exam_version();
CREATE TRIGGER "AcceptableAnswer_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "AcceptableAnswer" FOR EACH ROW EXECUTE FUNCTION require_draft_exam_version();
CREATE TRIGGER "QuestionCorrectOption_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "QuestionCorrectOption" FOR EACH ROW EXECUTE FUNCTION require_draft_exam_version();
