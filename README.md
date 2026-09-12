# 问得更好 · Ask Better

知乎 AI 提问编译器：把模糊需求，整理成更清楚、更容易获得高质量回答的问题。

> 核心定位：面向问题端的 Query Understanding + Intent Clarification + Question Compiler。AI 不只回答问题，也帮助人把问题问得更好。

## 当前状态

仓库已经从 Mock 原型切换为 **真实服务端 Pipeline**。配置服务端 Secret 后，Web 主流程会实际执行：

1. **Analyze**：识别意图、缺失信息和 Question Lint，并生成 2–4 个高信息增益追问。
2. **Clarify**：用户自行补充会改变答案的关键条件。
3. **Retrieve / Coverage**：通过知乎开放平台 `zhihu_search` 检索已有讨论，再基于真实 Evidence 判断 Existing Coverage 与 Knowledge Gap。
4. **Compile**：把原问题、用户明确补充的条件和检索上下文编译成结构化 Question Package。
5. **Result**：支持复制结果或打开知乎提问页，由用户最终确认和发布。

生产 UI 不再使用 Mock 数据作为成功回退。没有配置外部服务、知乎额度受限或上游暂时不可用时，界面会明确显示错误或 partial / unavailable 状态，而不是伪造“已有讨论”。

## 公网体验

Production: `https://ask.wulisu.icu`

当前 P0 部署在 Linux 自托管环境（Ubuntu 24.04），而不是 Vercel：

- Web / API：Next.js 16 由 systemd 托管，只监听 `127.0.0.1:3100`，不直接暴露公网
- 反向代理：Nginx 终止 HTTPS（certbot 证书），对外只开放 80/443
- LLM：DeepSeek `deepseek-v4-flash`（`https://api.deepseek.com`）
- 检索：知乎官方开放平台 `zhihu_search`
- 生产 Secret 只存在于服务器 `/etc/ask-better/ask-better.env`（权限 600），不进入仓库、前端 Bundle、日志或接口响应

当知乎上游返回 `30001 rate limit exceeded` 时，Retrieve 进入 `quota_limited`，只保留已经取得的真实 Evidence，不会回退到演示数据。

### Production Smoke

Smoke Harness 只调用公网 `/api/question/*`，不读取任何 Secret：

```bash
SMOKE_BASE_URL=https://ask.wulisu.icu pnpm smoke:production -- "现在转码还有前途吗？"
```

PowerShell：

```powershell
$env:SMOKE_BASE_URL = "https://ask.wulisu.icu"
pnpm smoke:production -- "现在转码还有前途吗？"
```

## 服务端集成

### 1. OpenAI-compatible LLM

通过以下服务端环境变量配置：

- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`

业务代码不根据模型厂商分支。LLM 的结构化输出进入 Domain/UI 前会再次通过 Zod 校验。

### 2. 知乎开放平台搜索

P0 使用知乎官方 HTTP 搜索能力：

- `GET /api/v1/content/zhihu_search`
- Bearer Access Secret
- `X-Request-Timestamp` 秒级 Unix 时间戳

Access Secret 仅存在于服务端。浏览器不会收到知乎 Secret、LLM API Key 或 Redis Token。

检索层会生成 1–3 个查询、限制单次结果数量、缓存重复查询、归一化并去重真实 Evidence。Coverage / Gap 结论只描述“本次检索证据覆盖了什么、较少覆盖什么”，不会据此声称整个知乎都没有相关讨论。

### 3. 可选 Upstash Redis Cache

如果配置：

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

服务会使用 Upstash REST 缓存知乎搜索结果以保护调用额度。未配置时使用进程内 Memory Cache；Redis 出现故障时会降级为直接调用官方搜索，不把缓存当作正确性依赖。

## Partial-success 行为

真实外部依赖不保证永远可用，因此 Retrieve 阶段有明确状态：

- `success`：已拿到检索结果并完成 Coverage / Gap 分析。
- `partial`：已拿到部分真实 Evidence，但后续分析不完整；仍可继续编译。
- `quota_limited`：知乎检索额度暂时受限；只展示已经获得的内容。
- `unavailable`：本次没有可用的知乎 Evidence；仍可仅基于用户输入继续整理问题。

最终 Compile 结果会标记本次是否实际使用了知乎 Evidence。

## 安全与产品边界

- Question Compiler **不得替用户编造个人背景或约束条件**。最终问题中的用户事实只能来自原始输入和用户明确选择/补充的信息。
- P0 不依赖 OAuth、收藏/关注等用户数据，也不自动代用户发布问题。
- 当前官方 Skill 未将“直接创建/发布问题”作为稳定 P0 写接口，因此结果页只提供复制与打开知乎提问页，最终发布动作由用户确认。
- OAuth 变量仅为 P1 预留，不阻塞游客主流程。

## 本地开发

要求 Node.js 22+，使用 pnpm/Corepack。

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Windows PowerShell 可用：

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

然后只在本地 `.env.local` 或部署平台 Secret Store 中填写真实凭据。不要把真实 Access Secret / API Key 提交到 GitHub。

最小 P0 配置：

```env
ZHIHU_API_BASE_URL=https://developer.zhihu.com
ZHIHU_ACCESS_SECRET=
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
```

Upstash 为可选项；P1 OAuth 也不是主流程必需项。完整变量见 `.env.example`。

## 验证

```bash
pnpm --filter @ask-better/domain test
pnpm --filter @ask-better/domain typecheck
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web build
```

测试通过 dependency injection / fixture 验证 LLM、知乎 HTTP、缓存和服务层，不会在 CI 中消费真实知乎额度或调用真实 LLM。

## 技术栈

- Next.js 16 App Router + React 19 + TypeScript
- pnpm + Turborepo
- Zod runtime contracts
- Vercel AI SDK + OpenAI-compatible provider
- 知乎开放平台 HTTP API
- Upstash Redis（可选）+ Memory Cache fallback
- Vitest

## 文档

- `docs/PRD.md`：Master PRD v2.0
- `docs/ARCHITECTURE.md`：总体技术架构
- `docs/ZHIHU_INTEGRATION.md`：知乎官方能力、鉴权、缓存与降级边界
- `docs/FRONTEND_SPEC.md`：Web UI 与响应式规范
- `docs/superpowers/plans/2026-09-12-core-pipeline.md`：当前真实 Pipeline 实施计划
