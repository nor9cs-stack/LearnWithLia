# 部署说明：Vercel + Supabase

本文件描述上线所需的外部资源，但仓库本身不会自动创建任何云资源。Preview 与 Production 必须使用彼此隔离的数据库、Storage bucket、Upstash 数据库和 Inngest environment。

## 需要手动创建的资源

### Supabase

1. 分别创建 Preview 与 Production 项目。
2. 记录应用运行使用的 PostgreSQL session pooler URL，以及执行 migration 使用的 direct URL。
3. 在每个项目中创建名为 `exam-source-files`（或与 `SUPABASE_STORAGE_BUCKET` 一致）的 private Storage bucket。
4. bucket 单文件上限设为 15 MB；允许 PDF、DOCX、DOC 对应的 MIME 类型：`application/pdf`、`application/vnd.openxmlformats-officedocument.wordprocessingml.document`、`application/msword`。
5. 获取项目 URL 与 server-only service role key。service role key 只能进入 Vercel server environment，不得使用 `NEXT_PUBLIC_` 前缀。

### Upstash

1. 分别为 Preview 与 Production 创建 Redis 数据库，并选择接近对应 Vercel deployment 的区域。
2. 记录 REST URL 与 REST token。Production 缺少这两个变量时，除自动保存外的受限操作会按 fail-closed 策略拒绝。

### Inngest

1. 创建应用及彼此隔离的 Preview、Production environment。
2. 分别取得 event key 与 signing key。
3. 部署后注册的实际 endpoint 为 `https://<deployment-domain>/api/inngest`；代码路由是 `/api/inngest`，支持 `GET`、`POST`、`PUT`。
4. 在每个 environment 中同步 endpoint，确认 `process-exam-import` 与 `submit-expired-attempts` 两个函数可见，并发送一次测试导入事件。

### Vercel

1. 导入 GitHub 仓库，Framework 使用 Next.js，Node.js 使用 24，包管理器由 `packageManager` 固定为 pnpm 12.4.2。
2. Build Command 使用 `pnpm build`；Install Command 可保持自动检测，或明确设为 `pnpm install --frozen-lockfile`。
3. 为 Preview 与 Production 分别配置下表变量；不要复用数据库、bucket、Redis 或 Inngest environment。
4. 部署后检查 `/api/health` 返回数据库可达，再同步对应的 Inngest endpoint。

## 环境变量清单

下表与实际 `process.env`、Prisma 配置、Playwright 配置以及 `.env.example` 一致。Dev 表示 Development，Prev 表示 Preview，Prod 表示 Production。

