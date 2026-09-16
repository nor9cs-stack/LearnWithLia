# LearnWithLia

LearnWithLia 是面向小型辅导机构的在线考试平台。OWNER 管理老师账号，老师管理学生、试卷、分配、批改和生词记录，学生可在手机或电脑上限时作答、自动保存、重复考试并查看历史成绩。

## 已实现

- OWNER / TEACHER / STUDENT 三角色、Auth.js 登录、Argon2id、首次改密、停用与会话集中撤销。
- 老师账号、学生账号和对象所有权隔离；关键操作写入 `AuditLog`。
- 六种题型、发布完整性检查、服务端判分、人工写作批改和多次成绩记录。
- 不可变 `ExamVersion`：应用层和 PostgreSQL trigger 双重保护，修改已发布试卷时克隆新版本。
- 多学生分配、开始/截止时间、默认不限次数，以及每次作答 1–480 分钟限时。
- 自动保存、乐观锁、刷新恢复、服务端到期拦截和 Inngest 定时补偿自动交卷。
- PDF / DOCX / DOC 15 MB 私有上传，扩展名、声明 MIME、magic bytes 与内容类型验证；异步生成待审核草稿。
- exact text + prefix/suffix + occurrence 生词锚点，支持恢复、取消及老师查看。
- 紫白响应式界面、键盘可操作、axe 验收和 `prefers-reduced-motion`。

## 本地运行

需要 Node.js 24、pnpm 12 和 PostgreSQL 兼容数据库。

```bash
pnpm install
cp .env.example .env
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
```

在本地 `.env` 中至少填写 `DATABASE_URL`、`DIRECT_URL`、`AUTH_SECRET` 和 `APP_URL`。文件导入还需要 Supabase Storage 与 Inngest；生产限流需要 Upstash。完整变量说明见 [.env.example](./.env.example)。

种子脚本不含默认密码。运行前通过本地环境提供：

```bash
SEED_OWNER_PASSWORD='仅用于本地的强密码' \
SEED_TEACHER_PASSWORD='仅用于本地的强密码' \
SEED_STUDENT_PASSWORD='仅用于本地的强密码' \
pnpm prisma:seed
```

种子数据包含一个 OWNER、一位老师、两名虚构学生、一份覆盖六种题型的 30 分钟示例考试，以及同一学生的两次历史作答。老师邮箱为 `lia@learnwithlia.local`，学生学号为 `STUDENT001` / `STUDENT002`；密码只取自运行时环境变量。

不使用 seed 时，可安全创建首个 OWNER：

```bash
pnpm create-admin
```

命令会交互式读取并隐藏密码输入，不会把密码写入参数、代码或 Git。

## 质量门禁

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

`pnpm test` 包括评分、发布、限时、文件、生词、学生 DTO、RBAC 以及真实 PostgreSQL 语义的 migration/不可变 trigger 测试。`pnpm test:e2e` 会启动本地应用，在桌面和手机 Chromium 上检查双入口登录、匿名访问隔离、无障碍和减少动画设置。

涉及真实登录、上传、后台任务和完整角色旅程的环境级 E2E，应连接专用测试 PostgreSQL、Supabase bucket、Upstash 与 Inngest；不要对生产资源运行 seed 或测试清理。

## 架构与部署

- [产品需求与阶段计划](./docs/PRD.md)
- [系统架构](./docs/ARCHITECTURE.md)
- [数据库设计](./docs/DATABASE.md)
- [安全模型](./docs/SECURITY.md)
- [测试策略](./docs/TESTING.md)
- [Vercel + Supabase 部署](./docs/DEPLOYMENT.md)

生产环境只运行正式 migration：`pnpm prisma:migrate`。不要对生产数据库使用 `prisma db push`。原始考试文件必须保存在 private bucket，`SUPABASE_SERVICE_ROLE_KEY`、数据库 URL 和 Auth secret 均不得使用 `NEXT_PUBLIC_` 前缀。

## 当前限制与下一步

- 扫描版 PDF 只会标记 `OCR_REQUIRED`，第一版不内置 OCR；旧版 DOC 提取也仍取决于文件质量，失败时应转为 DOCX。
- 导入题目依靠可审计的规则解析器，只识别常见题号、选项和填空线；它不会推断答案，老师必须对照原文审核。
- 本仓库环境没有生产 Supabase、Storage、Upstash 或 Inngest 凭据，因此最终自动化使用 PGlite 验证 migration，并运行无需外部服务的浏览器套件；上线前仍需在隔离预览环境跑三角色、上传与后台任务冒烟测试。
- 当前 CSP 为兼容 Next.js 启动脚本保留 `script-src 'unsafe-inline'`；后续安全加固可改成 middleware 生成的逐请求 nonce。
- 登录页注册了渐进增强的 WebMCP 工具；不支持该浏览器 API 时自动降级，本地 Chromium 套件只验证了常规界面路径。
