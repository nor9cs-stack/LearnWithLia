# 数据库设计

## 身份与关系

- `User`: 角色、邮箱、密码哈希、状态、首次改密标记、会话撤销版本。
- `StudentProfile`: 与 STUDENT 一对一，包含唯一 `studentNumber` 和最少显示信息。
- `TeacherStudent`: 教师与学生多对多责任关系，唯一 `(teacherId, studentId)`。
- 登录不建立 `Account`/`Session` 表记录。Auth.js Credentials 使用加密 JWT Cookie；`User.sessionVersion` 配合服务端数据库复核支持集中撤销。

## 考试内容

- `Exam`: 教师拥有的稳定容器，含当前状态与归档时间。
- `ExamVersion`: 版本号、草稿/发布状态、总分、发布时间和来源文件。
- `Passage`: 版本内可复用阅读材料。
- `Question`: 题干、题型、评分模式、顺序、分值和规范化开关。
- `QuestionOption`: 选项文本和稳定 key，不含 `isCorrect`。
- `QuestionKey`: 与 Question 一对一，保存正确选项、可接受文本、数字答案/误差、参考答案与 rubric。

答案采用明确列与关联行，而不是任意 JSON：

- 选择题正确项：`QuestionCorrectOption(questionKeyId, optionId)`。
- 文本可接受答案：`AcceptableAnswer(questionKeyId, value, normalizedValue)`。
- 数字答案：`QuestionKey.numericAnswer` 与 `numericTolerance`。
- 人工题：`referenceAnswerMd`、`rubricMd`、`gradingNotesMd` 至少一项。

## 分配与作答

- `Assignment`: ExamVersion 到 Student 的分配，含 `availableFrom`、`dueAt`、`maxAttempts` 和 `timeLimitMinutes`。
- `Attempt`: 绑定 Assignment 与 ExamVersion，含序号、状态、服务端开始/到期/提交时间和评分汇总。
- `Response`: 每题答案与乐观锁版本，自动评分结果只在提交后写入。
- `ResponseSelectedOption`: Response 的多选/单选答案关联。
- `ManualGrade`: 每个人工题的教师评分、反馈与时间。
- `UnknownWord`: Attempt、Question、exact/prefix/suffix/occurrence 与创建时间。

## 导入与审计

- `UploadedFile`: private object path、原始文件名、实际 MIME、哈希、尺寸、导入状态与错误码。
- `AuditLog`: actor、action、entityType、entityId、非敏感 metadata、IP 哈希与时间。

## 关键约束与索引

- `User.emailNormalized` 对教师/OWNER 全局唯一；学生邮箱为空，创建入口按角色验证。
- `StudentProfile.studentNumberNormalized` 唯一，确保学号不区分大小写仍不重复。
- `TeacherStudent(teacherId, studentId)` 唯一。
- `ExamVersion(examId, versionNumber)` 唯一。
- `Question(examVersionId, order)`、`QuestionOption(questionId, order)` 唯一。
- `Assignment(examVersionId, studentProfileId)` 唯一。
- `Attempt(assignmentId, attemptNumber)` 唯一，`examVersionId` 使用外键固定历史。
- `Response(attemptId, questionId)` 唯一。
- `UnknownWord(attemptId, questionId, exactText, prefix, suffix, occurrence)` 唯一。
- 删除 User/Exam/Version 使用 RESTRICT 或软删除；只对无历史的草稿子项使用 CASCADE。
- 高频列表索引：教师+状态、学生+截止时间、Attempt 学生+提交时间、待批改状态、导入状态。

## 事务边界

- 发布：读取自有草稿版本 -> 完整性验证 -> 计算总分 -> 事务内标记 ENABLED 并审计；数据库 trigger 随后禁止内容变更。
- 开始作答：验证 Assignment 时间/次数/状态 -> 计算 expiresAt -> 依靠唯一约束创建独立 Attempt。
- 提交：读取 Attempt -> 使用条件更新声明提交权 -> 读取服务器答案 -> 评分 -> 事务内汇总与更新；重复提交返回既有结果。
- 人工批改：upsert ManualGrade -> 汇总最终分 -> 所有人工作答完成后标记 GRADED。
- 账号重置/停用：更新用户并递增 `sessionVersion` -> 写 AuditLog；旧 JWT 在下一次服务端访问时失效。

## 迁移策略

- 开发使用 `prisma migrate dev`，生产使用 `prisma migrate deploy`。
- 已应用迁移不可修改；修正通过追加迁移。
- CI 使用 PGlite 的 PostgreSQL 语义从零执行 migration 与 trigger 测试；部署预览环境再对真实 Supabase PostgreSQL 做迁移和冒烟验证。
- 生产迁移先备份、再运行兼容性迁移；破坏性字段删除分多个版本完成。
