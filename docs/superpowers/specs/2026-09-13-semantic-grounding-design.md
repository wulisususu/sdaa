# Publishable Semantic Grounding — Design

> Status: Proposed / pre-implementation
> Date: 2026-09-13
> Baseline: `4773a82a4777b7210a51377ab62bd96885a7c4b3`
> Branch: `fix/publishable-grounding`
> Scope: P0 语义边界（Adjacent Scope / Unsupported Fact / Mechanism Inference）+ P1 知乎 CTA 死链

## 1. 背景：三个生产发现

P1.1 生产验收在真实链路上发现三个问题。前两个是同一个根因的两种表现：**编译器只能证明「用户说了什么」，却无法证明「发布稿没有多说」。**

| # | 发现 | 证据 | 优先级 |
|---|---|---|---|
| 1 | Adjacent Scope 越界 | 同一道生活费问题两次运行，其中一次生成子问题「开学第一个月因为办卡、添置日用品等支出，需要比之后多给吗」 | P0 |
| 2 | Unsupported Fact / Mechanism Inference | 把澄清答案「家长另外给，不算在这笔钱里」扩写成「通讯已有家庭共享套餐」 | P0 |
| 3 | 知乎 CTA 死链 | `https://www.zhihu.com/question/ask` 在真实浏览器渲染知乎 404 页（标题 `404 - 知乎`） | P1 |

现有 `publication-quality.ts`（Deterministic Publication Guard）只做**可机械判定**的检查：禁用元话语字符串、数字事实漂移、子问题数量 > 4、子问题重复。它**无法**判定语义层面的「多说了一件事」——发现 1 和 2 都属于这一类，因此需要一层新的语义审计。

## 2. 目标与非目标

### 目标

1. 新增 **Semantic Grounding Audit**，四种违规码：`UNSUPPORTED_FACT`、`MECHANISM_INFERENCE`、`ADJACENT_SCOPE`、`INTENT_DRIFT`。
2. 审计失败时执行 **One-shot Repair**，修复后重新过 Deterministic Guard 与 Semantic Re-audit；仍不合格则返回 `COMPILE_FAILED`。
3. LLM 调用预算受控：正常路径 2 次，修复路径最多 4 次，**不存在无限 repair**。
4. CTA 改为不依赖未验证 deep link 的安全形态。
5. 数字保真（Numeric Fidelity）与元话语（Meta Voice）两类现有守卫**保持原样继续生效**。

### 非目标

- 不修改 API Contract：`publishableQuestion` 结构、`CompileResult` 结构、错误码枚举全部不变。
- 不修改 `provider.ts`（未复现 provider 级兼容问题）。
- 不引入「官方发布 API」「一键发布」「已发布」等能力表述。
- 不猜测任何未文档化的知乎提问路由。
- 不改动 Analyze / Retrieve / Coverage 的行为。

## 3. Semantic Auditor 设计

### 3.1 输入面（严格收窄）

审计器**只能**看到：

```ts
interface SemanticAuditInput {
  rawQuestion: string;
  answeredClarifications: Array<{ question: string; answer: string }>;
  coreUncertainty: string;                 // compiledQuestion.coreUncertainty
  knowledgeGaps: Array<{ id: string; title: string; detail: string }>;
  publishableQuestion: {
    title: string;
    context: string;
    questions: string[];
  };
}
```

**刻意不传入**（硬约束，由测试断言）：

- `missingContext`（缺失字段本身就是「编译器认为缺什么」，会诱导审计器认可推断）
- `diagnostics` / Question Lint（同上）
- **未回答**的 clarification（审计器必须只把「用户真正回答过的」当作用户事实）
- 完整 Evidence `summary`、`selectedComments`、`author` 等（与语义边界判定无关，且会把审计器引向「知乎上有什么」而不是「用户说了什么」）

`knowledgeGaps` 只用于判定子问题是否服务于对 `coreUncertainty` 有**直接收窄作用**的缺口，因此只传 `id/title/detail`。

### 3.2 输出 Schema

