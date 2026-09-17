-- CreateEnum
CREATE TYPE "SubmissionReason" AS ENUM ('STUDENT', 'TIME_EXPIRED');

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN "submissionReason" "SubmissionReason";

-- CreateTable
CREATE TABLE "Textbook" (
    "id" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "declaredMime" TEXT NOT NULL,
    "detectedMime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Textbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TextbookAssignment" (
    "id" TEXT NOT NULL,
    "textbookId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TextbookAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Textbook_storagePath_key" ON "Textbook"("storagePath");
CREATE INDEX "Textbook_uploadedById_createdAt_idx" ON "Textbook"("uploadedById", "createdAt");
CREATE INDEX "Textbook_archivedAt_idx" ON "Textbook"("archivedAt");
CREATE UNIQUE INDEX "TextbookAssignment_textbookId_studentId_key" ON "TextbookAssignment"("textbookId", "studentId");
CREATE INDEX "TextbookAssignment_studentId_createdAt_idx" ON "TextbookAssignment"("studentId", "createdAt");
CREATE INDEX "TextbookAssignment_assignedById_idx" ON "TextbookAssignment"("assignedById");

-- AddForeignKey
ALTER TABLE "Textbook" ADD CONSTRAINT "Textbook_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TextbookAssignment" ADD CONSTRAINT "TextbookAssignment_textbookId_fkey" FOREIGN KEY ("textbookId") REFERENCES "Textbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TextbookAssignment" ADD CONSTRAINT "TextbookAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TextbookAssignment" ADD CONSTRAINT "TextbookAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
