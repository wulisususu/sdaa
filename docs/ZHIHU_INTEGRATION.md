# 「问得更好」知乎官方 HTTP API + AI 核心管线设计

> Status: **Design approved at approach level / implementation review pending**  
> Date: 2026-09-12  
> Selected approach: **A. Next.js 服务端直接调用知乎官方 HTTP API**

## 1. 本阶段目标

把现有 Web 前端中的 Mock 数据替换为真实服务端能力，形成第一个可工作的 MVP：

```text
用户输入问题
  ↓
AI 分析真实意图 / 缺失上下文 / 初步问题体检
  ↓
AI 动态生成 2–4 个高信息增益追问
  ↓
知乎官方 Search API 检索真实站内内容
  ↓
基于检索证据分析 Existing Knowledge Coverage
  ↓
识别当前检索结果较少覆盖的 Knowledge Gap
  ↓
AI 编译 Question Package
  ↓
前端显示 Before / After + 来源 + 复制 / 打开知乎提问页
```

本阶段不做：

- OAuth 个性化数据
- 收藏夹分析
- 自动发布问题
- Android 独立客户端
- 最终视觉美化
- 复杂多 Agent Orchestrator

---

## 2. 为什么选择 HTTP API Adapter

生产运行时：

```text
Web / Future Android
        ↓
Next.js Backend API
        ↓
 ┌───────────────┬────────────────┐
 │               │                │
LLM Provider   Zhihu HTTP API   Cache
```

优点：

- Vercel 可直接部署 Web + API
- 不依赖 CLI 子进程
- Secret 永远停留在服务端
- Android 未来复用同一后端
- 官方 API 变更时只修改 Adapter
- 不把知乎实现细节泄漏给 UI

官方 Skill 的角色：**开发期查询、核对官方接口与鉴权规则**。  
正式产品运行时：**直接 HTTP 调用官方开放接口**。

---

## 3. 官方能力使用边界

### P0：知乎搜索

官方开发者手册明确提供：

```text
GET /api/v1/content/zhihu_search
```

返回信息包括：

- 标题
- 摘要
- 作者
- 发布时间
- 相关性分数
- 权威度等级
- 点赞数
- 评论数
- 精选评论

本项目使用这些字段完成：

- Similar Questions / Similar Discussions
- Existing Knowledge Coverage
- Freshness / Staleness Signal
- Authority / Relevance Signal
- Evidence Traceability

### P1：全网搜索

```text
GET /api/v1/content/global_search
```

仅在时间敏感型问题中作为辅助证据，不替代知乎社区内容。

### 不作为 P0 主链路：直答 Agent

```text
POST /v1/chat/completions
```

原因：

1. 「问得更好」的产品价值不是替用户直接回答。
2. 直答额度比站内搜索更紧。
3. Coverage / Gap 应优先基于可追溯的真实搜索证据。

未来可以作为 P1 的辅助总结器，但不能成为产品核心。

### 暂不依赖：发布问题

当前已核对的比赛资料没有把“创建/发布问题”写接口作为本项目可依赖的正式能力。

MVP：

```text
编译完成
  ↓
复制完整问题 / 打开知乎提问页
```

未来如官方开放写接口：新增 `PublisherAdapter`，不修改核心 Question Pipeline。

---

## 4. 服务端模块边界

建议结构：

```text
apps/web/src/lib/
├─ ai/
│  ├─ provider.ts
│  ├─ structured-output.ts
│  ├─ prompts/
│  │  ├─ analyze.ts
│  │  ├─ clarify.ts
│  │  ├─ coverage.ts
│  │  └─ compile.ts
│  └─ errors.ts
│
├─ zhihu/
│  ├─ client.ts
│  ├─ search.ts
│  ├─ normalize.ts
│  ├─ types.ts
│  └─ errors.ts
│
├─ cache/
│  ├─ cache.ts
│  ├─ memory-cache.ts
│  └─ redis-cache.ts
│
└─ question/
   ├─ analyze-service.ts
   ├─ retrieve-service.ts
   ├─ coverage-service.ts
   └─ compile-service.ts
```

共享数据契约继续放在 `packages/domain`；若 Schema 数量增长，再拆出 `packages/schemas`，本阶段不为目录完整性而提前制造空包。

---

## 5. 四阶段核心管线

### Stage 1 — Analyze

输入：

```json
{
  "rawQuestion": "现在转码还有前途吗？"
}
```

输出：

```json
{
  "intent": {
    "domain": "career",
    "primaryGoal": "评估职业转换是否值得",
    "timeSensitive": true,
    "ambiguities": ["转码方向未知", "有前途的评价标准未知"]
  },
  "missingContext": [],
  "lint": [],
  "clarificationQuestions": []
}
```

Analyze 一次完成：

- Intent
- Missing Context
- Initial Lint
- 2–4 个澄清问题

不拆成多次 LLM 调用，降低延迟和成本。

### Stage 2 — Clarify