```ts
const SemanticViolationCode = z.enum([
  "UNSUPPORTED_FACT",
  "MECHANISM_INFERENCE",
  "ADJACENT_SCOPE",
  "INTENT_DRIFT"
]);

const SemanticViolationTarget = z.enum(["title", "context", "question"]);

const SemanticViolation = z.object({
  code: SemanticViolationCode,
  target: SemanticViolationTarget,
  questionIndex: z.number().int().min(0).max(3).optional(),
  excerpt: z.string().trim().min(1),
  reason: z.string().trim().min(1)
});

const SemanticAuditSchema = z
  .object({
    passed: z.boolean(),
    violations: z.array(SemanticViolation).max(8)
  })
  .superRefine((value, ctx) => {
    if (value.passed && value.violations.length > 0) ctx.addIssue(...);
    if (!value.passed && value.violations.length === 0) ctx.addIssue(...);
  });
```

`passed=true` 时 `violations` 必须为空；`passed=false` 时必须至少有一条违规。两种不一致组合视为 **malformed output → 安全失败**（`COMPILE_FAILED`），不得放行、不得回退 Mock。

### 3.3 四种违规码的语义定义

| Code | 定义 | 判定示例 |
|---|---|---|
| `UNSUPPORTED_FACT` | 发布稿出现了用户事实，但该事实不在 `rawQuestion` 或**已回答**澄清中 | 用户没说孩子性别，发布稿写「儿子」 |
| `MECHANISM_INFERENCE` | 用户给出的是**结果型**信息，发布稿把结果改写成了具体机制 | 「通讯费另外给」→「已有家庭共享套餐」「父母给办了无限流量卡」「学校送校园卡」 |
| `ADJACENT_SCOPE` | 子问题本身合理、有帮助，但不服务于 `coreUncertainty`，也未收窄任何对核心困惑有直接作用的 `knowledgeGap` | 核心困惑是「基础生活费给多少」，却问「开学第一个月要不要多给」 |
| `INTENT_DRIFT` | 发布稿偏离 `coreUncertainty`，答主读完无法回答用户真正想知道的事 | 核心困惑是「该给多少」，发布稿变成「怎么培养孩子理财」 |

`ADJACENT_SCOPE` 与 `INTENT_DRIFT` 的分界：前者针对**单条子问题**越出范围（`target="question"` + `questionIndex`），后者针对**整体**方向偏离（`target="title" | "context"`）。

### 3.4 语义规则（写入审计 Prompt 的硬规则）

1. 用户事实只能来自 `rawQuestion` + 用户**真正回答过**的澄清；审计器不得调用外部常识补全。
2. 不得把结果型事实扩写成具体机制。允许「通讯费用不计入这笔生活费」「通讯费用另行承担」；禁止「已有家庭共享套餐」「父母给办了无限流量卡」「学校送校园卡」。
3. 每条 `publishableQuestion.questions` 必须**直接**服务 `coreUncertainty`，或直接收窄一条对 `coreUncertainty` 有直接作用的 `knowledgeGap`。「合理、有帮助」本身不足以加入。
4. 相邻但未被询问的话题一律判 `ADJACENT_SCOPE`，典型清单：开学首月加钱、第一学期回调、月初还是分周给、如何培养理财习惯、寒暑假怎么给、消费观教育。
5. 宁可漏判也不要把合规内容判成违规：`excerpt` 必须逐字摘自发布稿，`reason` 必须指向具体规则。

## 4. Compile 流程改造

```
compileQuestion
  │
  ├─ 1. Compile Generation            (LLM #1)
  │
  ├─ 2. Deterministic Publication Guard   ← 纯函数，无 LLM
  │        │
  │        ├─ 有违规 ──────────────┐
  │        └─ 无违规               │
  │             ↓                  │
  │        3. Semantic Grounding Audit (LLM #2)
  │             │                  │
  │             ├─ PASS → 返回      │
  │             └─ FAIL ───────────┤
  │                                ↓
  ├─ 4. One-shot Repair               (LLM #3)
  │
  ├─ 5. Deterministic Guard 再校验
  │
  ├─ 6. Semantic Re-audit             (LLM #4)
  │        │
  │        ├─ PASS 且 Guard 无违规 → 返回
  │        └─ 任一 FAIL → COMPILE_FAILED（不再 repair）
```

