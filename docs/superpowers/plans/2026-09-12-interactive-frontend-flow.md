# Interactive Frontend Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing responsive frontend skeleton into a complete, clickable mock Question Compiler flow from raw question to compiled result.

**Architecture:** Keep `apps/web` as the Web-first client and move navigation/selection invariants into `packages/domain` so the same behavior can be reused by the future Expo client. The Web controller owns transient UI state (raw question, clarification selections, current/max visited stage, copy feedback); stage components remain presentational. No real AI, Zhihu API, OAuth, Redis, or publishing is connected in this phase.

**Tech Stack:** TypeScript, React 19, Next.js App Router, Tailwind CSS, pnpm/Turborepo, Vitest.

**Spec:** `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/FRONTEND_SPEC.md`

## Global Constraints

- Chinese is always the primary user-facing language; English may appear only as a small secondary label.
- Main visible flow is exactly: 输入问题 → 补充信息 → 问题体检 → 已有讨论 → 编译结果.
- Users may move backward freely but cannot jump forward beyond the furthest completed stage.
- Raw question must contain at least 5 non-whitespace characters before leaving the input stage.
- Clarification uses single-choice answers in this mock phase; answers persist when navigating backward.
- `重新优化` returns to 补充信息 while preserving the current raw question and selected answers.
- `新建问题` clears raw question, selections, copy status, and returns to 输入问题.
- `复制问题` copies the complete compiled question package, not only its title.
- `去知乎提问` opens Zhihu's ask page in a new tab; it does not claim to publish on the user's behalf.
- No visual-template polish in this phase; keep styling replaceable through existing classes/design tokens.
- Total Git branches must stay at or below five; merge and remove temporary feature branches.

---

### Task 1: Shared session navigation rules

**Files:**
- Create: `packages/domain/src/session.test.ts`
- Create: `packages/domain/src/session.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces `getStageIndex(stage)`, `getPreviousStage(stage)`, `canVisitStage(target, maxVisited)`, and `isRawQuestionReady(rawQuestion)`.

- [ ] Write tests asserting the input validity threshold, previous-stage behavior, and that a user cannot jump beyond `maxVisited`.
- [ ] Run `pnpm --filter @ask-better/domain test` and verify RED because `./session` does not exist.
- [ ] Implement the four helpers with no React dependency.
- [ ] Re-run domain tests and verify GREEN.

### Task 2: Clarification answer model

**Files:**
- Modify: `packages/domain/src/session.test.ts`
- Modify: `packages/domain/src/session.ts`

**Interfaces:**
- Produces `ClarificationAnswers`, `setClarificationAnswer(answers, questionId, option)`, and `countAnsweredClarifications(questions, answers)`.

- [ ] Add failing tests proving selections overwrite per question, do not mutate the previous object, and answered-count only includes known question IDs.
- [ ] Run domain tests and verify RED.
- [ ] Implement immutable answer helpers.
- [ ] Re-run domain tests and verify GREEN.

### Task 3: Stage-specific Web flow

**Files:**
- Modify: `apps/web/src/components/compiler-demo.tsx`
- Create: `apps/web/src/components/input-stage.tsx`
- Create: `apps/web/src/components/clarification-stage.tsx`
- Create: `apps/web/src/components/diagnosis-stage.tsx`
- Create: `apps/web/src/components/coverage-stage.tsx`
- Create: `apps/web/src/components/result-stage.tsx`
- Modify: `apps/web/src/components/stage-stepper.tsx`

**Interfaces:**
- `CompilerDemo` becomes the single flow controller.
- Stage components consume explicit props and do not own cross-stage business state.

- [ ] Wire current/max-visited stage state and enforce `canVisitStage`.
- [ ] Implement input validation and the primary `开始整理问题` action.
- [ ] Implement clarification option selection with visible selected state and progress count.
- [ ] Implement diagnosis and coverage continuation actions.
- [ ] Implement result actions: copy, re-optimize, new question, open Zhihu.

### Task 4: Responsive parity

**Files:**
- Modify: `apps/web/src/components/mobile-question-flow.tsx` or replace its usage with the same stage components.
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- The same controller/state drives both desktop and mobile.
- Desktop >= 1024px may use wider layouts; mobile remains single-column and Android-reference friendly.

- [ ] Ensure all five stages are usable at 390px width without desktop-only controls.
- [ ] Ensure stage names remain Chinese-first with optional small English subtitles.
- [ ] Keep primary actions pure Chinese.

### Task 5: Verification and docs

**Files:**
- Modify: `README.md`

- [ ] Run `pnpm --filter @ask-better/domain test`.
- [ ] Run `pnpm --filter web build`.
- [ ] Confirm GitHub Actions passes on the feature branch.
- [ ] Document that this checkpoint is interactive mock data and list the next integration boundary: AI Analyze/Clarify/Compile + Zhihu Search/Coverage.
