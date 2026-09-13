# Publishable Question Layer — Implementation Plan

Date: 2026-09-13
Branch: `feat/publishable-question-layer`
Base: `main@527f79182a660bfc1fad1cee7af328408fae2b04`

## Task 1 — Domain contract (TDD)

Files:
- `packages/domain/src/pipeline.ts`
- `packages/domain/src/question.ts`
- `packages/domain/src/compiled.ts`
- domain tests

Steps:
1. Add failing tests for `PublishableQuestionSchema`, additive `CompileResultSchema.publishableQuestion`, max 4 publishable subquestions, and `expectedAnswer` max 4.
2. Implement the schema/types.
3. Add `formatPublishableQuestion()` and tests proving clipboard text contains only human-facing title/context/questions and no IR labels.

## Task 2 — Slim typed compile context

Files:
- `apps/web/src/lib/ai/prompts/compile.ts`
- `apps/web/src/lib/question/compile-service.ts`
- tests

Steps:
1. Add tests asserting compile prompt includes raw question + explicit answers + intent/goal + coverage/gaps + compact evidence refs.
2. Assert it does not include analysis `missingContext`, diagnostics, clarification questions, full evidence summaries/comments, or unrelated retrieval payload fields.
3. Add explicit untrusted-data delimiters.

## Task 3 — Generate IR + Publishable artifact

Files:
- `packages/domain/src/pipeline.ts`
- `apps/web/src/lib/ai/prompts/compile.ts`
- `apps/web/src/lib/question/compile-service.ts`
- tests

Steps:
1. Define a structured compile output containing both `compiledQuestion` and `publishableQuestion`.
2. Update prompt rules: natural Chinese, unknown -> omit, 2–3 target questions, max 4, no adjacent-topic expansion, evidence only narrows/differentiates.
3. Keep API endpoint path unchanged and evolve response additively.

## Task 4 — Publication Quality Guard (TDD)

New file:
- `apps/web/src/lib/question/publication-quality.ts`
- tests

Checks:
1. forbidden meta voice
2. numeric constraint fidelity for recognized unit-bearing numbers
3. duplicate publishable questions
4. scope limits

Add regression cases:
- `每天最多 3 小时` must reject output introducing `5 小时`.
- living-expense case must reject `用户未提供性别`-style meta copy.

## Task 5 — One-shot repair path

Files:
- `apps/web/src/lib/question/compile-service.ts`
- `apps/web/src/lib/ai/prompts/compile.ts`
- tests

Behavior:
- first generation passes -> one LLM call
- quality violations -> exactly one repair call with violations
- second failure -> `COMPILE_FAILED`

## Task 6 — Result UI + clipboard

Files:
- `apps/web/src/components/compiled-question-panel.tsx`
- `apps/web/src/components/result-stage.tsx`
- `apps/web/src/components/compiler-demo.tsx`
- `apps/web/src/app/globals.css`
- UI tests

Behavior:
- publishable version is primary
- IR is collapsed secondary details
- main CTA says `复制知乎版问题`
- clipboard uses `formatPublishableQuestion()`
- `打开知乎提问页` and `重新优化` semantics unchanged

## Task 7 — Regression and release gate

Required verification:

```bash
pnpm smoke:test
pnpm --filter @ask-better/domain test
pnpm --filter @ask-better/domain typecheck
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web build
```

Golden cases:
1. `现在转码还有前途吗？`
2. `考研还是直接就业？`
3. `AI 应用开发应该怎么学？`
4. living-expense publishability case
5. numeric constraint fidelity case (`3 小时` must not become `5 小时`)

Release gate:
- no API route changes
- no Zhihu retrieval regressions
- no secret exposure
- CI green
- PR reviewable and mergeable
