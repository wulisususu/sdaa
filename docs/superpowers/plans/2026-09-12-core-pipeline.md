# Core Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Web prototype's Mock analysis/retrieval/compile data with a real, server-side Question Compiler pipeline backed by an OpenAI-compatible LLM and Zhihu's official `zhihu_search` HTTP API.

**Architecture:** Keep the existing five-stage Web UX and make the server authoritative for AI and Zhihu work. `packages/domain` owns runtime-validated contracts; Next.js Route Handlers call an injectable LLM adapter, Zhihu HTTP adapter, and cache adapter; the browser only calls our `/api/question/*` endpoints. The first working path is Analyze → local clarification answers → Retrieve/Coverage/Gap → Compile, with partial-success behavior when Zhihu or the coverage model is unavailable.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, pnpm/Turborepo, Zod, Vercel AI SDK (`ai` + `@ai-sdk/openai`), OpenAI-compatible model endpoint, Zhihu official HTTP API, Upstash Redis with in-memory fallback, Vitest.

**Spec:** `docs/ZHIHU_INTEGRATION.md` (plus `docs/ARCHITECTURE.md` and `docs/PRD.md`)

## Global Constraints

- Production Zhihu integration uses direct HTTPS, not a CLI subprocess.
- Zhihu search endpoint is `GET https://developer.zhihu.com/api/v1/content/zhihu_search`.
- Zhihu headers are `Authorization: Bearer <ZHIHU_ACCESS_SECRET>`, `X-Request-Timestamp: <seconds Unix timestamp>`, and `Content-Type: application/json`.
- `Query` is required; `Count` is capped at 10.
- Zhihu response `Code=20001` maps to unauthorized and `Code=30001` maps to rate limited; these errors are never retried in a loop.
- Browser and future Android code never receive Zhihu Access Secret, LLM API key, or Redis token.
- LLM provider is configured only by `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`; business code contains no provider-name branching.
- Every LLM structured result is validated before entering Domain/UI.
- Question Compiler must never invent user facts. Facts in the final question must come from raw input or clarification answers; model suggestions must be phrased as suggestions, not asserted profile facts.
- Coverage/Gap claims are evidence-bounded: use phrasing equivalent to “当前检索结果较少覆盖…”, never “知乎没有讨论…”.
- Search evidence preserves the real Zhihu URL returned by the official API.
- Search queries are 1–3 items, deduplicated, and no single request asks for more than 10 results.
- Cache protects quota but is not a correctness dependency; Redis failure falls back to direct official API calls.
- P0 does not use OAuth, user collections, automatic publishing, or the Zhihu Direct Answer Agent.
- Chinese remains the primary UI language; English is secondary only.
- At all times total Git branches, including `main`, must remain <= 5; merge and delete the feature branch after verification.

---

## File Structure Locked for This Plan

```text
packages/domain/src/
├─ pipeline.ts                 # Zod request/response contracts + inferred types
├─ pipeline.test.ts            # contract validation tests
├─ question.ts                 # existing UI-domain types; evidence fields extended here
└─ index.ts                    # exports pipeline contracts

apps/web/src/lib/
├─ api-client.ts               # browser-only calls to our Next.js API
├─ ai/
│  ├─ provider.ts              # OpenAI-compatible provider factory + structured generation
│  ├─ provider.test.ts
│  └─ prompts/
│     ├─ analyze.ts
│     ├─ query-plan.ts
│     ├─ coverage.ts
│     └─ compile.ts
├─ zhihu/
│  ├─ client.ts                # official HTTP protocol
│  ├─ client.test.ts
│  ├─ normalize.ts
│  ├─ normalize.test.ts
│  └─ errors.ts
├─ cache/
│  ├─ cache.ts                 # cache interface/factory
│  ├─ memory-cache.ts
│  └─ redis-cache.ts
└─ question/
   ├─ analyze-service.ts
   ├─ analyze-service.test.ts
   ├─ retrieve-service.ts
   ├─ retrieve-service.test.ts
   ├─ compile-service.ts
   └─ compile-service.test.ts

apps/web/src/app/api/question/
├─ analyze/route.ts
├─ retrieve/route.ts
└─ compile/route.ts

apps/web/src/components/
├─ compiler-demo.tsx           # replace mock state with real API state
├─ input-stage.tsx             # loading/error props
├─ coverage-stage.tsx          # real evidence + partial status
├─ knowledge-coverage.tsx      # source links
├─ knowledge-gap.tsx           # evidence-bound inference display
└─ result-stage.tsx            # compile warning/source status
```

