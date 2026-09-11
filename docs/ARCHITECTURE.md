# 「问得更好」技术架构规范

> Status: **Approved architecture / pre-implementation freeze**  
> Scope: Web + Android 双客户端，同仓库维护，Web First。

## 1. 架构目标

本项目采用单仓库 Monorepo，目标是同时支持：

- PC / 浏览器：完整 Web Question Compiler
- Android：独立 Expo / React Native 客户端
- 后端：统一 Question Compiler API
- 共享：类型、Schema、API Client、领域模型和业务规则

核心原则：**共享业务核心，不强求 Web 与 Android 共享全部 UI。**

## 2. 技术栈

### Monorepo

- pnpm Workspace
- Turborepo
- TypeScript

### Web

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui + Radix UI
- Lucide Icons

### Android / Future iOS

- Expo
- React Native
- Expo Router
- TypeScript

### Shared

- Zod：运行时 Schema 与 LLM Structured Output 校验
- 共享 Domain Models
- 共享 API Client
- 共享 Error Codes / Lint Codes
- 共享 Design Tokens（不强制共享复杂 UI）

### AI

- Vercel AI SDK
- OpenAI-compatible Provider Adapter
- 模型通过环境变量配置，不在业务代码绑定厂商

### Cache

- Upstash Redis 为默认远程缓存
- Redis 故障时允许降级到无缓存调用，不影响核心正确性

### Testing

- Vitest：Domain / Schema / Adapter 单元测试
- Playwright：Web Golden Path E2E

### Deploy

- Web/API：Vercel
- Android：Expo EAS Build

## 3. 仓库目录

```text
sdaa/
├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  └─ package.json
│  └─ mobile/
│     ├─ app/
│     ├─ components/
│     └─ package.json
│
├─ packages/
│  ├─ core/
│  │  ├─ question/
│  │  ├─ lint/
│  │  ├─ coverage/
│  │  └─ errors/
│  ├─ schemas/
│  ├─ api-client/
│  ├─ design-tokens/
│  └─ shared/
│
├─ docs/
│  ├─ PRD.md
│  ├─ ARCHITECTURE.md
│  ├─ FRONTEND_SPEC.md
│  ├─ ZHIHU_INTEGRATION.md
│  └─ DEVELOPMENT_PLAN.md
│
├─ tests/
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

## 4. 运行时拓扑

```text
apps/web ------------------┐
                           │
apps/mobile ---------------┼──> Unified Backend API
                           │          │
packages/api-client -------┘          ├── Question Pipeline
                                      ├── Zhihu Gateway
                                      ├── LLM Gateway
                                      └── Cache
```

所有 Secret 只存在于服务端。

Android APK 和浏览器前端禁止持有：

- Zhihu Access Secret
- OAuth App Key
- OAuth access token 的服务端长期存储凭据
- LLM API Key

## 5. Question Compiler Pipeline

业务逻辑按四个阶段组织，而不是部署八个独立 Agent：

```text
Stage 1 — Analyze
Intent + Missing Context + Initial Lint

Stage 2 — Clarify
2–4 个高信息增益追问

Stage 3 — Retrieve
Zhihu Search + Similar Questions + Coverage Evidence

Stage 4 — Compile
Knowledge Gap + Final Question Package
```

逻辑模块可以拆分，但 MVP 工程不做复杂多 Agent 调度。

## 6. 前后端边界

前端负责：

- 输入
- 澄清交互
- 状态机呈现
- Diagnostics UI
- Similar Question / Coverage / Gap 展示
- Before / After Diff
- 编辑与复制

后端负责：

- LLM 调用
- Zhihu API 调用
- OAuth Token 交换
- Secret 管理
- Search Query 生成
- Structured Output 校验
- Cache
- Quota / Rate Limit 处理

## 7. API Contract

第一阶段统一使用：

```text
POST /api/question/analyze
POST /api/question/clarify
POST /api/question/retrieve
POST /api/question/compile
```

客户端不直接调用知乎开放平台。

共享 `packages/api-client` 封装以上接口，Web 与 Android 使用同一客户端契约。

## 8. 核心状态机

```text
idle
  ↓
analyzing
  ↓
clarifying
  ↓
retrieving
  ↓
compiling
  ↓
complete
```

异常状态：

```text
analysis_error
retrieval_partial
quota_limited
compile_error
```

允许用户从错误态回到上一个可恢复步骤，不要求从头重新输入。

## 9. 知乎集成边界

正式产品只依赖官方 Skill / API 支持的能力。

P0 使用：

- 知乎搜索
- 搜索结果中的相关性、权威度、互动和时间信息

P1 可使用：

- OAuth 登录
- 当前授权用户的创作
- 收藏夹
- 近期收藏
- 关注数据

当前官方 Skill 未文档化“创建问题/发布问题”写接口，因此 P0 不依赖自动发布。

比赛版结果页行为：

```text
Compile
  ↓
复制问题 / 打开知乎提问页
```

未来如果出现正式发布接口，通过 `PublisherAdapter` 接入，不修改 Question Pipeline。

## 10. OAuth 设计

OAuth 为 P1，不阻塞主 Demo。

身份分两层：

- Access Secret：识别开放平台调用方
- OAuth Token：代表已授权知乎用户访问其公开范围数据

OAuth 的 App Secret / Token Exchange 必须在服务端执行。

## 11. LLM Provider 抽象

环境变量：

```text
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
```

业务层只依赖统一 `LLMProvider` 接口。

LLM 输出必须先经过 Zod 校验，再进入 Domain / UI。

## 12. Cache 与 Quota

Cache Key 建议：

```text
zhihu:search:{normalized_query_hash}
```

官方不同文档版本可能存在不同配额，程序不得把某个具体每日额度硬编码为业务事实。

应通过服务端返回状态 / 官方 quota 能力处理：

- Remaining quota
- Frequency limit
- Quota exhausted

Quota 错误不得无限重试。

## 13. Secrets

只提交 `.env.example`。

```text
ZHIHU_ACCESS_SECRET=
ZHIHU_OAUTH_APP_ID=
ZHIHU_OAUTH_APP_KEY=
ZHIHU_OAUTH_REDIRECT_URI=

LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

真实值不得进入：

- Git
- 前端 Bundle
- Android APK
- 日志
- Demo 视频

## 14. 分支规则

硬规则：**任何时刻，包括 `main` 在内，总分支数不得超过 5 个。**

允许：

- `main`
- `feat/core-pipeline`
- `feat/ui`
- `feat/zhihu-integration`
- `fix/<short-name>`

正常目标是 1–3 个分支，而不是长期占满 5 个。

功能分支合并后立即删除。

禁止堆积：

- `feature-v2`
- `final-final`
- `new-ui-2`
- 已合并但长期残留的分支

## 15. 开发优先级

### P0

Web 完整 Golden Path。

### P1

Web 移动端响应式体验 + OAuth 预留。

### P2

Expo Android 独立客户端。

架构从第一天支持 Android，但比赛阶段不得牺牲 Web 完成度去同时追求两个 100% 客户端。

## 16. CI

最低 CI：

```text
pnpm install
  ↓
typecheck
  ↓
Biome / lint check
  ↓
Vitest
  ↓
Next build
```

Golden Path Playwright 在关键合并前运行。

## 17. 架构非目标

MVP 不采用：

- 微服务
- Kubernetes
- 独立消息队列
- 复杂 Agent Orchestrator
- 重型数据库
- 自建用户系统
- 独立搜索引擎
- 大规模知乎爬虫

原则：**48 小时内，复杂度只允许出现在产品价值上，不允许出现在基础设施上。**
