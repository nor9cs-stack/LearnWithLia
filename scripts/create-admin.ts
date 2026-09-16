import "dotenv/config";

import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../app/generated/prisma/client";
import { Role, UserStatus } from "../app/generated/prisma/enums";
import { createDatabaseAdapter } from "../lib/database-adapter";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("请先设置 DIRECT_URL 或 DATABASE_URL");

const db = new PrismaClient({ adapter: createDatabaseAdapter(connectionString) });
const input = createInterface({ input: stdin, output: stdout });

async function hiddenQuestion(prompt: string) {
  stdout.write(prompt);
  const canHide = stdin.isTTY && process.platform !== "win32";
  if (canHide) execFileSync("stty", ["-echo"]);
  try {
    return (await input.question("")).trim();
  } finally {
    if (canHide) execFileSync("stty", ["echo"]);
    stdout.write("\n");
  }
}

try {
  const name = (await input.question("OWNER 姓名：")).trim();
  const email = (await input.question("OWNER 邮箱：")).trim().toLowerCase();
  const password = await hiddenQuestion("OWNER 密码（至少 12 位）：");
  const confirmation = await hiddenQuestion("再次输入密码：");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("姓名或邮箱格式不正确");
  if (password.length < 12) throw new Error("密码至少需要 12 位");
  if (password !== confirmation) throw new Error("两次密码不一致");

  const passwordHash = await hash(password, {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
  const owner = await db.user.upsert({
    where: { emailNormalized: email },
    create: {
      role: Role.OWNER,
      status: UserStatus.ACTIVE,
      name,
      email,
      emailNormalized: email,
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
    update: {
      role: Role.OWNER,
      status: UserStatus.ACTIVE,
      name,
      email,
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      sessionVersion: { increment: 1 },
      archivedAt: null,
    },
  });
  stdout.write(`OWNER 已就绪：${owner.email}\n`);
} finally {
  input.close();
  await db.$disconnect();
}
