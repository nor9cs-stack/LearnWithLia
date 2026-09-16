import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const database = new PGlite();

describe("PostgreSQL migration invariants", () => {
  beforeAll(async () => {
    const migration = await readFile(
      new URL("../../prisma/migrations/202609160001_init/migration.sql", import.meta.url),
      "utf8",
    );
    await database.exec(migration);
    await database.exec(`
      INSERT INTO "User" ("id", "role", "name", "email", "emailNormalized", "passwordHash", "updatedAt")
      VALUES ('teacher-1', 'TEACHER', 'Teacher', 'teacher@example.test', 'teacher@example.test', 'hash', now());
      INSERT INTO "Exam" ("id", "ownerId", "title", "updatedAt")
      VALUES ('exam-1', 'teacher-1', 'Draft exam', now());
      INSERT INTO "ExamVersion" ("id", "examId", "versionNumber", "title", "updatedAt")
      VALUES ('version-1', 'exam-1', 1, 'Draft exam', now());
      INSERT INTO "Question" ("id", "examVersionId", "type", "gradingMode", "promptMd", "order", "points", "updatedAt")
      VALUES ('question-1', 'version-1', 'TRUE_FALSE', 'AUTO', 'Original prompt', 0, 1, now());
      UPDATE "ExamVersion"
      SET "status" = 'ENABLED', "totalPoints" = 1, "publishedAt" = now(), "updatedAt" = now()
      WHERE "id" = 'version-1';
    `);
  });

  afterAll(async () => {
    await database.close();
  });

  it("applies the production migration successfully", async () => {
    const result = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    expect(result.rows[0]?.count).toBeGreaterThanOrEqual(15);
  });

  it("rejects edits and inserts against a published version", async () => {
    await expect(
      database.exec(`UPDATE "Question" SET "promptMd" = 'Changed' WHERE "id" = 'question-1'`),
    ).rejects.toThrow(/immutable/i);
    await expect(
      database.exec(`
        INSERT INTO "Question" ("id", "examVersionId", "type", "gradingMode", "promptMd", "order", "points", "updatedAt")
        VALUES ('question-2', 'version-1', 'TRUE_FALSE', 'AUTO', 'Late question', 1, 1, now())
      `),
    ).rejects.toThrow(/immutable/i);
  });

  it("allows status-only lifecycle transitions on a published version", async () => {
    await expect(
      database.exec(`UPDATE "ExamVersion" SET "status" = 'DISABLED', "updatedAt" = now() WHERE "id" = 'version-1'`),
    ).resolves.toBeDefined();
  });
});
