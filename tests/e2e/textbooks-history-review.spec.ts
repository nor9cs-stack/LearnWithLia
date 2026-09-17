import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const nonEmpty = (value: string | undefined) => value?.trim() || undefined;
const teacherPassword =
  nonEmpty(process.env.E2E_TEACHER_PASSWORD) ??
  nonEmpty(process.env.SEED_TEACHER_PASSWORD);
const studentPassword =
  nonEmpty(process.env.E2E_STUDENT_PASSWORD) ??
  nonEmpty(process.env.SEED_STUDENT_PASSWORD);
const configured = Boolean(teacherPassword && studentPassword);

async function loginTeacher(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "老师登录" }).click();
  await page.getByLabel("邮箱").fill("lia@learnwithlia.local");
  await page.getByLabel("密码").fill(teacherPassword!);
  await page.getByRole("button", { name: "登录并继续" }).click();
  await expect(page).toHaveURL(/\/teacher\/exams/);
}

async function loginStudent(
  page: Page,
  studentNumber: "STUDENT001" | "STUDENT002",
) {
  await page.goto("/");
  await page.getByLabel("学号").fill(studentNumber);
  await page.getByLabel("密码").fill(studentPassword!);
  await page.getByRole("button", { name: "登录并继续" }).click();
  await expect(page).toHaveURL(/\/student\/exams/);
}

test.describe("textbooks, grading filter, and attempt history", () => {
  test.skip(!configured, "需要 Preview seed 角色凭据");

  test("teacher assigns a private PDF only to the selected student", async ({
    browser,
  }, testInfo) => {
    const title = `FEATURE-SMOKE-TEXTBOOK-${testInfo.project.name}-${Date.now()}`;
    const teacherContext = await browser.newContext();
    const teacher = await teacherContext.newPage();
    await loginTeacher(teacher);
    await teacher.goto("/teacher/textbooks");
    await teacher.getByLabel("课本标题").fill(title);
    await teacher
      .getByLabel("PDF 文件")
      .setInputFiles(
        path.join(process.cwd(), "tests/fixtures/minimal-text.pdf"),
      );
    await teacher
      .getByLabel(/示例学生一 · STUDENT001/)
      .first()
      .check();
    await teacher.getByRole("button", { name: "上传课本" }).click();
    await expect(teacher.getByRole("status")).toContainText("课本上传成功");

    const card = teacher
      .locator('[data-slot="card"]')
      .filter({ hasText: title });
    await expect(card).toBeVisible();
    const downloadPath = await card
      .getByRole("link", { name: "在线打开" })
      .getAttribute("href");
    expect(downloadPath).toMatch(/^\/api\/textbooks\/.+\/download$/);

    const assignedContext = await browser.newContext();
    const assigned = await assignedContext.newPage();
    await loginStudent(assigned, "STUDENT001");
    await assigned.goto("/student/textbooks");
    await expect(assigned.getByText(title)).toBeVisible();
    const assignedDownload = await assigned.request.get(
      new URL(downloadPath!, assigned.url()).href,
    );
    expect(assignedDownload.status()).toBe(200);
    expect(assignedDownload.headers()["content-type"]).toContain(
      "application/pdf",
    );

    const unassignedContext = await browser.newContext();
    const unassigned = await unassignedContext.newPage();
    await loginStudent(unassigned, "STUDENT002");
    await unassigned.goto("/student/textbooks");
    await expect(unassigned.getByText(title)).toHaveCount(0);
    const blockedDownload = await unassigned.request.get(
      new URL(downloadPath!, unassigned.url()).href,
    );
    expect(blockedDownload.status()).toBe(404);

    await teacher.goto("/teacher/textbooks");
    await teacher
      .locator('[data-slot="card"]')
      .filter({ hasText: title })
      .getByRole("button", { name: "删除课本" })
      .click();
    await expect(teacher.getByText(title)).toHaveCount(0);
    await assignedContext.close();
    await unassignedContext.close();
    await teacherContext.close();
  });

  test("grading filter hides completed responses without deleting them", async ({
    page,
  }) => {
    await loginTeacher(page);
    await page.goto("/teacher/review");
    const completed = page.locator('[data-completed="true"]');
    await expect(completed.first()).toBeVisible();
    const completedCount = await completed.count();
    expect(completedCount).toBeGreaterThan(0);
    await page.getByRole("button", { name: "隐藏已完成评分" }).click();
    await expect(page.locator('[data-completed="true"]:visible')).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "显示已完成评分" }).click();
    await expect(page.locator('[data-completed="true"]:visible')).toHaveCount(
      completedCount,
    );
  });

  test("student sees every seeded attempt in order and cannot read another student's record", async ({
    browser,
  }) => {
    const firstContext = await browser.newContext();
    const firstStudent = await firstContext.newPage();
    await loginStudent(firstStudent, "STUDENT001");
    const orderedExamples: { text: string; href: string }[] = [];
    for (let pageNumber = 1; pageNumber <= 10; pageNumber += 1) {
      const exampleHistory = firstStudent
        .locator(".history-record")
        .filter({ hasText: "综合英语能力（示例）" });
      for (let index = 0; index < (await exampleHistory.count()); index += 1) {
        const record = exampleHistory.nth(index);
        orderedExamples.push({
          text: await record.innerText(),
          href: (await record.getAttribute("href"))!,
        });
      }
      if (orderedExamples.some((item) => item.text.includes("第 1 次作答")) && orderedExamples.some((item) => item.text.includes("第 2 次作答"))) break;
      const nextPage = firstStudent.getByRole("link", { name: "下一页" });
      if ((await nextPage.count()) === 0) break;
      await nextPage.click();
      await expect(firstStudent).toHaveURL(new RegExp(`historyPage=${pageNumber + 1}`));
    }
    const firstAttempt = orderedExamples.find((item) => item.text.includes("第 1 次作答"));
    const secondAttempt = orderedExamples.find((item) => item.text.includes("第 2 次作答"));
    expect(firstAttempt?.text).toContain("已评分");
    expect(secondAttempt).toBeDefined();
    expect(orderedExamples.indexOf(secondAttempt!)).toBeLessThan(orderedExamples.indexOf(firstAttempt!));

    const firstHref = firstAttempt?.href;
    const secondHref = secondAttempt?.href;
    expect(firstHref).not.toBe(secondHref);
    await firstStudent.goto(secondHref!);
    await expect(
      firstStudent.getByText(
        "I review each mistake and make a small plan to improve.",
      ),
    ).toBeVisible();
    await firstStudent.goto(firstHref!);
    await expect(
      firstStudent.getByText("Mistakes help me notice what to practice next."),
    ).toBeVisible();

    const secondContext = await browser.newContext();
    const secondStudent = await secondContext.newPage();
    await loginStudent(secondStudent, "STUDENT002");
    const forbidden = await secondStudent.request.get(
      new URL(firstHref!, secondStudent.url()).href,
    );
    expect(forbidden.status()).toBe(404);
    await secondContext.close();
    await firstContext.close();
  });
});
