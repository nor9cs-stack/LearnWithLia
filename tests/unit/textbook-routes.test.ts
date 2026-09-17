import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/app/generated/prisma/enums";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  rateLimit: vi.fn(),
  relationCount: vi.fn(),
  transaction: vi.fn(),
  createTextbook: vi.fn(),
  createAudit: vi.fn(),
  findTextbook: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/dal", () => {
  class AuthorizationError extends Error {
    status: number;
    constructor(message = "unauthorized", status = 403) {
      super(message);
      this.status = status;
    }
  }
  return { AuthorizationError, requireUser: mocks.requireUser };
});
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.rateLimit }));
vi.mock("@/lib/db", () => ({
  db: {
    teacherStudent: { count: mocks.relationCount },
    textbook: { findFirst: mocks.findTextbook },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/storage/supabase", () => ({
  uploadPrivateExamFile: mocks.upload,
  downloadPrivateFile: mocks.download,
  deletePrivateFile: mocks.remove,
}));

describe("textbook route security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({
      id: "teacher-1",
      role: Role.TEACHER,
    });
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.relationCount.mockResolvedValue(1);
    mocks.upload.mockResolvedValue(undefined);
    mocks.createTextbook.mockResolvedValue({ id: "textbook-1" });
    mocks.createAudit.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        textbook: { create: mocks.createTextbook },
        auditLog: { create: mocks.createAudit },
      }),
    );
  });

  it("uploads a private PDF without importing it or returning a storage path", async () => {
    const fixture = await readFile(
      new URL("../fixtures/minimal-text.pdf", import.meta.url),
    );
    const form = new FormData();
    form.set("title", "安全课本");
    form.set("studentIds", "cm1234567890123456789012");
    form.set(
      "file",
      new File([fixture], "lesson.pdf", { type: "application/pdf" }),
    );
    const { POST } = await import("@/app/api/textbooks/route");
    const response = await POST(
      new Request("http://localhost/api/textbooks", {
        method: "POST",
        headers: { origin: "http://localhost" },
        body: form,
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "textbook-1" });
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.createTextbook).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storagePath: expect.stringMatching(
            /^textbooks\/teacher-1\/[\w-]+\.pdf$/,
          ),
        }),
      }),
    );
    const source = await readFile(
      new URL("../../app/api/textbooks/route.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/inngest|extractExamText|process-exam-import/i);
  });

  it("rejects student uploads before touching Storage", async () => {
    const { AuthorizationError } = await import("@/lib/auth/dal");
    mocks.requireUser.mockRejectedValueOnce(
      new AuthorizationError("unauthorized", 403),
    );
    const { POST } = await import("@/app/api/textbooks/route");
    const response = await POST(
      new Request("http://localhost/api/textbooks", {
        method: "POST",
        headers: { origin: "http://localhost" },
      }),
    );
    expect(response.status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("does not download an unassigned textbook", async () => {
    mocks.requireUser.mockResolvedValueOnce({
      id: "student-2",
      role: Role.STUDENT,
    });
    mocks.findTextbook.mockResolvedValueOnce(null);
    const { GET } =
      await import("@/app/api/textbooks/[textbookId]/download/route");
    const response = await GET(
      new Request(
        "http://localhost/api/textbooks/cm1234567890123456789012/download",
      ),
      { params: Promise.resolve({ textbookId: "cm1234567890123456789012" }) },
    );
    expect(response.status).toBe(404);
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("prevents another teacher from deleting a textbook or any Storage object", async () => {
    mocks.findTextbook.mockResolvedValueOnce(null);
    const { deleteTextbookAction } = await import("@/app/actions/textbooks");
    const form = new FormData();
    form.set("textbookId", "cm1234567890123456789012");
    await expect(deleteTextbookAction(form)).rejects.toMatchObject({
      status: 404,
    });
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
