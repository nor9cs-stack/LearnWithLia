# LearnWithLia 产品需求与实施计划

## 产品目标

LearnWithLia 是面向辅导机构的在线考试平台。OWNER 管理教师账号，TEACHER 管理其学生、考试、分配、批改和生词记录，STUDENT 在严格授权与限时规则下完成考试并查看自己的历史结果。

页脚品牌为 **Libraread Tutoring Program**。默认界面语言为中文，文案集中管理，为后续中英文切换保留结构。

## 核心用户旅程

1. OWNER 安全创建、停用或重置教师账号。
2. TEACHER 创建学生，上传考试文件或手动建卷，审核草稿并补全答案。
3. TEACHER 启用不可变考试版本，将其分配给学生，设置开放/截止时间、尝试次数与每次作答限时。
4. STUDENT 登录，开始或继续作答；答案自动保存，服务端控制剩余时间。
5. STUDENT 提交后立即看到自动评分正确率；写作与人工简答进入待批改状态。
6. TEACHER 批改并给出反馈后，STUDENT 查看最终成绩、历史趋势与错题。
7. STUDENT 在考试中标记不懂的英文词语；刷新可恢复，TEACHER 可按学生、考试与作答查看。

## 已确认的产品决策

- 后台文件解析：Inngest。
- 分布式限流：Upstash Redis。
- 内容编辑：受控 Markdown；服务端清洗后渲染，不接受任意 HTML。
- 每场考试支持 `timeLimitMinutes`；计时从 Attempt 的服务端开始时间算起，暂停或关闭浏览器不会暂停计时。到期后只接受服务端自动提交，不接受晚到答案。
- Auth.js 的加密 JWT 保存在 HttpOnly Cookie 中；每个受保护服务端入口都读取数据库里的账号状态与 `sessionVersion`，实现账号停用、密码重置和改密后的集中失效。
- 学生和教师账号均由上级角色创建，不提供公开注册。

## 功能范围

### 账号与权限

- OWNER、TEACHER、STUDENT 三角色。
- 教师以邮箱登录；学生以学号登录；失败提示统一。
- Argon2id 密码哈希，HttpOnly/Secure/SameSite 会话 Cookie。
- 首次登录改密、账号停用、会话撤销、操作审计。
- 教师和学生所有查询均通过所有权条件过滤。

### 考试与导入

- DRAFT、ENABLED、DISABLED、ARCHIVED 生命周期。
- PDF、DOCX、DOC 最大 15 MB，扩展名、声明 MIME 与 magic bytes 三重验证。
- 原文件进入 Supabase private bucket；Inngest 异步解析并回写状态。
- PDF 文本提取、DOCX 段落提取、DOC 尽力提取；扫描 PDF 明确标记 OCR_REQUIRED。
- 解析结果只生成 DRAFT，需教师对照原文审核。
- 题目支持排序、添加、编辑、复制、删除。
- 已启用版本不可变；编辑时克隆为新 ExamVersion。

### 题型与评分

- SINGLE_CHOICE、MULTIPLE_CHOICE、TRUE_FALSE、FILL_BLANK、SHORT_ANSWER、ESSAY。
- 多选默认完全匹配；文本支持大小写、空白与标点归一化；数字支持误差。
- ESSAY 必须人工批改；SHORT_ANSWER 可配置自动或人工。
- 发布前给出逐题、逐字段缺失信息。

### 作答与生词

- 独立 Attempt，不覆盖历史；自动保存采用版本号避免旧请求覆盖新答案。
- 服务端校验分配、状态、开始/截止、次数和作答限时。
- 选区锚点保存 exact text、prefix、suffix 与 occurrence；限定单题内选择和最大长度。
- 提交前任何学生 DTO 都排除参考答案与评分配置。

## 非功能要求

- 手机与桌面响应式；键盘可操作；显式标签、焦点和错误状态；尊重减少动态效果偏好。
- 紫白色、现代克制；登录页漂浮英文单词不遮挡表单。
- 关键变更写 AuditLog，敏感字段不进入日志。
- 生产部署目标：Vercel + Supabase PostgreSQL/Storage + Inngest + Upstash。

## 分阶段实施与验收

### 阶段 0：设计与工程基线

- 完成本文件、架构、数据库、安全、部署和测试文档。
- 初始化 Next.js App Router、严格 TypeScript、Tailwind、shadcn/ui、Prisma 与测试工具。
- 验收：lint、typecheck、基础单测、production build。

### 阶段 1：认证、RBAC 与账号管理

- Auth.js Credentials、HttpOnly JWT 会话、数据库状态复核、Argon2id、统一登录错误、改密与撤销会话。
- OWNER 教师管理；TEACHER 学生管理；审计与 Upstash 限流。
- 验收：角色/所有权集成测试及登录 E2E。

### 阶段 2：考试建卷、版本与异步导入

- 考试编辑器、明确的答案结构、完整性验证、不可变发布与克隆版本。
- 私有上传、magic bytes、Inngest 解析状态和 PDF/DOCX/DOC 提取。
- 验收：发布验证、版本不可变、上传安全及解析测试。

### 阶段 3：分配、限时作答、自动保存与评分

- 分配窗口、次数限制、每次作答限时、独立 Attempt、响应保存和提交事务。
- 自动评分与待人工批改统计。
- 验收：字符串、多答案、多选、数字误差、总分、并发保存、超时和越权测试。

### 阶段 4：人工批改、生词与分析

- 教师评分、反馈、最终分数；错题与多次趋势。
- 稳定文本锚点的保存、恢复和删除。
- 验收：生词定位测试、教师所有权测试、关键 E2E。

### 阶段 5：发布准备与最终审查

- seed、create-admin、headers、可访问性、完整测试、部署说明与代码审查。
- 验收：全部质量门禁通过，列出真实限制和后续建议。

## 明确不在第一版范围

- AI 写作评分。
- 扫描件 OCR；仅检测并提示需要 OCR。
- 公开注册、社交登录、家长账号、在线支付。
- 实时监考、视频录制或反作弊浏览器锁定。
