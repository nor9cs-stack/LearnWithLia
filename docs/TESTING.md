# 测试策略

## 单元测试（Vitest）

- 文本规范化：大小写、首尾空格、Unicode、可选标点处理。
- 多个可接受答案、单选/判断、多选完全匹配、数字误差边界。
- 自动题正确率、人工题等待数、最终总分。
- 发布完整性规则和逐字段错误信息。
- 文本选区的创建、上下文定位、歧义处理、恢复和删除。
- 文件 magic bytes 与大小限制。

## 集成测试（Vitest + PGlite/PostgreSQL 语义）

- 当前自动化覆盖 Auth.js 会话版本与账号停用/重置后的撤销边界。
- OWNER/TEACHER/STUDENT 角色和对象所有权矩阵。
- 发布版本不可变，克隆后历史 Attempt 保持旧版本。
- Assignment 的开放/截止、最大次数与每次作答限时。
- 自动保存乐观锁、幂等提交和人工评分事务。
- production migration 可从空库完整执行，发布后内容 trigger 阻止修改并允许状态转换。
- 提交前 student DTO 不含 QuestionKey 字段或答案值。

连接专用 Supabase/PostgreSQL 的环境级套件还需验证 private file metadata、完整导入状态流转和事务并发；PGlite 测试不替代部署前的真实 Supabase 冒烟测试。

## 端到端测试（Playwright）

仓库内可独立运行的 Playwright 套件在桌面与手机 Chromium 上覆盖：双入口登录交互、匿名访问隔离、axe 核心规则和减少动画偏好。

仓库还包含基于 seed 的三角色与学生答案泄露 E2E；只有在专用数据库已迁移/seed，并提供 `E2E_OWNER_PASSWORD`、`E2E_TEACHER_PASSWORD`、`E2E_STUDENT_PASSWORD` 时运行，否则明确跳过。不得把这些变量指向生产账号。

部署预览环境的完整角色旅程应另外覆盖：

1. OWNER 登录、创建/停用/重置教师。
2. TEACHER 登录、创建学生与考试、补全答案、启用和分配。
3. STUDENT 首次改密、开始考试、自动保存、刷新恢复、生词标记、提交。
4. TEACHER 查看生词并批改写作；STUDENT 查看最终成绩。
5. 重复 Attempt 与上一次错题。
6. 越权 URL/API 被拒绝，且响应中不泄露答案。

## 可访问性与响应式

- Playwright 对登录、考试和批改页运行 axe 核心规则。
- 键盘完成登录、题目导航、作答、确认提交和关闭对话框。
- 视口覆盖 390×844 与 1440×900。
- `prefers-reduced-motion` 下漂浮单词保持静态。

## CI 质量门禁

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

集成/E2E 使用独立测试数据库并从零运行 migrations；测试完成后清理测试创建的对象，不清理共享或生产资源。
