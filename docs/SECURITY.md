# 安全模型

## 主要威胁与控制

| 威胁 | 控制 |
| --- | --- |
| 账号枚举 | 学号/邮箱登录失败使用同一提示与近似耗时；登录按 IP + 标识符哈希限流 |
| 凭证泄露 | Argon2id；密码永不记录；密钥只在服务端环境变量中 |
| 会话窃取 | Auth.js 加密 JWT Cookie；HttpOnly、Secure、SameSite=Lax；每次受保护访问复核数据库 `sessionVersion`，改密/停用后集中撤销 |
| CSRF | Auth.js CSRF 机制；Server Actions 同源检查；敏感 Route Handler 校验 Origin |
| 越权访问 | 每个入口重查 session、role、ownership；查询层带所有权条件；最小 DTO |
| 答案泄露 | QuestionKey 分表；student DTO 白名单；评分模块 server-only；提交前响应泄露测试 |
| 上传攻击 | 15 MB、扩展名/MIME/magic bytes、随机路径、private bucket、解析隔离、短期 signed URL |
| XSS | 禁用 raw HTML 的受控 Markdown；安全 React 渲染；CSP 与安全 headers |
| 暴力与滥用 | Upstash sliding-window，登录/上传/评分/账号操作使用独立配额 |
| 重放/并发 | 幂等提交、Response version 乐观锁、数据库事务和唯一约束 |
| 未成年人隐私 | 只收集学号、显示名和考试数据；不收集地址、生日、电话等无关信息 |

## 服务端授权矩阵

- OWNER：教师账号生命周期与全局审计；默认不读取学生作答正文。
- TEACHER：仅访问通过 TeacherStudent 或自己拥有 Exam 关联到的对象。
- STUDENT：仅访问自己的 Assignment、Attempt、Response、UnknownWord 和允许公开的结果。
- 参考答案：仅 TEACHER/OWNER 的受保护编辑与评分入口可读取；STUDENT 永不直接读取 QuestionKey。

## 限流基线

- 登录：同一 IP 10 次/10 分钟；同一登录标识 5 次/10 分钟。
- 上传：同一教师 10 次/小时。
- 账号创建/重置/停用：同一操作者 20 次/小时。
- 自动保存：同一 Attempt 120 次/分钟，另有服务端幂等与版本控制。
- 提交：同一学生与 Attempt 30 次/分钟；人工评分：同一教师 60 次/分钟。

Upstash 不可用时，登录和账号管理默认失败关闭；低风险自动保存可短时失败开放并记录告警。

## 文件安全

- bucket 名由服务端配置且必须为 private；生产启动检查 bucket 属性。
- object key 不含学生姓名、学号或原始文件名。
- service role key 不使用 `NEXT_PUBLIC_` 前缀，不进入客户端模块。
- signed URL 默认 60 秒；授权后按需签发。
- 解析器不执行宏、嵌入对象、脚本或外部链接。

## 安全响应头

- Content-Security-Policy 限制默认源、表单源、frame、object、图片、字体与连接；因 Next.js 内联启动脚本暂保留 `script-src 'unsafe-inline'`，后续可升级为逐请求 nonce。
- Strict-Transport-Security、X-Content-Type-Options、Referrer-Policy。
- Permissions-Policy 禁止不需要的摄像头、麦克风和定位。
- `frame-ancestors 'none'` 防止点击劫持。

## 安全验证

- 学生调用教师接口返回 403。
- 学生 A 读取学生 B 的 assignment/attempt/response 返回 404，避免泄露存在性。
- 未提交 Attempt 的任何 HTML/API 不含正确答案、acceptableAnswers、rubric 或 referenceAnswer。
- 被停用用户和被重置密码的旧 session 立即失效。
- 截止或超时后无法继续写答案；重复提交返回同一结果。
