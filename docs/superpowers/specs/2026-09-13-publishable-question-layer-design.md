# Publishable Question Layer Design

Status: Approved for implementation
Date: 2026-09-13
Scope: Stage 4 Compile + Result + Copy only

## 1. Problem

The current compiler returns a structured `CompiledQuestion` with `title`, `background`, `goal`, `constraints`, `coreUncertainty`, and `expectedAnswer`. That structure is useful as an internal Question IR, but the product currently copies it directly to the clipboard with labels such as “背景 / 目标 / 限制 / 真正困惑 / 希望回答重点”. This makes the final result read like an internal specification rather than a natural Zhihu question.

The product must distinguish:

- **Question IR**: machine-facing structured representation used for reasoning, diagnostics, and explainability.
- **Publishable Question**: human-facing title + natural context + a small number of answerable subquestions.

## 2. Goals

1. Preserve the validated Analyze / Clarify / Retrieve pipeline and Zhihu evidence boundary.
2. Keep `compiledQuestion` as internal Question IR for explainability.
3. Add a separate `publishableQuestion` as the default user-facing final artifact.
4. Ensure clipboard output is directly publishable and does not expose compiler-internal labels.
5. Prevent scope explosion, meta-language, numeric constraint drift, and duplicated subquestions.
6. Keep normal-path latency to one Compile LLM call; allow at most one repair call when deterministic quality checks fail.

## 3. Non-goals

- No changes to Zhihu search behavior or quota semantics.
- No OAuth or automatic publishing.
- No Android implementation in this phase.
- No multi-agent orchestration.
- No removal of the existing Question IR.

## 4. Domain model

Introduce:

```ts
PublishableQuestion = {
  title: string;
  context: string;
  questions: string[];
}
```

Recommended limits:

- `title`: 8–80 chars
- `context`: 20–500 chars
- `questions`: 1–4 items, each 4–120 chars

`CompileResult` becomes additive:

```ts
{
  compiledQuestion: CompiledQuestion; // internal IR
  publishableQuestion: PublishableQuestion; // human-facing final
  evidenceUsed: boolean;
  warnings?: string[];
}
```

Tighten `compiledQuestion.expectedAnswer` to 2–4 items so the IR itself does not become an answer-writing checklist.

## 5. Compile context boundary

The Publication Compiler must not receive the entire analysis/retrieval objects as raw JSON.

It may receive:

- raw question
- explicit clarification answers
- intent + primary goal
- existing coverage
- knowledge gaps
- a compact evidence reference list (`id`, `title`) only

It must not receive `missingContext`, diagnostics, clarification questions, or full 24-item evidence payloads. Unknown user facts are omitted, not narrated as “用户未提供……”.

## 6. Prompt behavior

The compile prompt must generate both:

1. Question IR
2. Publishable Question

Hard rules for the publishable layer:

- Natural Chinese written for a human respondent.
- No “用户是 / 用户希望 / 用户未提供 / 背景 / 目标 / 限制 / 真正困惑 / 希望回答重点” meta-language.
- Knowledge gaps may narrow focus, never expand the question into adjacent management topics the user did not ask for.
- Prefer 2–3 subquestions; never more than 4.
- Every subquestion must directly help answer the single `coreUncertainty`.
- Do not repeat information already obvious from the title unless needed for context.
- Unknown details are omitted rather than listed as unknown.
- Evidence is used to sharpen differentiation, never to create user facts.

All user/evidence content must be delimited as untrusted data and any instruction-like text inside it must not be executed.

## 7. Publication Quality Guard

Add deterministic checks after structured generation:

### Meta voice
Reject publishable output containing compiler-internal phrases such as:

- 用户是
- 用户希望
- 用户没有提供
- 用户未提供
- 背景：
- 目标：
- 限制：
- 真正困惑：
- 希望回答重点：

### Numeric fidelity
Extract explicit numeric facts from `rawQuestion + clarificationAnswers` and from publishable output. If the output introduces a new numeric constraint with a recognized unit (e.g. 小时 / 天 / 周 / 月 / 年 / 元 / 万元 / % / 岁 / 公里) that is not present in user data, flag it.

This guard is conservative: it protects explicit constraints such as “3 小时” from becoming “5 小时”; it does not attempt broad semantic inference.

### Scope
- publishable subquestions <= 4
- IR expectedAnswer <= 4

### Duplication
Reject exact or obvious normalized duplicates among publishable subquestions.

## 8. Repair strategy

Normal path:

`generate -> Zod -> Quality Guard -> return`

Failure path:

`generate -> Zod -> Quality Guard fail -> one repair generation with explicit violations -> Zod -> Quality Guard -> return or COMPILE_FAILED`

No more than one repair call.

## 9. UI

Result becomes two layers:

### Primary: “知乎可发布版本”
Shows:

- title
- natural context
- 1–4 focused questions
- evidence-assisted provenance
- `复制知乎版问题`
- `打开知乎提问页`

### Secondary: “查看编译细节”
Collapsed by default; contains the existing IR:

- background
- goal
- constraints
- core uncertainty
- expected answer dimensions

This preserves the compiler story for judges while keeping the user-facing artifact natural.

## 10. Clipboard

Add `formatPublishableQuestion()` and make the main copy action use it.

The old `formatCompiledQuestion()` remains available for internal/debug/explainability use, but is no longer the default clipboard artifact.

## 11. Acceptance criteria

- Publishable question exists in every successful compile response.
- Clipboard contains no IR labels.
- No “用户未提供……” meta narration in publishable output.
- Publishable questions <= 4, target 2–3.
- IR expectedAnswer <= 4.
- Numeric drift regression (`3 小时` -> `5 小时`) is blocked.
- Existing P0/P1 Golden Demo remains 3/3.
- The university living-expense case produces a natural, directly publishable question.
- Analyze / Retrieve / Zhihu evidence semantics remain unchanged.
