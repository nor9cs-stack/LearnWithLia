# 系统架构

## 运行拓扑

```text
Browser
  -> Vercel / Next.js App Router
       -> Auth.js encrypted JWT cookie + database sessionVersion check
       -> Prisma ORM -> Supabase PostgreSQL
       -> Supabase Storage (private bucket)
       -> Upstash Redis (rate limits)
       -> Inngest event API
Inngest
  -> /api/inngest
       -> private file download
       -> PDF/DOCX/DOC extraction
       -> PostgreSQL import status + draft questions
```

所有业务授权和评分均发生在 Next.js 服务端。Supabase Auth 不参与应用登录，避免两套身份源；Supabase 只提供 PostgreSQL 与 private Storage。

## 技术选择

- Next.js 16 Active LTS、App Router、React Server Components。
- TypeScript strict、Tailwind CSS 4、shadcn/ui。
- Prisma ORM 7 与 PostgreSQL driver adapter；迁移文件纳入版本控制。
- Auth.js Credentials Provider 使用加密 JWT Cookie（Credentials 不支持 database session）；每个受保护入口通过 DAL 复核 User 状态和 `sessionVersion`。
- Argon2id 密码哈希。
- Zod 作为所有服务端输入、结构化答案和环境变量的边界校验。
- Inngest 承担持久化后台导入，避免 Vercel 请求超时。
- Upstash sliding-window rate limits，用于登录、上传和敏感写操作。
- Vitest + PGlite 覆盖纯逻辑、权限边界与 migration；Playwright 默认覆盖公开界面，并在配置专用 seed 数据库后运行三角色关键旅程。

## 请求与权限边界

每个受保护入口遵循同一顺序：

1. 解析并验证输入。
2. 读取 Auth.js session；确认账号仍处于 ACTIVE 且不要求改密。
3. 检查角色。
4. 在数据库查询中同时加入 owner/teacher/student 约束。
5. 检查资源状态与业务前置条件。
6. 在事务中变更数据并写 AuditLog。
7. 返回最小 DTO。

受保护的 App Router layout 负责页面导航保护；DAL、Server Action 和 Route Handler 的重复检查才是授权依据。

## 答案保密设计

- Question 的题干/选项和 QuestionKey 的答案/评分配置分表保存。
- 学生查询只选择公开字段，不使用包含关系读取 QuestionKey。
- 自动评分函数仅在 `server-only` 模块中，由提交事务调用。
- 提交后的错题 DTO 只在 Attempt 为 SUBMITTED/PENDING_REVIEW/GRADED 后生成。
- 单元测试验证 student DTO 白名单不含答案字段；环境级 E2E 还应搜索 student HTML/API，确认提交前不存在答案值、rubric 或 referenceAnswer。

## 不可变考试版本

- Exam 是稳定业务标识；ExamVersion 是可发布快照。
- DRAFT 可编辑；ENABLED 后数据库触发器与服务层共同阻止题目和答案更新。
- 修改已发布考试会克隆其 Passage、Question、Option 和 QuestionKey 为新的 DRAFT。
- Assignment 与 Attempt 都直接绑定 ExamVersion，历史评分不会漂移。

## 作答计时

- Assignment 可设置 `timeLimitMinutes`，为空表示不限时。
- Attempt 创建时服务端写 `startedAt` 与 `expiresAt = min(startedAt + limit, assignment.dueAt)`。
- 客户端倒计时只负责显示；保存、恢复、提交时均以数据库时间和 `expiresAt` 为准。
- Inngest 定时函数可补偿自动提交超时 Attempt；任何到期后的学生保存请求都会先触发幂等提交。

## 文件导入

1. 服务端校验尺寸、扩展名、声明 MIME 和 magic bytes。
2. 使用不可猜测路径上传 private bucket，写 UploadedFile。
3. 发送 `exam/import.requested`，立即返回导入状态。
4. Inngest 通过短期 signed URL 下载并重新校验。
5. 提取原始文本；扫描 PDF 标记 OCR_REQUIRED；失败保留原文件和错误码。
6. 规则解析器识别题号、选项、判断与填空线，只创建 DRAFT 内容，不推断或填写正确答案。

## Markdown 安全

- 数据库存储原始受控 Markdown。
- 服务端解析为受限语法树，丢弃原始 HTML、脚本、iframe、危险链接协议和事件属性。
- 页面渲染安全 React 节点，不使用未经清洗的 `dangerouslySetInnerHTML`。

## 可观察性

- 结构化日志仅记录 requestId、actorId、action、resourceId 与错误码。
- 不记录密码、Cookie、session token、数据库 URL、Supabase service role key、完整答案或上传文件内容。
- AuditLog 记录账号、发布、分配、评分、归档和重置等关键动作。