| 变量 | 用途 | 是否必须 | 环境 |
| --- | --- | --- | --- |
| `DATABASE_URL` | Prisma 应用运行连接；Supabase 上使用 session pooler URL | 必须 | Dev / Prev / Prod |
| `DIRECT_URL` | Prisma migration、seed、create-admin 使用的直接数据库连接；未设置时代码回退到 `DATABASE_URL` | Dev 使用直连 `DATABASE_URL` 时可选；Prev / Prod migration 必须 | Dev / Prev / Prod |
| `AUTH_SECRET` | Auth.js JWT 签名及限流标识 HMAC；至少 32 个随机字节 | Dev 有仅限本地的回退；Prev / Prod 必须 | Dev / Prev / Prod |
| `APP_URL` | canonical origin、metadata base 与跨源请求校验 | 必须 | Dev / Prev / Prod |
| `SUPABASE_URL` | Supabase 项目 URL | 本地不测试上传时可选；Prev / Prod 必须 | Dev / Prev / Prod |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only private Storage 管理与签名 URL | 本地不测试上传时可选；Prev / Prod 必须 | Dev / Prev / Prod |
| `SUPABASE_STORAGE_BUCKET` | 私有考试源文件 bucket 名；代码默认 `exam-source-files` | 可使用默认值，但 Prev / Prod 建议显式配置 | Dev / Prev / Prod |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint | Dev 可选；Prev / Prod 必须 | Dev / Prev / Prod |
| `UPSTASH_REDIS_REST_TOKEN` | server-only Upstash REST token | Dev 可选；Prev / Prod 必须 | Dev / Prev / Prod |
| `INNGEST_EVENT_KEY` | 应用向 Inngest 发送事件 | 本地 Inngest dev server 可选；Prev / Prod 必须 | Dev / Prev / Prod |
| `INNGEST_SIGNING_KEY` | Inngest SDK 校验 endpoint 请求签名 | 本地 Inngest dev server 可选；Prev / Prod 必须 | Dev / Prev / Prod |
| `SEED_OWNER_PASSWORD` | seed OWNER 密码 | 仅运行 seed 时必须 | Dev / 隔离 Prev 测试；禁止 Prod |
| `SEED_TEACHER_PASSWORD` | seed 老师密码 | 仅运行 seed 时必须 | Dev / 隔离 Prev 测试；禁止 Prod |
| `SEED_STUDENT_PASSWORD` | seed 学生密码 | 仅运行 seed 时必须 | Dev / 隔离 Prev 测试；禁止 Prod |
| `PLAYWRIGHT_BASE_URL` | Playwright 目标 URL；默认 `http://127.0.0.1:3000` | 可选 | Dev / Prev 测试 |
| `E2E_OWNER_PASSWORD` | seeded OWNER E2E 登录；缺省回退到 `SEED_OWNER_PASSWORD` | 运行三角色 E2E 时必须 | Dev / 隔离 Prev 测试；禁止 Prod |
| `E2E_TEACHER_PASSWORD` | seeded 老师 E2E 登录；缺省回退到 `SEED_TEACHER_PASSWORD` | 运行三角色 E2E 时必须 | Dev / 隔离 Prev 测试；禁止 Prod |
| `E2E_STUDENT_PASSWORD` | seeded 学生 E2E 登录；缺省回退到 `SEED_STUDENT_PASSWORD` | 运行三角色 E2E 时必须 | Dev / 隔离 Prev 测试；禁止 Prod |

`NODE_ENV` 由 Next.js/Vercel 管理，`CI` 由 CI 平台管理；二者会影响安全回退、Playwright 重试与报告器，不应写入 `.env.example`。代码已显式设置 Auth.js `trustHost: true`，因此不需要 `AUTH_TRUST_HOST`。

所有 secret、数据库 URL 和 service role key 只能配置在本地未跟踪的 `.env*` 或 Vercel server environment 中。任何此类变量都不得使用 `NEXT_PUBLIC_` 前缀。

## 数据库与管理员命令

以下命令与 `package.json` 完全一致：

```bash
# Preview / Production：只执行已提交的 migration
pnpm prisma:migrate

# Development 或隔离 Preview 测试：写入虚构 seed 数据，禁止对 Production 运行
pnpm prisma:seed

# 在目标数据库交互式创建或更新首个 OWNER；密码输入不会出现在命令参数中
pnpm create-admin
```

`pnpm prisma:migrate` 内部执行 `prisma migrate deploy`。Production 禁止使用 `prisma db push`，也禁止运行 seed。

## 首次发布顺序

1. 在隔离 Preview 数据库执行 `pnpm prisma:migrate`，并运行自动测试与三角色 E2E。
2. 确认 Supabase bucket 为 private、15 MB 限制及 MIME allowlist 正确。
3. 在 Production 数据库完成备份，再执行 `pnpm prisma:migrate`。
4. 部署 Vercel 应用并确认 `/api/health` 正常。
5. 在 Inngest 控制台同步 `https://<production-domain>/api/inngest`。
6. 设置目标数据库连接后运行 `pnpm create-admin`。
7. 登录后验证上传、异步导入、分配、限时提交和人工评分。

## 回滚

- 应用：使用 Vercel 回滚到上一个健康 deployment。
- 数据库：Prisma migration 只前进；通过新的修复 migration 回滚结构，必要时从 Supabase 备份恢复。
- 后台任务：Inngest 函数保持幂等，可从控制台安全重试失败步骤。
- 密钥泄露：立即轮换相关密钥，撤销 Session，重新部署，并检查 `AuditLog`。