No separate `packages/schemas` package is created in this phase; contracts stay next to the existing shared Domain package to avoid empty architecture ceremony.

---

### Task 1: Runtime-validated shared pipeline contracts

**Files:**
- Modify: `packages/domain/package.json`
- Create: `packages/domain/src/pipeline.test.ts`
- Create: `packages/domain/src/pipeline.ts`
- Modify: `packages/domain/src/question.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces `AnalyzeRequestSchema`, `QuestionAnalysisSchema`, `RetrieveRequestSchema`, `RetrieveResultSchema`, `CompileRequestSchema`, `CompileResultSchema`, `ApiErrorSchema`.
- Produces types `QuestionAnalysis`, `SearchEvidenceItem`, `RetrieveResult`, `EvidenceStatus`, `ApiErrorCode`.
- Existing `ClarificationQuestion`, `QuestionDiagnostic`, `KnowledgeCoverageItem`, `KnowledgeGapItem`, and `CompiledQuestion` remain compatible with existing components.

- [ ] **Step 1: Add Zod to the shared Domain runtime dependencies**

Modify `packages/domain/package.json` so it contains:

```json
"dependencies": {
  "zod": "^4.0.0"
}
```

Keep existing TypeScript/Vitest dev dependencies.

- [ ] **Step 2: Write failing contract tests**

Create `packages/domain/src/pipeline.test.ts` with tests equivalent to:

```ts
import { describe, expect, test } from "vitest";
import {
  AnalyzeRequestSchema,
  QuestionAnalysisSchema,
  RetrieveResultSchema,
  CompileResultSchema
} from "./pipeline";

