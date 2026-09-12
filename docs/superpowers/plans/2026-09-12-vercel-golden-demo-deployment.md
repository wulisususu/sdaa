# Vercel Golden Demo Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 `main` 上的真实 Question Compiler Pipeline 部署到 Vercel 公网环境，并用 DeepSeek `deepseek-v4-flash` + 知乎官方 HTTP API 连续跑通 3 组 Golden Demo。

**Architecture:** 保持现有 Next.js Web/API 单体和共享 Domain Contract 不变。Vercel 承载 `apps/web` 与 `/api/question/*`，DeepSeek 与知乎 Secret 只存在于 Vercel Environment Variables；部署前先建立一个不含 Secret、不会进入 CI 外部调用的生产 Smoke Harness，再按照 Analyze → Retrieve → Compile 的顺序逐层接入真实服务。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript 5.9、pnpm 10、Turborepo、Vitest、Node.js 22+、Vercel、DeepSeek OpenAI-compatible API、知乎开放平台 HTTP API、可选 Upstash Redis。

**Spec:** `docs/superpowers/specs/2026-09-12-vercel-golden-demo-deployment-design.md`

## Global Constraints

- GitHub 仓库固定为 `wulisususu/sdaa`，生产分支固定为 `main`。
- Web / API 部署到 Vercel；P0 不新增独立后端服务。
- DeepSeek Base URL 固定为 `https://api.deepseek.com`，模型固定为 `deepseek-v4-flash`。
- 当前聊天中暴露过的 DeepSeek API Key 禁止用于最终公网 Production；上线前必须新建生产 Key。
- 知乎只使用官方开放平台 HTTP API，P0 只依赖 `zhihu_search`。
- 真实 Secret 只能进入本地 `.env.local` 或 Vercel Environment Variables；禁止进入 Git、README、日志、前端 Bundle 或 Demo 视频。
- P0 不强制 Upstash；未配置时保留现有 Memory Cache。
- 不在本阶段做 OAuth、自动发布、Android、自定义域名、最终 UI 模板、多模型路由或多 Agent。
- CI 不调用真实 DeepSeek / 知乎，不消耗真实额度。
- Golden Demo 完成标准是公网连续完成 3 次完整流程，不是仅仅 Build 成功。
- 任一真实服务兼容性失败时只处理当前层，不同时修改 DeepSeek、知乎和 UI。

---

## File Structure for This Phase

- Create: `scripts/smoke/pipeline.mjs` — 生产环境 HTTP Smoke Harness，只调用公网 `/api/question/*`，不读取任何 Secret。
- Create: `scripts/smoke/pipeline.test.mjs` — 使用 Node 内置 `node:test` + fake fetch 测试 Smoke Harness 调用顺序和 payload。
- Modify: `package.json` — 增加 `smoke:test` 与 `smoke:production` 脚本。
- Modify only if a real DeepSeek compatibility failure is reproduced: `apps/web/src/lib/ai/provider.ts` and its focused tests. Do not pre-emptively vendor-fork the provider.
- Modify after production URL is stable: `README.md` — 写入公网体验地址、部署环境说明和 smoke 命令，不写 Secret。
- No `vercel.json` is required for P0 unless Vercel project settings cannot express the needed monorepo configuration.

---

### Task 1: Add a Secret-free Production Smoke Harness

**Files:**
- Create: `scripts/smoke/pipeline.mjs`
- Create: `scripts/smoke/pipeline.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing public HTTP contracts:
  - `POST /api/question/analyze`
  - `POST /api/question/retrieve`
  - `POST /api/question/compile`
- Produces:
  - `runPipelineSmoke(baseUrl, rawQuestion, fetchImpl = fetch): Promise<object>`
  - CLI env input `SMOKE_BASE_URL`
  - CLI positional question argument
- The script must never read `LLM_API_KEY` or `ZHIHU_ACCESS_SECRET`.

- [ ] **Step 1: Write the failing smoke-harness unit test**

Create `scripts/smoke/pipeline.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { runPipelineSmoke } from "./pipeline.mjs";

