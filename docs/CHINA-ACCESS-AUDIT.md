# LearnWithLia 中国大陆访问依赖审计

审计日期：2026-09-16

## 结论摘要

- 当前学生浏览器不会被应用代码要求连接任何第三方域名；自动发出的页面、静态资源、RSC、Server Action 和 API 请求均为 LearnWithLia 当前 origin 的同源请求。
- 浏览器不会直接访问 Supabase Storage 签名 URL。签名 URL 只在服务端 Inngest 文件导入任务内生成并下载，没有序列化到页面、React props 或 API 响应。
- 未发现 Google Fonts、Google APIs、外部 CDN、浏览器分析脚本、远程头像、Gravatar 或第三方验证码。
- Supabase、Upstash 和 Inngest 当前均只通过服务端调用；其中 `lib/inngest/client.ts` 缺少 `server-only` 哨兵，但现有 import graph 没有把它带入客户端。
- 仓库没有 `vercel.json`、`preferredRegion` 或其他函数区域声明。若 Vercel Dashboard 也没有覆盖设置，Node.js Functions 使用平台默认区域 `iad1`；仅凭仓库无法证明线上 Dashboard 的实际设置。
- 对中国大陆学生而言，主要风险不是浏览器直连第三方，而是：访问 LearnWithLia/Vercel origin 的跨境质量，以及 Vercel Functions 到 Supabase、Upstash、Inngest 的服务器链路延迟和可用性。

## 审计范围与限制

本报告基于当前 Git 工作区中的应用源码、依赖、CSP、路由和部署配置进行静态只读审计。审计过程中没有读取或记录环境变量值、数据库地址、服务密钥或签名 URL。

未执行生产环境 HAR 抓包，也没有访问 Vercel Dashboard。因此：

- 可以确认代码会要求浏览器访问哪些类别的地址；
- 可以确认仓库内是否声明了 Vercel Functions 区域；
- 不能从仓库确认生产域名、Vercel Dashboard 覆盖设置、运营商链路质量或浏览器扩展自身产生的网络请求。

## 1. 学生浏览器实际会请求的外部域名

### 自动请求的第三方域名

**无。当前集合为空。**

学生浏览器的应用请求均指向当前页面 origin：

- 页面与 RSC：`/`、`/dashboard`、`/student/exams`、`/student/attempts/:id` 等；
- Next.js 静态资源：`/_next/static/*`；
- 登录、开始考试、自动保存、标记生词和交卷：Next.js Server Action 的同源 POST；
- 网站资源：`/favicon.svg`，以及由社交抓取器使用的 `/og.png`；
- 教师文件上传：`/api/exams/:versionId/upload`，仍为同源请求。

支持该结论的边界控制：

- `next.config.ts` 设置 `connect-src 'self'`；
- 图片限制为 `img-src 'self' data: blob:`；
- 字体限制为 `font-src 'self' data:`；
- 脚本限制为 `script-src 'self' ...`；
- 客户端唯一显式 `fetch()` 是教师上传到同源 `/api/exams/.../upload`；
- 学生自动保存和交卷使用导入的 Server Action，而不是第三方 SDK 或绝对 URL。

### 潜在但当前不会自动发生的外部导航

`lib/markdown.tsx` 的通用 Markdown 组件允许 `http:`、`https:` 和 `mailto:` 链接，但当前没有页面调用这个组件，学生考试 DTO 还会把 Markdown 链接和图片转换为纯文本。即使未来启用该组件，当前 CSP 也会阻止外部图片自动加载；用户主动点击外部链接仍可能离开 LearnWithLia，应在启用该组件前重新审计。

`components/auth/login-panel.tsx` 注册的 `document.modelContext` 工具不包含应用发起的网络请求；任何宿主浏览器自身流量不属于 LearnWithLia 的请求链路。

## 2. Supabase Storage 签名 URL

应用会创建 Supabase Storage 签名 URL，但**学生或教师浏览器都不会直接访问它**。

当前链路为：

1. 教师浏览器把文件上传到同源 `/api/exams/:versionId/upload`；
2. Vercel Function 在 `app/api/exams/[versionId]/upload/route.ts` 内把文件上传到私有 Supabase bucket；
3. 服务端向 Inngest 发送 `exam/import.requested` 事件；
4. `lib/inngest/functions.ts` 在服务端调用 `createExamFileSignedUrl()`；
5. 同一个服务端任务使用 `fetch(signedUrl)` 下载文件并解析；
6. 签名 URL 只保存在函数局部变量中，TTL 为 60 秒。

