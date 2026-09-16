import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("login supports both identities without accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "LearnWithLia" })).toBeVisible();
  await expect(page.getByText("Libraread Tutoring Program")).toBeVisible();
  await expect(page.getByLabel("学号")).toBeVisible();

  await page.getByRole("tab", { name: "老师登录" }).click();
  await expect(page.getByLabel("邮箱")).toBeVisible();
  await expect(page.getByLabel("密码")).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("protected pages redirect anonymous visitors", async ({ page }) => {
  await page.goto("/teacher/students");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "LearnWithLia" })).toBeVisible();
});

test("reduced-motion users receive static decorative words", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const word = page.locator(".floating-words span").first();
  await expect(word).toBeVisible();
  await expect(word).toHaveCSS("animation-name", "none");
});