test("runs analyze -> retrieve -> compile and answers clarifications from returned options", async () => {
  const calls = [];
  const analysis = {
    intent: ["职业决策"],
    primaryGoal: "比较转码路线",
    timeSensitive: true,
    ambiguities: ["目标方向不明确"],
    missingContext: [{ field: "direction", reason: "影响答案", priority: 1 }],
    clarificationQuestions: [
      { id: "direction", question: "你更想转向哪类岗位？", options: ["AI 应用开发", "传统 Web"] },
      { id: "priority", question: "你最看重什么？", options: ["就业机会", "学习成本"] }
    ],
    diagnostics: []
  };
  const retrieval = {
    status: "success",
    evidenceStatus: "partial",
    queries: ["转码 AI 应用开发"],
    evidence: [{
      id: "answer-1",
      title: "转码讨论",
      contentType: "Answer",
      summary: "摘要",
      url: "https://www.zhihu.com/question/1/answer/1",
      author: "答主",
      editedAt: 1710000000,
      rankingScore: 0.8,
      authorityLevel: "1",
      voteUpCount: 10,
      commentCount: 2,
      selectedComments: [],
      source: "zhihu"
    }],
    existingCoverage: [],
    knowledgeGaps: []
  };
  const compile = {
    compiledQuestion: {
      title: "非科班转向 AI 应用开发时，应如何评估就业机会与学习投入？",
      background: "希望评估转码方向。",
      goal: "比较路线。",
      constraints: ["目标方向：AI 应用开发"],
      coreUncertainty: "投入是否值得。",
      expectedAnswer: ["岗位机会", "学习成本"]
    },
    evidenceUsed: true
  };

  const fakeFetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url: String(url), body });
    const payload = calls.length === 1 ? analysis : calls.length === 2 ? retrieval : compile;
    return new Response(JSON.stringify({ ok: true, data: payload }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  const result = await runPipelineSmoke("https://demo.example.com/", "现在转码还有前途吗？", fakeFetch);

  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://demo.example.com/api/question/analyze");
  assert.deepEqual(calls[1].body.clarificationAnswers, {
    direction: "AI 应用开发",
    priority: "就业机会"
  });
  assert.equal(calls[2].body.retrieval.evidence[0].source, "zhihu");
  assert.equal(result.compile.compiledQuestion.title, compile.compiledQuestion.title);
});

test("throws a safe message when an API response is not ok", async () => {
  const fakeFetch = async () => new Response(
    JSON.stringify({
      ok: false,
      error: { code: "AI_NOT_CONFIGURED", message: "AI 服务暂未配置。", retryable: false }
    }),
    { status: 503, headers: { "content-type": "application/json" } }
  );

  await assert.rejects(
    () => runPipelineSmoke("https://demo.example.com", "现在转码还有前途吗？", fakeFetch),
    /AI_NOT_CONFIGURED: AI 服务暂未配置/
  );
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
node --test scripts/smoke/pipeline.test.mjs
```

Expected: FAIL because `scripts/smoke/pipeline.mjs` does not exist.

- [ ] **Step 3: Implement the minimal smoke harness**

Create `scripts/smoke/pipeline.mjs`:

```js
async function postJson(fetchImpl, url, body) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok || payload?.ok !== true) {
    const code = payload?.error?.code ?? `HTTP_${response.status}`;
    const message = payload?.error?.message ?? "生产 Smoke Test 失败。";
    throw new Error(`${code}: ${message}`);
  }
  return payload.data;
}

function buildClarificationAnswers(analysis) {
  return Object.fromEntries(
    (analysis.clarificationQuestions ?? [])
      .filter((question) => Array.isArray(question.options) && question.options.length > 0)
      .map((question) => [question.id, question.options[0]])
  );
}