安全边界：

- `lib/storage/supabase.ts` 使用 `server-only`；
- bucket 在使用前会检查必须为私有；
- 上传 API 只返回文件记录 ID 和导入状态，不返回 storage path 或签名 URL；
- 当前产品没有面向浏览器的原始考试文件下载入口。

## 3. 字体、Google、CDN、分析、头像与验证码

| 类别 | 当前状态 | 证据 |
| --- | --- | --- |
| Google Fonts | 未加载 | `app/layout.tsx` 未使用 `next/font/google`；CSS 仅声明系统字体栈 |
| Google APIs | 未发现 | 源码、依赖和客户端请求中无 Google API 调用 |
| 外部 CDN | 未发现 | CSS、图片、脚本和字体没有外部资源 URL |
| 浏览器分析脚本 | 未发现 | 无 Vercel Analytics、Google Analytics、Segment、PostHog、Sentry、Clarity 等客户端集成 |
| Upstash Analytics | 仅服务器端 | `@upstash/ratelimit` 的 `analytics: true` 在 Vercel Function 内执行，不加载浏览器脚本 |
| 头像/Gravatar | 未发现 | 用户界面只显示名称与角色，没有远程头像 URL |
| 第三方验证码 | 未发现 | 无 reCAPTCHA、hCaptcha 或 Cloudflare Turnstile |
| 图标/UI 依赖 | 本地打包 | Lucide 和 Radix 作为 npm 依赖进入本地 JS bundle，不从 CDN 运行时加载 |

## 4. Supabase、Upstash 和 Inngest 的调用边界

### Supabase

- PostgreSQL 通过服务端 Prisma adapter 使用；`lib/db.ts` 带有 `server-only`。
- Storage 管理客户端位于 `lib/storage/supabase.ts`，带有 `server-only`，使用服务端凭据。
- 未发现面向浏览器公开的 Supabase 配置、客户端 Supabase SDK 实例或浏览器直连 Data API/Storage。
- Supabase Storage 签名 URL只被服务端 Inngest 函数消费。

结论：**只在服务器端调用。**

### Upstash

- `lib/rate-limit/index.ts` 带有 `server-only`；
- 调用点仅位于 Auth.js、Server Actions 和上传 Route Handler；
- 浏览器只调用 LearnWithLia 的同源页面/API/Server Action，不接收 Upstash 地址或 token。

结论：**只在服务器端调用。**

### Inngest

- 上传 Route Handler 在服务端调用 `inngest.send()`；
- `/api/inngest` 是 Inngest 调用 LearnWithLia 的入站服务端 endpoint；
- 文件解析和定时交卷函数在服务端执行；
- 没有客户端 Inngest SDK 或浏览器直连。

结论：**当前 import graph 只在服务器端调用。** 建议给 `lib/inngest/client.ts` 增加 `import "server-only"`，把这一事实变为编译期边界。

## 5. Vercel Functions 区域配置

当前仓库状态：

- 没有 `vercel.json`；
- 没有 route-level `preferredRegion`；
- 没有 `regions` 或 `functionFailoverRegions`；
- 上传 Route Handler 只声明了 `runtime = "nodejs"` 和 `maxDuration = 60`。

因此仓库层面的区域配置为**未指定**。Vercel 官方文档说明 Node.js Functions 默认运行在 `iad1`，但 Dashboard 设置可以覆盖默认值，所以线上实际区域仍需在 Vercel Dashboard 的 Functions Settings 中确认：