describe("pipeline contracts", () => {
  test("rejects a too-short raw question", () => {
    expect(AnalyzeRequestSchema.safeParse({ rawQuestion: "四字" }).success).toBe(false);
  });

  test("analysis requires between two and four clarification questions when clarification is needed", () => {
    const parsed = QuestionAnalysisSchema.safeParse({
      intent: ["职业转换"],
      primaryGoal: "判断是否值得转向开发岗位",
      timeSensitive: true,
      ambiguities: ["转码方向未知"],
      missingContext: [{ field: "direction", reason: "方向会改变答案", priority: 1 }],
      clarificationQuestions: [
        { id: "direction", question: "更想转向哪类岗位？", options: ["AI 应用开发", "前后端", "暂不确定"] },
        { id: "goal", question: "最关心什么？", options: ["就业", "薪资", "成长"] }
      ],
      diagnostics: [{ code: "W001", title: "范围太大", summary: "需要明确转码方向", level: "warning" }]
    });
    expect(parsed.success).toBe(true);
  });

  test("retrieval result distinguishes evidence status", () => {
    const parsed = RetrieveResultSchema.safeParse({
      status: "success",
      evidenceStatus: "sufficient",
      queries: ["非科班 转码"],
      evidence: [],
      existingCoverage: [],
      knowledgeGaps: []
    });
    expect(parsed.success).toBe(true);
  });

  test("compiled result uses the existing question package shape", () => {
    expect(CompileResultSchema.safeParse({
      compiledQuestion: {
        title: "非计算机专业学生如何判断是否值得转向 AI 应用开发？",
        background: "用户正在评估职业方向。",
        goal: "选择值得投入的路线。",
        constraints: ["关注初级岗位"],
        coreUncertainty: "应先补 Web 基础还是直接学习 AI 应用开发？",
        expectedAnswer: ["招聘环境", "学习顺序"]
      },
      evidenceUsed: true
    }).success).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
pnpm install --no-frozen-lockfile
pnpm --filter @ask-better/domain test
```

Expected: FAIL because `./pipeline` does not exist.

- [ ] **Step 4: Implement the schemas**

`pipeline.ts` must include these exact bounded enums:

```ts
export const EvidenceStatusSchema = z.enum(["sufficient", "partial", "insufficient"]);
export const RetrievalStatusSchema = z.enum(["success", "partial", "unavailable", "quota_limited"]);
export const ApiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "AI_NOT_CONFIGURED",
  "AI_TIMEOUT",
  "AI_INVALID_OUTPUT",
  "ZHIHU_NOT_CONFIGURED",
  "ZHIHU_UNAUTHORIZED",
  "ZHIHU_RATE_LIMITED",
  "ZHIHU_UPSTREAM_ERROR",
  "COMPILE_FAILED"
]);
```

`SearchEvidenceItem` fields are:

```ts
{
  id: string;
  title: string;
  contentType: string;
  summary: string;
  url: string;
  author: string;
  editedAt: number;
  rankingScore: number;
  authorityLevel: string;
  voteUpCount: number;
  commentCount: number;
  selectedComments: string[];
  source: "zhihu";
}
```

Extend `KnowledgeCoverageItem` and `KnowledgeGapItem` with optional `evidenceIds?: string[]` so current components do not break while real evidence can be traced.

- [ ] **Step 5: Export and verify GREEN**

Update `packages/domain/src/index.ts`:

```ts
export * from "./pipeline";
```

Run:

```bash
pnpm --filter @ask-better/domain test
pnpm --filter @ask-better/domain typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/domain
git commit -m "feat: add question pipeline contracts"
```

---

### Task 2: OpenAI-compatible structured LLM adapter

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/ai/provider.test.ts`
- Create: `apps/web/src/lib/ai/provider.ts`
- Create: `apps/web/src/lib/ai/prompts/analyze.ts`
- Create: `apps/web/src/lib/ai/prompts/query-plan.ts`
- Create: `apps/web/src/lib/ai/prompts/coverage.ts`
- Create: `apps/web/src/lib/ai/prompts/compile.ts`

**Interfaces:**
- Produces `generateStructured<T>(schema, system, prompt): Promise<T>`.
- Provider factory reads only `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.
- Uses `createOpenAI({ baseURL, apiKey })` with Vercel AI SDK and `generateText({ output: Output.object({ schema }) })`.

- [ ] **Step 1: Add dependencies and Web test script**

Add runtime dependencies:

```json
"ai": "latest",
"@ai-sdk/openai": "latest",
"zod": "^4.0.0",
"@upstash/redis": "latest"
```

Add Web dev dependency:

```json
"vitest": "3.2.4"
```

Add script:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write failing provider tests around configuration, not the network**

Test that a factory given an explicit env object throws a typed `AI_NOT_CONFIGURED` error when any required LLM variable is empty and returns configuration without logging secrets when complete. The test must not make a real model call.

- [ ] **Step 3: Run Web tests and verify RED**

```bash
pnpm --filter web test
```

Expected: FAIL because provider module is missing.

- [ ] **Step 4: Implement provider factory and structured generation**

Core setup:

```ts
const provider = createOpenAI({
  apiKey: config.apiKey,
  baseURL: config.baseURL
});

const { output } = await generateText({
  model: provider(config.model),
  system,
  prompt,
  output: Output.object({ schema }),
  abortSignal: AbortSignal.timeout(20_000)
});
```

Map timeout to `AI_TIMEOUT`; schema/no-object failures to `AI_INVALID_OUTPUT`. Never return the raw upstream body or key to the browser.

- [ ] **Step 5: Add four prompt builders with hard invariants**

`analyze.ts` must instruct the model to:

- infer intent but not invent biography;
- emit at most five diagnostics;
- ask only 2–4 high-information-gain clarification questions when needed;
- keep question options short and understandable.

`query-plan.ts` must instruct it to return 1–3 Zhihu search queries, omit private details that are not needed for retrieval, and keep answer-changing conditions.

`coverage.ts` must state that all coverage and gaps are limited to supplied evidence and must never claim complete platform coverage.

`compile.ts` must state that user facts may only come from raw input/answers, and that evidence is context for novelty/coverage rather than a source of invented user background.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter web test
pnpm --filter web typecheck
```

```bash
git add apps/web/package.json apps/web/src/lib/ai pnpm-lock.yaml
git commit -m "feat: add structured llm adapter"
```

---

### Task 3: Analyze service and `/api/question/analyze`

**Files:**
- Create: `apps/web/src/lib/question/analyze-service.test.ts`
- Create: `apps/web/src/lib/question/analyze-service.ts`
- Create: `apps/web/src/app/api/question/analyze/route.ts`

**Interfaces:**
- `analyzeQuestion(rawQuestion, deps): Promise<QuestionAnalysis>`
- Route request: `{ rawQuestion: string }`
- Route success: `{ ok: true, data: QuestionAnalysis }`
- Route failure: `{ ok: false, error: { code, message, retryable } }`

- [ ] **Step 1: Write RED service tests using an injected fake structured generator**

The fake returns a valid analysis. Assert that `analyzeQuestion` forwards the user's exact raw question, validates the fake result, and does not enrich it with unprovided user facts.

- [ ] **Step 2: Implement minimal service**

Use `QuestionAnalysisSchema` as the structured-output schema. Keep service free of `NextRequest`/React so it is unit-testable.

- [ ] **Step 3: Add route validation**

Route pseudocode:

```ts
export async function POST(request: Request) {
  const parsed = AnalyzeRequestSchema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", 400, false);

  try {
    const data = await analyzeQuestion(parsed.data.rawQuestion);
    return Response.json({ ok: true, data });
  } catch (error) {
    return toSafeApiResponse(error);
  }
}
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter web test
pnpm --filter web build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/question apps/web/src/app/api/question/analyze
git commit -m "feat: add question analysis endpoint"
```

---

### Task 4: Zhihu official HTTP search adapter

**Files:**
- Create: `apps/web/src/lib/zhihu/errors.ts`
- Create: `apps/web/src/lib/zhihu/normalize.ts`
- Create: `apps/web/src/lib/zhihu/normalize.test.ts`
- Create: `apps/web/src/lib/zhihu/client.ts`
- Create: `apps/web/src/lib/zhihu/client.test.ts`

**Interfaces:**
- `searchZhihu(query: string, options?: { count?: number; fetchImpl?: typeof fetch }): Promise<SearchEvidenceItem[]>`
- Official URL: `https://developer.zhihu.com/api/v1/content/zhihu_search` unless `ZHIHU_API_BASE_URL` explicitly overrides the host for testing/deployment.

- [ ] **Step 1: Write normalization RED tests**

Fixture includes official fields:

```ts
{
  Title: "RAG 评测方法综述",
  ContentType: "Article",
  ContentID: "123456789",
  ContentText: "本文介绍 <em>RAG</em> 评测框架",
  Url: "https://zhuanlan.zhihu.com/p/123456789?utm_medium=openapi_platform",
  CommentCount: 15,
  VoteUpCount: 128,
  AuthorName: "张三",
  EditTime: 1710000000,
  CommentInfoList: [{ Content: "评论" }],
  AuthorityLevel: "2",
  RankingScore: 0.98
}
```

Assert normalized output preserves URL/counts/score and strips only `<em>`/`</em>` highlight tags from summary.

- [ ] **Step 2: Write client RED tests with `fetchImpl` injection**

Assert request URL contains URL-encoded `Query` and capped `Count=10`, and request headers include:

```text
Authorization: Bearer secret
X-Request-Timestamp: <integer seconds>
Content-Type: application/json
```

Also test:

- `Code: 20001` → `ZHIHU_UNAUTHORIZED`
- `Code: 30001` → `ZHIHU_RATE_LIMITED`
- malformed JSON/5xx → `ZHIHU_UPSTREAM_ERROR`
- missing secret → `ZHIHU_NOT_CONFIGURED`

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm --filter web test
```

- [ ] **Step 4: Implement adapter**

Do not retry authentication/rate-limit errors. Set a 10-second timeout on the HTTP request. Validate the top-level `Code`, `Message`, and `Data.Items` shape before normalization.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter web test
pnpm --filter web typecheck
```

```bash
git add apps/web/src/lib/zhihu
git commit -m "feat: add official zhihu search adapter"
```

---

### Task 5: Cache abstraction and quota-protecting retrieval service

**Files:**
- Create: `apps/web/src/lib/cache/cache.ts`
- Create: `apps/web/src/lib/cache/memory-cache.ts`
- Create: `apps/web/src/lib/cache/redis-cache.ts`
- Create: `apps/web/src/lib/question/retrieve-service.test.ts`
- Create: `apps/web/src/lib/question/retrieve-service.ts`

**Interfaces:**
- `CacheAdapter.get<T>(key): Promise<T | null>`
- `CacheAdapter.set<T>(key, value, ttlSeconds): Promise<void>`
- `retrieveQuestionContext(input, deps): Promise<RetrieveResult>`

- [ ] **Step 1: Write RED retrieval tests**

Cover all of these cases:

1. Query planner returns four duplicate/extra queries → service uses only three unique non-empty queries.
2. Cache hit → Zhihu search function is not called for that query.
3. Cache miss → Zhihu search is called and result is cached.
4. One query rate-limited after another succeeds → return `status: "partial"` or `"quota_limited"` with already-retrieved real evidence preserved.
5. All Zhihu calls fail → return `status: "unavailable"`, `evidenceStatus: "insufficient"`, no fake evidence.
6. Duplicate `ContentID`/URL across queries → one evidence item.

- [ ] **Step 2: Implement memory + Redis adapters**

Use Upstash when both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` exist. Otherwise use process-local memory cache.

Cache key:

```text
zhihu:search:v1:<sha256(lowercase-trim-collapseWhitespace(query))>
```

TTL:

- `timeSensitive=true`: 7200 seconds
- otherwise: 21600 seconds

If Redis get/set throws, catch it and fall back to direct search; cache errors never become a user-visible fatal error.

- [ ] **Step 3: Implement query planning and evidence dedupe**

Query-plan structured output schema is exactly:

```ts
z.object({ queries: z.array(z.string().trim().min(2)).min(1).max(3) })
```

Deduplicate by `id`, then URL; stable-sort by `rankingScore` descending, then `authorityLevel` descending, then `voteUpCount` descending. Limit evidence passed to the coverage model to the top 12 items.

- [ ] **Step 4: Implement coverage analysis as part of retrieval**

If Zhihu evidence exists, call the coverage prompt with only normalized evidence. Validate output as:

```ts
{
  evidenceStatus: "sufficient" | "partial" | "insufficient";
  existingCoverage: KnowledgeCoverageItem[];
  knowledgeGaps: KnowledgeGapItem[];
}
```

If coverage LLM fails after search succeeded, return `status: "partial"` with evidence intact and empty coverage/gap arrays.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter web test
pnpm --filter web typecheck
```

```bash
git add apps/web/src/lib/cache apps/web/src/lib/question/retrieve-service*
git commit -m "feat: add cached zhihu retrieval pipeline"
```

---

### Task 6: `/api/question/retrieve` route

**Files:**
- Create: `apps/web/src/app/api/question/retrieve/route.ts`

**Interfaces:**
- Consumes `RetrieveRequestSchema` containing raw question, clarification answers, and validated analysis.
- Returns the `RetrieveResult` object even for partial external failures; only invalid input/internal unsafe failures use a fatal error envelope.

- [ ] **Step 1: Implement route using shared request validation**

Return `400` only for invalid client input. `ZHIHU_RATE_LIMITED` during retrieval is represented in `RetrieveResult.status`, not converted into a blank 500.

- [ ] **Step 2: Verify with service tests + build**

```bash
pnpm --filter web test
pnpm --filter web build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/question/retrieve
git commit -m "feat: expose retrieval endpoint"
```

---

### Task 7: Compile service and `/api/question/compile`

**Files:**
- Create: `apps/web/src/lib/question/compile-service.test.ts`
- Create: `apps/web/src/lib/question/compile-service.ts`
- Create: `apps/web/src/app/api/question/compile/route.ts`

**Interfaces:**
- `compileQuestion(input, deps): Promise<CompileResult>`
- Compile input contains raw question, clarification answers, analysis, and retrieval result.

- [ ] **Step 1: Write RED tests for the no-invented-facts invariant**

Use a fake model returning a valid `CompiledQuestion`; assert the compile prompt contains an explicit “only use user facts from rawQuestion + clarificationAnswers” rule and carries retrieval status so a no-evidence run is not presented as evidence-backed.

- [ ] **Step 2: Implement compile service**

Use `CompiledQuestionSchema` as the model output schema. Return:

```ts
{
  compiledQuestion,
  evidenceUsed: input.retrieval.evidence.length > 0
}
```

When retrieval is unavailable, the prompt must explicitly say to compile from user-provided context only and not claim platform novelty.

- [ ] **Step 3: Add route validation and safe errors**

Invalid request → 400. AI unavailable/invalid output → safe mapped error (`AI_*` or `COMPILE_FAILED`) with no raw upstream body.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter web test
pnpm --filter web build
```

```bash
git add apps/web/src/lib/question/compile-service* apps/web/src/app/api/question/compile
git commit -m "feat: add evidence-aware question compiler"
```

---

### Task 8: Browser API client and real five-stage flow

**Files:**
- Create: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/components/compiler-demo.tsx`
- Modify: `apps/web/src/components/input-stage.tsx`
- Modify: `apps/web/src/components/coverage-stage.tsx`
- Modify: `apps/web/src/components/knowledge-coverage.tsx`
- Modify: `apps/web/src/components/knowledge-gap.tsx`
- Modify: `apps/web/src/components/result-stage.tsx`
- Modify: `apps/web/src/components/compiled-question-panel.tsx`
- Modify: `apps/web/src/styles/flow.css`
- Delete after successful replacement: `apps/web/src/lib/mock-question.ts`

**Interfaces:**
- `questionApi.analyze(rawQuestion)`
- `questionApi.retrieve({ rawQuestion, answers, analysis })`
- `questionApi.compile({ rawQuestion, answers, analysis, retrieval })`

- [ ] **Step 1: Implement typed API client**

Every response is parsed through the shared schemas. Network/non-JSON errors become a small client error object with Chinese-safe messages.

- [ ] **Step 2: Replace Mock controller state**

`CompilerDemo` owns:

```ts
const [analysis, setAnalysis] = useState<QuestionAnalysis | null>(null);
const [retrieval, setRetrieval] = useState<RetrieveResult | null>(null);
const [compiled, setCompiled] = useState<CompileResult | null>(null);
const [operation, setOperation] = useState<"idle" | "analyzing" | "retrieving" | "compiling">("idle");
const [error, setError] = useState<string | null>(null);
```

Flow behavior:

- Input continue → call `/analyze`; on success go to `clarify`.
- Clarify continue → no external request; go to `diagnose`.
- Diagnose continue → call `/retrieve`; on success/partial go to `coverage`.
- Coverage continue → call `/compile`; on success go to `result`.
- `重新优化` returns to clarification but clears retrieval/compile so changed answers cannot reuse stale downstream data.
- Editing raw question clears analysis/retrieval/compile and resets max visited to `input`.

- [ ] **Step 3: Add user-facing loading states**

Use exactly these labels:

```text
正在理解你的问题…
正在知乎已有讨论中查找相关内容…
正在把信息编译成一个更清楚的问题…
```

Disable only the action that would duplicate the active request; keep safe back navigation available when possible.

- [ ] **Step 4: Show evidence sources**

Coverage page displays real evidence as clickable Zhihu source links (`target="_blank" rel="noreferrer"`) and a status note:

- success: `已基于知乎检索结果分析`
- partial: `已拿到部分结果，可以继续编译`
- quota_limited: `知乎检索额度暂时受限，以下为已获取结果`
- unavailable: `本次未加入知乎已有讨论证据，仍可继续整理问题`

Never display “知乎检索结果” when `evidence.length === 0`.

- [ ] **Step 5: Delete production Mock dependency**

Delete `mock-question.ts` only after no production component imports it. Test fixtures may live under test files; they must not be used in production fallback rendering.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @ask-better/domain test
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web build
```

```bash
git add apps/web packages/domain
git commit -m "feat: connect web flow to real pipeline"
```

---

### Task 9: Environment, CI, docs, and final verification

**Files:**
- Modify: `.env.example`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- CI does not consume real Zhihu or LLM credentials.
- All adapter/service tests use dependency injection and fixtures.

- [ ] **Step 1: Update `.env.example`**

Use:

```env
# Zhihu Open Platform - server only
ZHIHU_API_BASE_URL=https://developer.zhihu.com
ZHIHU_ACCESS_SECRET=

# OpenAI-compatible LLM - server only
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=

# Optional Upstash cache - server only
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# P1 OAuth - not required for the P0 pipeline
ZHIHU_OAUTH_APP_ID=
ZHIHU_OAUTH_APP_KEY=
ZHIHU_OAUTH_REDIRECT_URI=
```

Do not use a generic `REDIS_URL` in this phase because the implementation uses Upstash REST credentials.

- [ ] **Step 2: Strengthen CI**

CI verify steps become:

```yaml
- name: Test shared domain
  run: pnpm --filter @ask-better/domain test
- name: Test Web services
  run: pnpm --filter web test
- name: Typecheck Web
  run: pnpm --filter web typecheck
- name: Build Web
  run: pnpm --filter web build
```

No CI step makes live Zhihu/LLM calls.

- [ ] **Step 3: Update README**

State that the repository now supports a real server pipeline when secrets are configured, describe the three server-side integrations, document partial-success behavior, and list local setup without showing real keys.

- [ ] **Step 4: Run final verification**

```bash
pnpm install --no-frozen-lockfile
pnpm --filter @ask-better/domain test
pnpm --filter @ask-better/domain typecheck
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web build
```

Expected: all commands PASS without external credentials because network integrations are mocked in tests and Next build only reads runtime secrets inside request handlers.

- [ ] **Step 5: Push feature branch and wait for GitHub Actions**

Required conclusion: `success`.

- [ ] **Step 6: Merge and clean branch**

Fast-forward `main` only after the feature branch CI succeeds. Verify `main` CI succeeds again, then delete `feat/core-pipeline`; repository returns to only `main` unless another active feature branch legitimately exists.

---

## Spec Coverage Self-Review

- Real Analyze: Task 2–3.
- 2–4 clarification questions: Task 1–3.
- Official Zhihu Search + exact Bearer/timestamp protocol: Task 4.
- 1–3 query plan, cache, dedupe, quota protection: Task 5.
- Existing Coverage + Knowledge Gap bounded to evidence: Task 5.
- Partial success: Task 5–6 and Task 8.
- Evidence-aware Compile with no invented user facts: Task 7.
- Frontend Mock removal + loading/error/source states: Task 8.
- Secret isolation/environment variables: Task 2, 4, 9.
- CI with no live quota consumption: Task 9.
- OAuth / automatic publish / Android intentionally remain outside this implementation plan.
