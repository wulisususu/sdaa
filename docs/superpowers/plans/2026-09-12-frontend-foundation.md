# Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first responsive Web frontend foundation for 「问得更好」 in the approved monorepo, with Chinese-first UI and shared contracts for a later Expo Android client.

**Architecture:** pnpm/Turborepo monorepo. `apps/web` is the first runnable client; `packages/domain` contains client-agnostic Question Compiler state/types. Desktop uses a three-column Question IDE; mobile uses a single-column stage workflow. This checkpoint uses mock data only and does not connect Zhihu API, OAuth, Redis, publishing, or LLMs.

**Tech Stack:** TypeScript, Next.js App Router, React, Tailwind CSS, pnpm Workspace, Turborepo, Vitest.

**Spec:** `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/FRONTEND_SPEC.md`

## Global Constraints

- Web First; Android is not implemented in this checkpoint.
- Chinese is the primary UI language; English is only a small secondary label.
- Main visible flow: 输入问题 → 补充信息 → 问题体检 → 已有讨论 → 编译结果.
- No ChatGPT-style conversation UI.
- No real Zhihu/LLM/backend integration yet.
- Mobile Web must be a usable reference for the future Expo Android client.
- Total Git branches must stay at or below five; merge and delete temporary feature branches.

---

### Task 1: Monorepo and shared domain foundation

**Files:** root workspace config; `packages/domain/*`.

**Produces:** `QuestionCompilerStage`, state interfaces, stage labels, `getNextStage(stage)`.

- [ ] Write failing test for stage order: input → clarify → diagnose → coverage → result.
- [ ] Implement minimal domain types and helper.
- [ ] Verify domain tests pass.

### Task 2: Next.js shell

**Files:** `apps/web/package.json`, Next/Tailwind config, `layout.tsx`, `globals.css`, `page.tsx`, header and stage stepper.

- [ ] Add failing test for Chinese stage labels.
- [ ] Implement labels and responsive app shell.
- [ ] Build Web app.

### Task 3: Desktop Question IDE

**Files:** draft, diagnostics, compiled-result panels; mock state.

- [ ] Add invariant test that diagnostics have stable machine codes plus Chinese user-facing titles.
- [ ] Implement desktop three-column layout.
- [ ] Use Chinese-only primary action buttons: `复制问题`, `重新优化`, `去知乎提问`.

### Task 4: Mobile workflow and knowledge coverage

**Files:** mobile flow, coverage, gap components, responsive styles.

- [ ] Add test keeping `existingCoverage` and `knowledgeGaps` as separate collections.
- [ ] Implement single-column mobile workflow below 1024px.
- [ ] Use section names `已有讨论` / `Existing Knowledge` and `还值得继续问什么` / `Knowledge Gap`.

### Task 5: Mock interaction checkpoint

**Files:** client-side demo controller and README.

- [ ] Ensure `getNextStage("result")` remains `result`.
- [ ] Allow editing raw question and switching among five stages using mock data.
- [ ] Verify responsive rendering conceptually at 390px, 768px, and 1440px widths.
- [ ] Document local run commands and state clearly that the checkpoint uses mock data only.

## Verification

Required before merge:

```bash
pnpm --filter @ask-better/domain test
pnpm --filter web build
```

If package installation cannot be executed in the current tool environment, perform syntax validation on all TS/TSX files and report that full dependency build remains pending rather than claiming it passed.