前端收集用户对 2–4 个问题的回答。

此阶段默认不再次调用模型；只有需要动态追加追问时才调用 `/clarify`。

MVP 优先：一次 Analyze 就生成足够的 2–4 个问题。

### Stage 3 — Retrieve + Coverage

1. 基于原问题 + 澄清条件生成 1–3 个搜索 Query。
2. 查询缓存。
3. Cache Miss 时调用知乎 Search API。
4. Normalize 官方结果。
5. 将有限数量的高相关证据交给 Coverage Analyzer。
6. 输出：
   - similar items
   - covered topics
   - knowledge gaps
   - evidence quality

### Stage 4 — Compile

输入：

- Raw Question
- Clarification Answers
- Lint
- Search Evidence
- Coverage
- Knowledge Gap

输出：完整 Question Package。

---

## 6. HTTP API Contract

### `POST /api/question/analyze`

职责：

- Intent
- Missing Context
- Initial Lint
- Clarification Questions

成功：`200`

### `POST /api/question/retrieve`

职责：

- 构建查询词
- Zhihu Search
- Normalize
- Coverage
- Knowledge Gap

成功：`200`

允许部分成功：`200 + status: partial`

例如知乎搜索成功，但 Coverage LLM 暂时失败时，仍然返回真实检索结果。

### `POST /api/question/compile`

职责：

- 根据完整上下文生成 Question Package

成功：`200`

### `/clarify`

不作为第一版必须请求。

保留接口设计，但 MVP 优先减少一次网络往返。

---

## 7. LLM Provider

继续采用 OpenAI-compatible 抽象：

```env
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
```

业务代码不能出现具体厂商名称判断。

统一接口概念：

```ts
interface LLMProvider {
  generateStructured<T>(input: StructuredRequest<T>): Promise<T>
}
```

要求：

- 服务端调用
- timeout
- Structured JSON
- Schema 校验
- 失败不把原始模型输出直接传给前端

---

## 8. Structured Output / Schema

所有模型输出必须先校验。

核心 Schema：

- `QuestionAnalysisSchema`
- `ClarificationQuestionSchema`
- `LintIssueSchema`
- `SearchQueryPlanSchema`
- `CoverageAnalysisSchema`
- `CompiledQuestionSchema`

原则：

```text
LLM Raw Output
  ↓
Parse
  ↓
Schema Validate
  ↓
Domain Object
  ↓
API Response
```

禁止：

```text
LLM String → 直接渲染 UI
```

---

## 9. 知乎 Adapter

统一服务端接口：

```ts
interface ZhihuGateway {
  search(query: string): Promise<ZhihuSearchResult[]>
}
```

官方返回结果必须先 Normalize，UI 不直接依赖官方原始字段名。

统一领域对象：

```ts
interface EvidenceItem {
  id: string
  title: string
  summary?: string
  url?: string
  author?: string
  publishedAt?: string
  relevance?: number
  authority?: string | number
  likes?: number
  comments?: number
  source: "zhihu"
}
```

这样官方字段变化时只修改 `normalize.ts`。

### 鉴权

实现时严格按当前官方 Skill / 开放平台文档确认 Header 与鉴权方式。

**不在代码或设计文档中猜测 Header 名称。**

官方要求的 Secret 只能存在服务端环境变量。

---

## 10. 搜索 Query 策略

用户最终上下文可能很长，不直接整段传给知乎 Search。

LLM 先生成最多 3 个查询：

```json
{
  "queries": [
    "非科班 转码 2027届",
    "AI Coding 初级开发岗位",
    "AI应用开发 转码"
  ]
}
```

限制：

- 1–3 个 Query
- 去掉私人细节
- 保留决定答案的重要条件
- 不用模型生成十几个关键词浪费 API 额度

搜索结果再进行：

- URL / ID 去重
- 标题近似去重
- 相关性排序
- 权威度辅助排序
- 时间敏感问题增加 freshness 信号

交给 LLM 的证据数量控制在合理上限，避免 Prompt 无限膨胀。

---

## 11. Evidence First

Coverage / Gap 严格区分：

### Evidence

来自知乎官方搜索。

### Inference

模型基于当前 Evidence 做出的分析。

禁止：

> “知乎没有人讨论这个问题。”

允许：

> “当前检索到的相关内容中，较少覆盖以下条件……”

每个 Similar Item 必须保留来源信息。

Coverage / Gap 不要求每一句都对应单独 citation，但分析输入必须来自实际搜索结果。

---

## 12. Cache

第一版实现两个 Adapter：

```text
Cache
├─ MemoryCache（本地开发 / Redis 未配置）
└─ RedisCache（公网默认）
```

公网推荐 Upstash Redis。

Search Cache Key：

```text
zhihu:search:v1:{sha256(normalized_query)}
```

建议 TTL：

- 普通知识问题：6–24 小时
- 明显时间敏感问题：1–3 小时

缓存是性能与配额保护层，不是正确性依赖。

Redis 故障时：

