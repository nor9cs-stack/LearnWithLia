import { expect, test } from "@playwright/test";

const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? process.env.SEED_OWNER_PASSWORD;
const teacherPassword = process.env.E2E_TEACHER_PASSWORD ?? process.env.SEED_TEACHER_PASSWORD;
const studentPassword = process.env.E2E_STUDENT_PASSWORD ?? process.env.SEED_STUDENT_PASSWORD;
const configured = Boolean(ownerPassword && teacherPassword && studentPassword);

test.describe("seeded three-role journey", () => {
  test.skip(!configured, "需要已迁移并执行 seed 的专用 E2E 数据库和 E2E_*_PASSWORD");

  test("OWNER and TEACHER reach only their own management areas", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    await owner.goto("/");
    await owner.getByRole("tab", { name: "老师登录" }).click();
    await owner.getByLabel("邮箱").fill("owner@learnwithlia.local");
    await owner.getByLabel("密码").fill(ownerPassword!);
    await owner.getByRole("button", { name: "登录并继续" }).click();
    await expect(owner).toHaveURL(/\/owner\/teachers/);
    await ownerContext.close();

    const teacherContext = await browser.newContext();
    const teacher = await teacherContext.newPage();
    await teacher.goto("/");
    await teacher.getByRole("tab", { name: "老师登录" }).click();
    await teacher.getByLabel("邮箱").fill("lia@learnwithlia.local");
    await teacher.getByLabel("密码").fill(teacherPassword!);
    await teacher.getByRole("button", { name: "登录并继续" }).click();
    await expect(teacher).toHaveURL(/\/teacher\/students/);
    await expect(teacher.getByRole("heading", { name: "我的学生" })).toBeVisible();
    await teacherContext.close();
  });

  test("STUDENT cannot open teacher pages or receive unpublished answer keys", async ({ browser }) => {
    const context = await browser.newContext();
    const student = await context.newPage();
    await student.goto("/");
    await student.getByLabel("学号").fill("STUDENT001");
    await student.getByLabel("密码").fill(studentPassword!);
    await student.getByRole("button", { name: "登录并继续" }).click();
    await expect(student).toHaveURL(/\/student\/exams/);

    await student.goto("/teacher/students");
    await expect(student).toHaveURL(/\/student\/exams/);
    await student.getByText(/开始新一次作答|继续作答/).first().click();
    await expect(student).toHaveURL(/\/student\/attempts\//);
    const html = await student.content();
    expect(html).not.toContain("Clarity 1 point");
    expect(html).not.toContain("A clear paragraph should state a lesson");
    await context.close();
  });
});