export async function runPipelineSmoke(baseUrl, rawQuestion, fetchImpl = fetch) {
  const base = baseUrl.replace(/\/$/, "");
  const analyze = await postJson(fetchImpl, `${base}/api/question/analyze`, { rawQuestion });
  const clarificationAnswers = buildClarificationAnswers(analyze);
  const retrieval = await postJson(fetchImpl, `${base}/api/question/retrieve`, {
    rawQuestion,
    analysis: analyze,
    clarificationAnswers
  });
  const compile = await postJson(fetchImpl, `${base}/api/question/compile`, {
    rawQuestion,
    analysis: analyze,
    clarificationAnswers,
    retrieval
  });
  return { analyze, clarificationAnswers, retrieval, compile };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const baseUrl = process.env.SMOKE_BASE_URL;
  const rawQuestion = process.argv.slice(2).join(" ").trim();
  if (!baseUrl || rawQuestion.length < 5) {
    console.error("Usage: SMOKE_BASE_URL=https://your-project.vercel.app pnpm smoke:production -- \"现在转码还有前途吗？\"");
    process.exit(2);
  }

  try {
    const result = await runPipelineSmoke(baseUrl, rawQuestion);
    console.log(JSON.stringify({
      question: rawQuestion,
      clarificationCount: result.analyze.clarificationQuestions?.length ?? 0,
      retrievalStatus: result.retrieval.status,
      evidenceCount: result.retrieval.evidence?.length ?? 0,
      compiledTitle: result.compile.compiledQuestion?.title,
      evidenceUsed: result.compile.evidenceUsed
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Production smoke failed");
    process.exit(1);
  }
}
```

- [ ] **Step 4: Add root scripts**

Modify root `package.json` scripts to include:

```json
{
  "smoke:test": "node --test scripts/smoke/pipeline.test.mjs",
  "smoke:production": "node scripts/smoke/pipeline.mjs"
}
```

Keep the existing `dev`, `build`, `test`, and `typecheck` scripts unchanged.

- [ ] **Step 5: Run GREEN verification**

Run:

```bash
pnpm smoke:test
pnpm --filter @ask-better/domain test
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web build
```

Expected: all PASS without external credentials and without network calls.

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke package.json
git commit -m "test: add production pipeline smoke harness"
```

---

### Task 2: Create the Vercel Project and Prove a No-Secret Deployment

**Files:**
- No repository file change required if Vercel accepts project settings.
- Do not create `vercel.json` in the happy path.

**Interfaces:**
- Consumes: GitHub repository `wulisususu/sdaa`, branch `main`.
- Produces: one Vercel Production project and a stable `https://*.vercel.app` URL.

- [ ] **Step 1: Use the Vercel project connection**

If the Vercel plugin is connected, use it to import `wulisususu/sdaa`. If it is not connected, stop at this action gate and have the user complete the Vercel connection/import in the product UI; do not ask for a Vercel token in chat.

- [ ] **Step 2: Configure the monorepo project**

Set:

```text
Framework Preset: Next.js
Production Branch: main
Root Directory: apps/web
Build Command: cd ../.. && pnpm turbo build --filter=web
Output Directory: .next
Install Command: pnpm install --no-frozen-lockfile
```

Do not set any application Secret yet.

- [ ] **Step 3: Deploy without Secrets**

Expected result:

- Build succeeds.
- Public homepage returns HTTP 200.
- Static/client JS loads.
- No runtime success claim is made for DeepSeek or Zhihu yet.

- [ ] **Step 4: Verify safe failure for Analyze before Secret setup**

PowerShell:

```powershell
$base = "https://YOUR-PROJECT.vercel.app"
$body = @{ rawQuestion = "现在转码还有前途吗？" } | ConvertTo-Json
try {
  Invoke-RestMethod -Uri "$base/api/question/analyze" -Method Post -ContentType "application/json" -Body $body
  throw "Expected analyze to fail before LLM configuration"
} catch {
  $_.ErrorDetails.Message
}
```

Expected response body contains `AI_NOT_CONFIGURED`; it must not expose environment values, stack traces, or provider credentials.

- [ ] **Step 5: Record the deployment URL outside Secrets**

Save the URL for later smoke commands. Do not commit it to README until the deployment is stable enough to be the competition experience URL.

---

### Task 3: Configure a Fresh DeepSeek Production Key and Validate `/analyze`

**Files:**
- No file change if existing OpenAI-compatible provider works.
- Potentially modify `apps/web/src/lib/ai/provider.ts` only after a reproduced compatibility failure.

**Interfaces:**
- Consumes Vercel server env:
  - `LLM_BASE_URL=https://api.deepseek.com`
  - `LLM_MODEL=deepseek-v4-flash`
  - `LLM_API_KEY=<fresh production key>`
- Produces a real `QuestionAnalysis` that passes `QuestionAnalysisSchema`.

- [ ] **Step 1: Revoke/stop using the previously exposed key**

Create a fresh DeepSeek production API Key in the DeepSeek account. Do not paste the replacement into ChatGPT, GitHub, terminal screenshots, README, or Vercel build logs.

- [ ] **Step 2: Add only the three LLM variables to Vercel Production**

```text
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
LLM_API_KEY=<fresh secret value>
```

Environment scope: Production. Preview may be added later only if preview testing is needed.

- [ ] **Step 3: Redeploy the same `main` commit**

No code change is required merely to load new environment variables.

- [ ] **Step 4: Smoke `/analyze` with a real request**

PowerShell:

```powershell
$base = "https://YOUR-PROJECT.vercel.app"
$body = @{ rawQuestion = "现在转码还有前途吗？" } | ConvertTo-Json
$analysisResponse = Invoke-RestMethod -Uri "$base/api/question/analyze" -Method Post -ContentType "application/json" -Body $body
$analysisResponse | ConvertTo-Json -Depth 20
```

Expected:

```text
ok = true
data.intent has at least one item
data.primaryGoal is non-empty
data.clarificationQuestions has at most 4 items
if ambiguities or missingContext is non-empty, clarificationQuestions has 2-4 items
```

- [ ] **Step 5: Compatibility gate**

If `/analyze` returns a valid schema repeatedly, do **not** add DeepSeek-specific code.

If it fails, capture only the safe error code/status and Vercel server error category. Do not paste or log the API Key. Classify the failure before editing code:

```text
401/403 provider auth failure -> fix Secret/account, no code change
404/model-not-found -> verify model/base URL, no schema code change
AI_TIMEOUT -> measure latency first
AI_INVALID_OUTPUT / provider structured-output incompatibility -> stop and enter systematic debugging before changing provider.ts
```

This gate intentionally prevents speculative vendor-specific adapters.

---

### Task 4: Configure Zhihu Access Secret and Validate Real Evidence

**Files:**
- No repository file change expected in the happy path.

**Interfaces:**
- Consumes Vercel server env:
  - `ZHIHU_API_BASE_URL=https://developer.zhihu.com`
  - `ZHIHU_ACCESS_SECRET=<server-only>`
- Produces `RetrieveResult` whose Evidence items have `source: "zhihu"` and real URLs.

- [ ] **Step 1: Add Zhihu variables to Vercel Production**

```text
ZHIHU_API_BASE_URL=https://developer.zhihu.com
ZHIHU_ACCESS_SECRET=<server-only secret value>
```

Do not enable OAuth variables.

- [ ] **Step 2: Redeploy with the new server environment**

Use the same production branch and project.

- [ ] **Step 3: Generate a valid Analyze payload and clarification answers**

PowerShell:

```powershell
$base = "https://YOUR-PROJECT.vercel.app"
$raw = "现在转码还有前途吗？"
$analysisResponse = Invoke-RestMethod -Uri "$base/api/question/analyze" -Method Post -ContentType "application/json" -Body (@{ rawQuestion = $raw } | ConvertTo-Json)
$analysis = $analysisResponse.data
$answers = @{}
foreach ($q in $analysis.clarificationQuestions) {
  if ($q.options.Count -gt 0) {
    $answers[$q.id] = $q.options[0]
  }
}
```

- [ ] **Step 4: Call real Retrieve**

```powershell
$retrieveBody = @{
  rawQuestion = $raw
  analysis = $analysis
  clarificationAnswers = $answers
} | ConvertTo-Json -Depth 30

$retrieveResponse = Invoke-RestMethod -Uri "$base/api/question/retrieve" -Method Post -ContentType "application/json" -Body $retrieveBody
$retrieveResponse | ConvertTo-Json -Depth 30
```

Expected:

- `ok = true`.
- `data.status` is one of `success`, `partial`, `quota_limited`, `unavailable`.
- If `data.evidence.Count > 0`, every item has `source = "zhihu"`, a non-empty title, and an HTTPS URL.
- No fake/demo Evidence appears when upstream is unavailable.
- `quota_limited` preserves already-fetched Evidence.

- [ ] **Step 5: Verify at least one real source for Golden Case A or C**

If Case A produces zero Evidence, repeat with:

```text
AI 应用开发应该怎么学？
```

A Golden Demo is not considered ready until at least one of the designated demo cases returns clickable real Zhihu Evidence.

---

### Task 5: Validate `/compile` and Run the Automated Production Smoke Harness

**Files:**
- Uses `scripts/smoke/pipeline.mjs` from Task 1.

**Interfaces:**
- Consumes valid Analyze + Retrieve outputs.
- Produces a schema-valid `CompileResult` and a one-command public pipeline smoke.

- [ ] **Step 1: Call Compile manually once**

PowerShell, continuing Task 4 variables:

```powershell
$compileBody = @{
  rawQuestion = $raw
  analysis = $analysis
  clarificationAnswers = $answers
  retrieval = $retrieveResponse.data
} | ConvertTo-Json -Depth 40

$compileResponse = Invoke-RestMethod -Uri "$base/api/question/compile" -Method Post -ContentType "application/json" -Body $compileBody
$compileResponse | ConvertTo-Json -Depth 30
```

Expected:

- `ok = true`.
- `data.compiledQuestion.title` is non-empty.
- `background`, `goal`, and `coreUncertainty` are non-empty.
- `expectedAnswer` contains at least one item.
- `evidenceUsed = true` only when Retrieve actually supplied Evidence.

- [ ] **Step 2: Run the repository smoke harness against Production**

PowerShell:

```powershell
$env:SMOKE_BASE_URL = "https://YOUR-PROJECT.vercel.app"
pnpm smoke:production -- "现在转码还有前途吗？"
```

Expected exit code: `0`.

Expected console output contains only non-secret summary fields:

```text
question
clarificationCount
retrievalStatus
evidenceCount
compiledTitle
evidenceUsed
```

- [ ] **Step 3: Run two additional public smoke cases**

```powershell
pnpm smoke:production -- "考研还是直接就业？"
pnpm smoke:production -- "AI 应用开发应该怎么学？"
```

Transport/contract requirement: all three commands exit `0` unless the service is in an explicitly accepted degraded state that blocks compile; quality review happens in Task 6.

---

### Task 6: Browser Golden Demo QA and Secret-leak Audit

**Files:**
- No required repository change.

**Interfaces:**
- Consumes the deployed browser UI and production APIs.
- Produces a pass/fail checklist for the competition Golden Demo.

- [ ] **Step 1: Run Case A manually in the browser**

Question:

```text
现在转码还有前途吗？
```

Verify:

```text
Analyze identifies broad/ambiguous scope
2-4 clarification questions appear when clarification is needed
Changing clarification answers invalidates old downstream results
Retrieve displays only real Zhihu Evidence
Coverage/Gap wording stays bounded to retrieved Evidence
Compile produces a materially more specific question
Copy action works
```

- [ ] **Step 2: Run Case B manually**

Question:

```text
考研还是直接就业？
```

Verify the compiled result does **not** invent school, major, city, family finances, exam score, or employment history unless the user explicitly supplied them.

- [ ] **Step 3: Run Case C manually**

Question:

```text
AI 应用开发应该怎么学？
```

Verify at least one real Zhihu source is clickable when Evidence exists and the final result is a Question Package, not an answer article.

- [ ] **Step 4: Inspect browser Network responses**

Inspect `/api/question/analyze`, `/retrieve`, and `/compile` response bodies.

Must not contain:

```text
DeepSeek API Key value
Zhihu Access Secret value
UPSTASH_REDIS_REST_TOKEN value
server stack trace
process.env dump
```

- [ ] **Step 5: Inspect client assets for obvious secret leakage**

Use browser DevTools Sources search for the **actual production secret values** without printing or sharing them. If any value is found in `_next/static` client assets, stop the release immediately.

- [ ] **Step 6: Verify public-source links**

Open at least two Evidence URLs in new tabs and confirm they resolve to real Zhihu content rather than fabricated or local URLs.

---

### Task 7: Production Documentation, CI, and Release Gate

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes the stable Production URL and verified Golden Demo behavior.
- Produces a documented competition experience URL with no Secret disclosure.

- [ ] **Step 1: Update README only after the Production URL is stable**

Add a section structurally equivalent to:

```md
## 公网体验

Production: `https://<stable-project>.vercel.app`

当前比赛 P0 使用：

- DeepSeek `deepseek-v4-flash`
- 知乎官方开放平台 Search API
- Vercel Next.js Web/API

生产 Secret 只配置在 Vercel Environment Variables，不进入仓库。

### Production Smoke

```powershell
$env:SMOKE_BASE_URL = "https://<stable-project>.vercel.app"
pnpm smoke:production -- "现在转码还有前途吗？"
```
```

Do not document any real key/token value.

- [ ] **Step 2: Run the full repository verification**

```bash
pnpm install --no-frozen-lockfile
pnpm smoke:test
pnpm --filter @ask-better/domain test
pnpm --filter @ask-better/domain typecheck
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web build
```

Expected: all PASS with no real provider credentials required.

- [ ] **Step 3: Commit documentation/readiness changes**

```bash
git add README.md scripts/smoke package.json
git commit -m "docs: document production Golden Demo deployment"
```

- [ ] **Step 4: Wait for `main` GitHub Actions**

Required conclusion: `success` for:

```text
Domain tests
Domain typecheck
Web tests
Web typecheck
Next build
```

- [ ] **Step 5: Verify Vercel Production deploys the same `main` SHA**

The Production deployment commit SHA must match the GitHub `main` commit being declared ready.

- [ ] **Step 6: Run the final three Golden cases again after the final deployment**

```powershell
$env:SMOKE_BASE_URL = "https://<stable-project>.vercel.app"
pnpm smoke:production -- "现在转码还有前途吗？"
pnpm smoke:production -- "考研还是直接就业？"
pnpm smoke:production -- "AI 应用开发应该怎么学？"
```

Then repeat the three browser flows once. No earlier Preview deployment counts as the final release verification.

---

## Operational Failure Matrix

| Failure | Immediate action | Code change allowed? |
|---|---|---|
| Vercel build cannot resolve workspace package | Recheck Root Directory and `cd ../.. && pnpm turbo build --filter=web` | Only after project settings are proven insufficient |
| `/analyze` = `AI_NOT_CONFIGURED` after env setup | Verify Vercel environment scope and redeploy | No |
| DeepSeek 401/403 | Rotate/verify DeepSeek Secret and account status | No |
| DeepSeek model/base URL error | Verify `deepseek-v4-flash` and `https://api.deepseek.com` | No |
| `AI_INVALID_OUTPUT` reproducible only on DeepSeek | Invoke systematic-debugging; inspect provider request/response shape | Maybe, after root cause |
| Zhihu `ZHIHU_UNAUTHORIZED` | Verify Access Secret | No |
| Zhihu `quota_limited` | Keep collected Evidence; wait for quota/frequency window or enable cache | No |
| Redis absent | Continue with Memory Cache | No |
| Browser shows Mock/fake success | Release blocker; remove fallback before proceeding | Yes |
| Secret appears in client response/assets | Release blocker; stop deployment and rotate exposed Secret | Yes |

---

## Spec Coverage Self-Review

- Public HTTPS Vercel deployment: Task 2.
- `main` as production branch: Task 2 and Task 7.
- DeepSeek `deepseek-v4-flash`: Task 3.
- Fresh, non-exposed production DeepSeek key: Task 3.
- Provider-neutral first attempt / vendor code only after reproduced incompatibility: Task 3 compatibility gate.
- Official Zhihu Search and real Evidence: Task 4.
- Memory Cache permitted; Upstash not required: Global Constraints and failure matrix.
- Analyze → Retrieve → Compile real server validation: Tasks 3–5.
- Browser Golden Path and three required cases: Task 6 and Task 7.
- Secret isolation and audit: Task 6.
- No Mock success fallback: Tasks 4 and 6.
- CI remains credential-free: Task 1 and Task 7.
- Final production SHA/CI verification: Task 7.
- OAuth, Android, custom domain, visual template remain out of scope: Global Constraints.

## Placeholder Scan

This plan intentionally contains placeholders only for values that cannot safely be committed (`<fresh secret value>`) or do not exist until deployment (`https://YOUR-PROJECT.vercel.app`). They are runtime operator inputs, not unfinished implementation details. No code step contains an unresolved function, schema, filename, or behavioral requirement.
