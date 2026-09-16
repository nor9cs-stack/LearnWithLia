import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

const nonEmpty = (value: string | undefined) => value?.trim() || undefined;
const appUrl = nonEmpty(process.env.APP_URL);
const baseUrl =
  nonEmpty(process.env.PLAYWRIGHT_BASE_URL) ?? appUrl ?? "http://127.0.0.1:3000";
const baseOrigin = new URL(baseUrl).origin;

if (appUrl && new URL(appUrl).origin !== baseOrigin) {
  throw new Error("APP_URL 与 PLAYWRIGHT_BASE_URL 必须使用完全相同的 origin");
}

const serverUrl = new URL(baseOrigin);
if (!["localhost", "127.0.0.1"].includes(serverUrl.hostname)) {
  throw new Error("本地 E2E webServer 仅允许 localhost 或 127.0.0.1");
}
const serverPort = serverUrl.port || (serverUrl.protocol === "https:" ? "443" : "80");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Role journeys share fixed seeded accounts and mutate the same student's attempts.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: baseOrigin,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm dev --hostname ${serverUrl.hostname} --port ${serverPort}`,
    url: baseOrigin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