**LLM 调用预算**

| 路径 | 调用次数 |
|---|---|
| 正常（Guard + Audit 均 PASS） | 2 |
| Guard 直接失败（跳过审计，直接 repair） | 3 |
| Audit 失败 → repair → 再审计 | 4 |
| repair 后仍失败 | 4，然后 `COMPILE_FAILED` |

Deterministic Guard 失败时**跳过** Auditing：此时必然要 repair，多跑一次审计只会浪费额度，且不改变结论。该优化使最坏路径不超过 4 次。

**错误映射**：`COMPILE_FAILED`（可重试），与 `AI_TIMEOUT` / `AI_INVALID_OUTPUT` 语义区分——后者是 provider 层失败，前者是「模型产出了，但没通过发布质量门」。

## 5. 知乎 CTA 改造

现状：`window.open("https://www.zhihu.com/question/ask")`，生产实测为 404 页。

设计原则：**没有官方通用发布 API，也没有已验证稳定的 Web 提问 deep link，因此不得暗示任何「发布」能力。**

| 项 | 现状 | 改为 |
|---|---|---|
| 主 CTA | `复制知乎版问题` | **保持不变** |
| 次 CTA 文案 | `打开知乎提问页 ↗` | **`前往知乎`** |
| 次 CTA 目标 | `https://www.zhihu.com/question/ask` | **`https://www.zhihu.com/`** |
| 辅助提示 | 无 | 新增 **`复制后前往知乎发起提问`** |

按钮附近**禁止**出现：`一键发布`、`直接发布`、`已发布`、`打开知乎提问页`。

## 6. 测试矩阵（先 RED 后 GREEN）

| # | 用例 | 断言 |
|---|---|---|
| 1 | 通讯另付 → 不得变家庭共享套餐 | 违规列表含 `MECHANISM_INFERENCE`；repair 后通过 |
| 2 | 基础生活费 → 「开学第一个月」 | `ADJACENT_SCOPE` |
| 3 | 合法价格区间问题 | 通过 |
| 4 | 合理预算拆分问题 | 通过 |
| 5 | Numeric Fidelity | 3 小时不漂移为 5 小时 |
| 6 | Meta Voice | 仍拦截「用户未提供」等表达 |
| 7 | 首次 Audit FAIL | 触发 repair，且 repair prompt 含违规说明 |
| 8 | repair 后 Audit PASS | 正常返回 |
| 9 | repair 后仍 FAIL | `COMPILE_FAILED` |
| 10 | Audit 输出 malformed | 安全失败 `COMPILE_FAILED`，不放行 |
| 11 | 无限循环防护 | LLM 调用次数 ≤ 4 |
| 12 | CTA | 组件与源码中不再出现 `/question/ask`；文案为「前往知乎」+「复制后前往知乎发起提问」 |

审计器输入面的收窄由独立测试断言：prompt 中不得出现 `missingContext` / `diagnostics` / 未回答澄清 / Evidence summary / 评论 / 作者等标记。

## 7. 风险与取舍

| 风险 | 说明 | 处置 |
|---|---|---|
| 审计器误判（假阳性） | 合规内容被判违规 → 触发 repair，最坏 `COMPILE_FAILED` | Prompt 明确「宁可漏判」；单一用例测试覆盖合法问题必须 PASS |
| 审计器漏判（假阴性） | 越界内容被放行 | 接受：LLM 审计不是形式化证明，作为 Deterministic Guard 的语义补充，不宣称完备 |
| 成本上升 | 正常路径 +1 次 LLM | 预算显式封顶 2/4，并在报告中说明 |
| 延迟上升 | 正常路径多一次审计调用 | 现有 45s 超时与 Nginx 300s 预留可覆盖 |
| 审计器与编译器同源偏见 | 审计用同一模型 | 接受；审计输入面刻意收窄，减少共谋空间 |

## 8. 交付边界

本分支只做上述改动；**不部署生产**，先以 PR 形式提交 diff、RED/GREEN 证据、CI 结果与审计器设计供审查。