> fallback 到直接 API 调用，而不是让整个产品不可用。

---

## 13. Error Model

统一错误码：

```text
AI_NOT_CONFIGURED
AI_TIMEOUT
AI_INVALID_OUTPUT

ZHIHU_NOT_CONFIGURED
ZHIHU_UNAUTHORIZED
ZHIHU_RATE_LIMITED
ZHIHU_QUOTA_EXHAUSTED
ZHIHU_UPSTREAM_ERROR

RETRIEVAL_PARTIAL
COMPILE_FAILED
```

前端只展示用户可理解的中文：

- “AI 服务暂未配置”
- “知乎检索额度暂时受限”
- “已拿到部分结果，可以继续编译”
- “检索暂时失败，请稍后重试”

禁止把 Stack Trace、Secret、上游原始错误体返回浏览器。

---

## 14. Partial Success

产品必须允许部分能力故障。

例：

```text
Analyze ✅
Zhihu Search ✅
Coverage AI ❌
```

前端仍展示：

- 真实 Similar Results
- 来源
- “覆盖分析暂时不可用”

而不是整页报错。

又例如：

```text
Analyze ✅
Zhihu Search ❌
```

用户可以继续 Compile，但结果页明确：

> “本次未加入知乎已有讨论证据，建议稍后重新检索。”

这样 Demo 不会因为单点外部 API 抖动完全失效。

---

## 15. Secrets

新增/保留：

```env
# Zhihu Open Platform
ZHIHU_API_BASE_URL=
ZHIHU_ACCESS_SECRET=

# LLM
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=

# Cache
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

原则：

- `.env.example` 只放变量名和说明
- GitHub 不提交真实值
- 浏览器不读这些变量
- Android APK 不读这些变量
- 日志不得打印完整 Token / Secret

---

## 16. 前端从 Mock 切换到真实 API

保持现有页面流程，不重做 UI。

变化：

```text
当前：
UI → mock-data.ts

本阶段：
UI → api-client → Next.js API → Domain Response
```

Mock 数据保留仅用于：

- Story / visual development
- E2E fixture
- 外部 API 完全不可用时的开发测试

生产模式不能把 Mock 当成真实知乎数据展示。

---

## 17. Loading 状态

前端按用户理解显示：

### Analyze

> 正在理解你的问题…

### Retrieve

> 正在知乎已有讨论中查找相关内容…

### Coverage

> 正在整理已经回答了什么…

### Compile

> 正在把信息编译成一个更清楚的问题…

避免：

- “Agent 2 running”
- “Embedding…”
- “Chain-of-thought…”
- 技术实现细节暴露给普通用户

---

## 18. 测试策略

### Unit Tests

必须覆盖：

- Schema 正常/异常输出
- Zhihu Normalize
- Search 去重
- Query 上限 = 3
- Cache Hit / Miss
- Error Mapping
- Question Package formatter

### Adapter Tests

使用 fixture / mock fetch 验证：

- 知乎成功
- 401/403
- Rate Limit
- 5xx
- Malformed Response

真实官方额度不在 CI 中消耗。

### Route Tests

验证：

- invalid input → 400
- missing config → 可解释错误
- upstream partial → partial response
- Schema invalid → safe error

### Build

继续要求：

```text
Domain Tests
Web Build
```

### E2E

核心 Golden Path：

```text
输入
→ 分析
→ 回答补充问题
→ 检索
→ Coverage / Gap
→ Compile
→ 复制完整问题
```

---

## 19. 实施顺序

1. 扩展 Domain Schema / Error Model
2. LLM Provider + Structured Output
3. `/api/question/analyze`
4. Zhihu HTTP Adapter
5. Cache Adapter
6. `/api/question/retrieve`
7. Coverage / Gap Analyzer
8. `/api/question/compile`
9. Web API Client
10. 前端从 Mock 切换真实接口
11. Loading / Error / Partial 状态
12. Golden Path 测试

---

## 20. 完成标准

这一阶段只有满足以下条件才能合并 `main`：

- 前端不再依赖 Mock 完成主流程
- LLM Provider 可由环境变量切换
- Analyze 返回结构化真实结果
- Zhihu Search 通过服务端 Adapter 调用
- 搜索结果显示真实来源
- Coverage / Gap 基于搜索证据
- Compile 使用用户澄清信息 + Evidence
- 无 Secret 进入前端
- External API 失败有可恢复状态
- 测试通过
- Next.js Build 通过
- 功能分支合并后删除

---

## 21. 设计决策总结

正式冻结：

```text
Next.js Web + Server API
        ↓
OpenAI-compatible LLM Adapter
        +
Zhihu Official HTTP API Adapter
        +
Cache Adapter
```

核心原则：

> **AI 负责理解和编译，知乎真实数据负责给“已有知识覆盖 / 知识缺口”提供证据。**

产品不依赖 CLI 运行时、不爬虫、不把 Secret 放到客户端、不把模型推断伪装成知乎事实。
