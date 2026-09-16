import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role, UserStatus } from "@/app/generated/prisma/enums";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUser: vi.fn(),
  findTeacherStudent: vi.fn(),
  findExam: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.findUser },
    teacherStudent: { findUnique: mocks.findTeacherStudent },
    exam: { findFirst: mocks.findExam },
  },
}));

const activeStudent = {
  id: "student-1",
  name: "学生",
  email: null,
  role: Role.STUDENT,
  status: UserStatus.ACTIVE,
  archivedAt: null,
  mustChangePassword: false,
  sessionVersion: 3,
  studentProfile: { id: "profile-1", studentNumber: "S001" },
};

describe("authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: { id: activeStudent.id, role: Role.STUDENT, sessionVersion: 3 },
    });
    mocks.findUser.mockResolvedValue(activeStudent);
  });

  it("rejects a student at a teacher-only server boundary", async () => {
    const { requireUser } = await import("@/lib/auth/dal");
    await expect(requireUser({ roles: [Role.TEACHER] })).rejects.toMatchObject({
      name: "AuthorizationError",
      status: 403,
    });
  });

  it("revokes a previously issued session after sessionVersion changes", async () => {
    mocks.findUser.mockResolvedValue({ ...activeStudent, sessionVersion: 4 });
    const { requireUser } = await import("@/lib/auth/dal");
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("hides unrelated students and exams behind not-found responses", async () => {
    mocks.findTeacherStudent.mockResolvedValue(null);
    mocks.findExam.mockResolvedValue(null);
    const { assertTeacherOwnsExam, assertTeacherOwnsStudent } = await import("@/lib/auth/dal");
    await expect(assertTeacherOwnsStudent("teacher-1", "student-2")).rejects.toMatchObject({ status: 404 });
    await expect(assertTeacherOwnsExam("teacher-1", "exam-2")).rejects.toMatchObject({ status: 404 });
  });
});