- [Vercel Functions](https://vercel.com/docs/functions)
- [Vercel regions](https://vercel.com/docs/regions)
- [vercel.json regions 配置](https://vercel.com/docs/project-configuration/vercel-json#regions)

函数区域应优先靠近 Supabase 数据库/Storage，而不是只按学生位置选择。把函数放到中国大陆邻近区域、但让每次数据库查询跨洲，可能使考试页面、保存和交卷更慢。

## 6. 对考试关键路径的影响

| 场景 | 浏览器请求 | 服务器依赖 | 故障影响 |
| --- | --- | --- | --- |
| 登录 | 同源 Server Action | Vercel Function、Supabase PostgreSQL、Upstash | 数据库不可达会登录失败；生产环境 Upstash 未配置或不可达时登录限流会 fail closed |
| 考试列表加载 | 同源 GET/RSC | Vercel Function、Supabase PostgreSQL | 任一链路高延迟会延长首屏；数据库不可达会导致页面失败 |
| 作答页加载 | 同源 GET/RSC | Vercel Function、Supabase PostgreSQL | 题目、剩余时间和已有答案都依赖数据库查询；无浏览器第三方请求 |
| 自动保存 | 同源 Server Action，输入后约 650ms 触发 | Vercel Function、Supabase PostgreSQL、Upstash | 数据库是硬依赖；Upstash 调用失败时 autosave 当前 fail open，不会单独阻断保存 |
| 手动交卷 | 同源 Server Action | Vercel Function、Upstash、Supabase PostgreSQL | Upstash 对 submit 为 fail closed；Upstash 或数据库不可达都可能阻断交卷 |
| 到时自动交卷（在线） | 同源 Server Action | Vercel Function、Supabase PostgreSQL、Upstash | 学生页面倒计时归零后主动提交，风险与手动交卷相同 |
| 到时自动交卷（后台） | 无浏览器请求 | Inngest 调用 `/api/inngest`、Vercel Function、Supabase PostgreSQL | Inngest 不可达会延迟离线学生的后台到时提交；再次进入流程仍有服务端过期检查 |
| 教师上传文件 | 同源 `/api/exams/:versionId/upload` | Upstash、Supabase Storage、PostgreSQL、Inngest | 上传 API 等待事件发送；Inngest 故障可能让响应失败或导入长期停留在队列状态 |
| 服务端解析文件 | 无浏览器请求 | Inngest、Supabase Storage 签名 URL、PostgreSQL | 不影响已发布考试作答，但影响新试卷导入与审核 |
| 原始文件下载 | 当前不存在 | 无 | 当前浏览器没有下载请求，也不会接触签名 URL |
| JS/CSS/图标/站点图片 | 同源静态资源 | LearnWithLia/Vercel CDN | 中国大陆到站点 origin 的可达性和缓存命中直接影响页面启动 |

需要特别关注的失败策略：

- `autosave` 在 Upstash 不可用时允许继续，优先保护答案保存；
- 登录、交卷、上传、账号敏感操作和批改在生产环境中对 Upstash fail closed；
- 上传 API 在 Storage 和数据库写入后才调用 Inngest，若事件发送失败，可能出现文件已保存但前端收到失败的部分完成状态。

## 7. 将浏览器请求收敛到自有域名的最小方案

当前浏览器请求已经收敛到 LearnWithLia origin，不需要为了学生考试流程重写 Supabase、Upstash 或 Inngest 集成。最小方案应以防回退和补齐未来下载能力为主：

1. **保留现有 CSP。** 继续维持 `connect-src 'self'`、自有图片/字体/脚本限制，不增加通配第三方域名。
2. **增加浏览器域名回归测试。** 在 Playwright 的登录、考试加载、自动保存和交卷流程中监听 request，除当前 origin、`data:` 和 `blob:` 外发现任何目标即失败。
3. **未来文件下载必须走同源代理。** 新增类似 `/api/files/:id/download` 的 Route Handler，在服务端校验角色和对象归属，读取私有 Storage 并流式转发；不要把签名 URL返回或 3xx 重定向给浏览器。
4. **强化服务端编译边界。** 给 `lib/inngest/client.ts` 增加 `server-only`；继续禁止把任何服务端凭据暴露为浏览器公开配置。
5. **继续本地打包资源。** 字体、图标、帮助图片和验证码不要改为 Google Fonts 或公共 CDN；如以后引入分析，优先使用无客户端脚本的服务端事件或自有域名代理。
6. **显式固定函数区域。** 先确认 Supabase 数据区域并从中国大陆实测候选区域，再在 Vercel Dashboard 或 `vercel.json` 中设置一个与数据源接近、对目标学生链路较好的 region。不要在不知道数据库区域时直接固定到某个亚洲 region。
7. **基础设施层单独验证中国大陆可达性。** 自有域名只能消除第三方 hostname 暴露，不能自动解决 Vercel 跨境线路、DNS 或合规问题。正式面向中国大陆前，应从目标省份和运营商测试 DNS、TLS、首字节、静态资源和 Server Action，并按实际需求评估中国大陆合规托管/CDN 与备案。

## 最终判断

从浏览器依赖边界看，LearnWithLia 当前设计适合“中国大陆客户端只访问一个自有 origin”的目标：学生不会直接连接 Supabase、Upstash、Inngest、Google 或公共 CDN。

上线前最值得优先处理的不是前端域名代理，而是：确认 Vercel Functions 实际区域、将函数放到接近 Supabase 的位置、对中国大陆真实网络做端到端测量，并为关键 Server Action 增加外部域名与延迟回归监控。
