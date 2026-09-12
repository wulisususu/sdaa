# Competition Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the validated P0 Web Question Compiler into a competition-ready Light Technical / Question IDE experience without changing the existing API contracts or real DeepSeek + Zhihu pipeline semantics.

**Architecture:** Preserve the existing `CompilerDemo` state machine and stage components. Implement productization as a presentation-layer refactor: semantic tokens and interaction primitives in CSS, small focused React changes for view state such as evidence expansion, and regression tests for every new interaction rule. No backend contract or domain schema changes are allowed.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS import with project CSS, Vitest, existing `@ask-better/domain` contracts.

**Spec:** `docs/superpowers/specs/2026-09-13-competition-productization-design.md`

## Global Constraints

- Do not change `POST /api/question/analyze`, `/retrieve`, or `/compile` contracts.
- Do not change Domain/Zod schemas, DeepSeek provider behavior, Zhihu official Search behavior, or evidence-bounded semantics.
- Preserve stale-request invalidation, back-navigation safety, clarification invalidation, copy behavior, and re-optimize behavior.
- No mock-success fallback, fake evidence, fake percentages, or timer-driven fake progress.
- Do not add a heavy UI framework.
- Desktop >=1280px; tablet 768–1279px; mobile <768px.
- Mobile touch targets must be >=44px where practical.
- Respect `prefers-reduced-motion`.
- New interaction logic must have focused tests.

---

### Task 1: Semantic visual foundation and interaction primitives

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: existing class names from current stage components.
- Produces: semantic color tokens, button states, card surfaces, focus-visible rules, motion rules, responsive foundations.

- [ ] Replace the current compressed token block with readable semantic tokens while preserving existing aliases where needed for compatibility.
- [ ] Add shared button transitions and explicit `:hover`, `:active`, `:focus-visible`, disabled and loading-compatible states for `.primary-button`, `.secondary-button`, `.ghost-button`, option/example controls and links.
- [ ] Add reduced-motion fallback using `@media (prefers-reduced-motion: reduce)`.
- [ ] Ensure body, surfaces, borders, typography and shadow hierarchy match Light Technical / Question IDE direction.
- [ ] Verify existing class names still resolve so no stage becomes visually unstyled.

### Task 2: Stepper and input-stage polish

**Files:**
- Modify: `apps/web/src/components/stage-stepper.tsx`
- Modify: `apps/web/src/components/input-stage.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: `stage`, `maxVisited`, existing `canVisitStage()` / `getStageIndex()`.
- Produces: distinct active/completed/visited/future states and a stronger first-screen value proposition.

- [ ] Add a `completed` state for steps strictly before the current stage when they are within the visited range.
- [ ] Render a checkmark for completed steps while retaining numerical labels for active/future steps.
- [ ] Add a compact trust line under the input CTA: real AI + Zhihu Search, no automatic publishing.
- [ ] Keep example chips fill-only and preserve input validation semantics.
- [ ] Style the first screen as the product entry point, not a generic form.

### Task 3: Clarification and diagnostics interaction polish

**Files:**
- Modify: `apps/web/src/components/clarification-stage.tsx`
- Modify: `apps/web/src/components/diagnosis-stage.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: existing answer map and diagnostic levels.
- Produces: clear selected/completed question states and scannable lint cards.

- [ ] Give each clarification card answered/unanswered visual state using existing answer data.
- [ ] Add an explicit check indicator to selected options so selection is not color-only.
- [ ] Preserve `aria-pressed` and current answer semantics.
- [ ] Render diagnostic severity as a text label in addition to tonal color.
- [ ] Keep wording non-alarmist: natural-language issues are findings, not compiler errors.

### Task 4: Evidence progressive disclosure

**Files:**
- Modify: `apps/web/src/components/knowledge-coverage.tsx`
- Create: `apps/web/src/components/knowledge-coverage.test.ts`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: `KnowledgeCoverageItem[]`, `SearchEvidenceItem[]`.
- Produces: exported pure helper `getVisibleEvidence<T>(items: T[], expanded: boolean, initialCount?: number): T[]` and UI expansion state.

- [ ] Write a failing test proving collapsed evidence returns the first 5 items, expanded returns all items, and <=5 items require no truncation.
- [ ] Implement `getVisibleEvidence` with default `initialCount = 5`.
- [ ] Add local `expanded` state to `KnowledgeCoverage` without new network calls.
- [ ] Show evidence count in the source heading.
- [ ] When more than five items exist, render `查看全部 N 条参考来源` / `收起参考来源` toggle with `aria-expanded`.
- [ ] Preserve every existing Evidence link, author, upvote, comment and summary when expanded.

### Task 5: Result-stage competition moment

**Files:**
- Modify: `apps/web/src/components/result-stage.tsx`
- Modify: `apps/web/src/components/compiled-question-panel.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: existing `CompiledQuestion`, `evidenceUsed`, warnings and copy status.
- Produces: visually explicit Before → After narrative and copy-success/error states.

- [ ] Add a visual compile bridge between Before and After without inventing data.
- [ ] Make evidence provenance a compact status treatment.
- [ ] Ensure copy UI clearly represents idle / copied / error using existing `copyStatus` only.
- [ ] Keep `重新优化`, `新建一个问题`, and `打开知乎` semantics unchanged.
- [ ] Make desktop result side-by-side and mobile result vertical.

### Task 6: Responsive and accessibility pass

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify only the relevant stage components if markup is needed for accessibility.

**Interfaces:**
- Produces: Desktop/tablet/mobile layouts with visible focus and readable status semantics.

- [ ] Ensure desktop >=1280px uses generous Question IDE canvas.
- [ ] Ensure tablet 768–1279px avoids squeezed 3-column layouts.
- [ ] Ensure mobile <768px is single-column with sticky primary actions where useful.
- [ ] Verify selectable controls and primary actions have >=44px mobile hit areas.
- [ ] Keep warnings/severity understandable without color.
- [ ] Preserve form labels, `aria-current`, `aria-pressed`, alerts and status roles.

### Task 7: Regression gate and release branch handoff

**Files:**
- Modify tests only if a real regression requires coverage.

**Verification:**

- [ ] Run `pnpm smoke:test`.
- [ ] Run `pnpm --filter @ask-better/domain test`.
- [ ] Run `pnpm --filter @ask-better/domain typecheck`.
- [ ] Run `pnpm --filter web test`.
- [ ] Run `pnpm --filter web typecheck`.
- [ ] Run `pnpm --filter web build`.
- [ ] Inspect the diff for accidental backend/API/domain changes.
- [ ] Open a PR from `feat/competition-productization` to `main` and require green CI before merge.
- [ ] After production deploy, rerun the three Golden Demo questions and visually verify desktop + mobile critical path.
