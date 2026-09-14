# Question Session Persistence & Recent History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ask Better preserve an in-progress question across refreshes and page/tab handoffs, assign every question a stable `conversationId`, autosave clarification progress and downstream stable state, expose recent question history, and let the user continue the latest or any recent question without re-running already completed pipeline stages.

**Architecture:** Replace the current completed-result-only `localStorage` envelope with a local-first Question Session Store. Persist each conversation under its own versioned key and keep a small versioned index containing the active conversation plus up to 20 recent summaries. `CompilerDemo` remains the owner of product state and pipeline transitions; persistence is an adapter around that state, not a new state machine. Transient operations (`analyzing`, `retrieving`, `compiling`) are never persisted, so recovery always lands on the last stable stage.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Zod 4, Vitest 3.2.4, jsdom, browser `localStorage`, existing GSAP scene-transition system.

**Spec:** Extends `docs/superpowers/specs/2026-09-14-p1.3.2-return-safe-handoff-session-recovery-design.md` from completed-result recovery to full stable-stage session persistence and recent-history UX. This plan implements the approved design delta: P0 refresh/page-switch recovery + `conversationId` + autosave; P1 recent history + continue-last-question.

## Baseline

Plan against repository `wulisususu/sdaa`, branch `main`, baseline commit:

```text
374e8f5716171c5be7eb9e2b74115d21e615df0e
Merge P1.3.2 return-safe handoff and recovery
```

Observed current behavior:

- `apps/web/src/components/compiler-demo.tsx` owns `stage`, `rawQuestion`, `answers`, `analysis`, `retrieval`, `compiled`, `operation`, and request-version cancellation in React memory.
- `apps/web/src/lib/completed-session-storage.ts` only saves a fully completed Result (`analysis + retrieval + compiled`) under `ask-better:completed-session:v1`, with a 24-hour TTL.
- `apps/web/src/components/compiler-demo-recovery.test.tsx` only verifies completed-result recovery.
- `StageTransitionViewport` must remain presentation-only; recovery must hydrate `CompilerDemo` and remount the viewport through `sceneResetEpoch` rather than teaching the animation layer about persistence.
- `packages/domain/src/question.ts` defines the five stable stages: `input`, `clarify`, `diagnose`, `coverage`, `result`.
- `packages/domain/src/session.ts` contains pipeline navigation helpers; browser persistence remains a Web concern and must not be moved into the domain package.

## Global Constraints

- Do not add email/password registration, Zhihu OAuth, a database, server-side session storage, cross-device sync, or automatic Zhihu publishing in this plan.
- Do not change Analyze/Retrieve/Compile prompts, API routes, result semantics, evidence semantics, or partial/quota-limited behavior.
- Do not persist `operation`, `error`, `copyStatus`, animation layer state, DOM state, or pending request promises.
- Recovery must never resume a fake loading state. If the browser leaves during Analyze, Retrieve, or Compile, restore the last stable stage and let the user trigger the operation again.
- Keep `requestVersion` cancellation behavior intact.
- Keep the current one-viewport five-scene composition intact. Recent history opens from the header as an overlay/drawer; do not introduce a permanent ChatGPT-style sidebar.
- Use browser `localStorage` only. All storage reads/writes must fail silently and must never block question compilation, copying, or opening Zhihu.
- Store at most 20 recent sessions, ordered by `updatedAt DESC`.
- V2 sessions do not use a time-to-live. Retention is bounded by the 20-session limit. The legacy V1 migration still respects the old 24-hour TTL.
- A draft may contain fewer than five characters. Persistence validation must therefore **not** reuse `AnalyzeRequestSchema.shape.rawQuestion`, because Analyze intentionally requires `min(5)` while local drafts must survive before they are ready to submit.
- Preserve the existing V1 completed result when upgrading. Delete `ask-better:completed-session:v1` only after a successful V2 migration write.
- No new runtime dependencies.
- All new visible labels remain concise Chinese UI copy; no explanatory paragraph is required for persistence.

---

## File Structure

### Create

- `apps/web/src/lib/question-session-storage.ts` — V2 schemas, session/index keys, create/save/load/list/activate/delete-index-entry helpers, stage normalization, V1 migration.
- `apps/web/src/lib/question-session-storage.test.ts` — pure storage and migration tests with an in-memory `Storage` implementation.
- `apps/web/src/lib/use-question-session-persistence.ts` — 250 ms debounced autosave plus `pagehide` / hidden-page synchronous flush.
- `apps/web/src/lib/use-question-session-persistence.test.tsx` — jsdom hook harness for debounce and lifecycle flush behavior.
- `apps/web/src/components/session-history-drawer.tsx` — recent-session overlay with accessible dialog behavior and session selection.
- `apps/web/src/components/session-history-drawer.test.tsx` — drawer rendering, selection, Escape/backdrop close tests.

### Modify

- `apps/web/src/components/compiler-demo.tsx` — own `conversationId`/`createdAt`, bootstrap active session, build persistable snapshots, hydrate exact stable stage, retain previous questions when creating a new question, drive history overlay.
- `apps/web/src/components/compiler-demo-recovery.test.tsx` — replace completed-result-only expectations with stable-stage restore, pending-operation downgrade, new-question retention, and history restore integration cases.
- `apps/web/src/components/app-header.tsx` — add a History action while preserving New Question.
- `apps/web/src/components/resume-session-card.tsx` — use a summary object and resume a non-active latest session; `新问题` dismisses the card for the current mount instead of deleting history.
- `apps/web/src/components/action-icons.tsx` — reuse `history`; add `x` only if the drawer close affordance is icon-led.
- `apps/web/src/app/globals.css` — header action group, overlay/drawer, history row, mobile rules.
- `README.md` — update the recovery capability description from “latest completed result” to “full stable-stage local session + recent history”.

### Delete after migration integration is covered

- `apps/web/src/lib/completed-session-storage.ts`
- `apps/web/src/lib/completed-session-storage.test.ts`

Do not delete the legacy storage key contract; its schema and migration logic move into `question-session-storage.ts`.

---

## Storage Contract

The executor must use these names so neighboring tasks agree on interfaces:

```ts
export const QUESTION_SESSION_INDEX_KEY = "ask-better:session-index:v2";
export const QUESTION_SESSION_KEY_PREFIX = "ask-better:session:v2:";
export const LEGACY_COMPLETED_SESSION_STORAGE_KEY = "ask-better:completed-session:v1";
export const LEGACY_COMPLETED_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const QUESTION_SESSION_LIMIT = 20;
export const QUESTION_SESSION_AUTOSAVE_MS = 250;

export interface QuestionSessionDraft {
  conversationId: string;
  createdAt: number;
  stage: QuestionCompilerStage;
  rawQuestion: string;
  answers: ClarificationAnswers;
  analysis: QuestionAnalysis | null;
  retrieval: RetrieveResult | null;
  compiled: CompileResult | null;
}

export interface StoredQuestionSessionV2 extends QuestionSessionDraft {
  version: 2;
  updatedAt: number;
}

export interface QuestionSessionSummaryV2 {
  conversationId: string;
  rawQuestion: string;
  stage: QuestionCompilerStage;
  createdAt: number;
  updatedAt: number;
}

export interface QuestionSessionIndexV2 {
  version: 2;
  activeConversationId: string | null;
  entries: QuestionSessionSummaryV2[];
}
```

Required public functions:

```ts
export function createConversationId(): string;
export function saveQuestionSession(draft: QuestionSessionDraft, now?: number): boolean;
export function loadQuestionSession(conversationId: string): StoredQuestionSessionV2 | null;
export function loadActiveQuestionSession(): StoredQuestionSessionV2 | null;
export function listRecentQuestionSessions(): QuestionSessionSummaryV2[];
export function setActiveConversationId(conversationId: string | null): boolean;
export function migrateLegacyCompletedSession(now?: number, idFactory?: () => string): StoredQuestionSessionV2 | null;
export function resolveRestorableStage(session: StoredQuestionSessionV2): QuestionCompilerStage;
```

`saveQuestionSession()` owns `updatedAt`, index ordering, 20-session pruning, and active-id assignment. `CompilerDemo` never writes raw `localStorage` itself.

Stage normalization must obey this exact fallback chain:

```ts
export function resolveRestorableStage(session: StoredQuestionSessionV2): QuestionCompilerStage {
  if (session.stage === "result" && session.analysis && session.retrieval && session.compiled) {
    return "result";
  }
  if (session.stage === "coverage" && session.analysis && session.retrieval) {
    return "coverage";
  }
  if (session.stage === "diagnose" && session.analysis) {
    return "diagnose";
  }
  if (session.stage === "clarify" && session.analysis) {
    return "clarify";
  }
  return "input";
}
```

A logically incomplete stored session is downgraded to the latest safe stage; it is not allowed to render a blank Result/Coverage scene.

---

### Task 1: Build the V2 Question Session Store and Legacy Migration

**Files:**
- Create: `apps/web/src/lib/question-session-storage.ts`
- Create: `apps/web/src/lib/question-session-storage.test.ts`
- Read for schema reuse: `packages/domain/src/pipeline.ts`, `packages/domain/src/question.ts`

**Interfaces:**
- Consumes: `QuestionCompilerStage`, `questionCompilerStages`, `ClarificationAnswers`, `QuestionAnalysis`, `RetrieveResult`, `CompileResult`, `ClarificationAnswersSchema`, `QuestionAnalysisSchema`, `RetrieveResultSchema`, `CompileResultSchema` from `@ask-better/domain`.
- Produces: all storage types/constants/functions listed in **Storage Contract**.

- [ ] **Step 1: Write failing tests for V2 save/load/index behavior**

Create a local `createMemoryStorage()` helper like the existing completed-session tests. Define deterministic fixtures in the new test file so later tests share one contract:

```ts
const analysis: QuestionAnalysis = {
  intent: ["购买相机"],
  primaryGoal: "在预算内选择适合自己的第一台相机",
  timeSensitive: false,
  ambiguities: [],
  missingContext: [],
  clarificationQuestions: [],
  diagnostics: []
};

const retrieval: RetrieveResult = {
  status: "unavailable",
  evidenceStatus: "insufficient",
  queries: ["大学生 第一台相机 5000"],
  evidence: [],
  existingCoverage: [],
  knowledgeGaps: []
};

const compiled: CompileResult = {
  compiledQuestion: {
    title: "大学生第一台相机选购",
    background: "预算约 5000 元，希望购买第一台相机。",
    goal: "选择适合旅游和人像的相机。",
    constraints: ["预算约 5000 元"],
    coreUncertainty: "机身与镜头如何分配预算。",
    expectedAnswer: ["推荐机型及理由", "镜头搭配建议"]
  },
  publishableQuestion: {
    title: "预算 5000 元，大学生第一台相机应该怎么选？",
    context: "主要用于旅游和人像拍摄，可以接受二手，希望兼顾便携性和后续镜头扩展。",
    questions: ["这个预算下机身和镜头应该如何分配？"]
  },
  evidenceUsed: false
};

const baseDraft: QuestionSessionDraft = {
  conversationId: "conv-base",
  createdAt: 1_700_000_000_000,
  stage: "input",
  rawQuestion: "现在转码还有前途吗？",
  answers: {},
  analysis: null,
  retrieval: null,
  compiled: null
};

function buildDraft(overrides: Partial<QuestionSessionDraft> = {}): QuestionSessionDraft {
  return { ...baseDraft, ...overrides };
}

function buildStored(
  overrides: Partial<StoredQuestionSessionV2> = {}
): StoredQuestionSessionV2 {
  return {
    ...baseDraft,
    version: 2,
    updatedAt: 1_700_000_000_100,
    ...overrides
  };
}

function buildLegacyEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    version: 1 as const,
    savedAt: 1_700_000_000_000,
    rawQuestion: "现在转码还有前途吗？",
    answers: {},
    analysis,
    retrieval,
    compiled,
    ...overrides
  };
}
```

Then add focused tests:

```ts
test("saves an input draft and marks it active", () => {
  const storage = createMemoryStorage();
  stubWindow(storage);

  const draft = buildDraft({
    conversationId: "conv-input",
    stage: "input",
    rawQuestion: "买",
    analysis: null,
    retrieval: null,
    compiled: null
  });

  expect(saveQuestionSession(draft, 1_700_000_000_100)).toBe(true);
  expect(loadActiveQuestionSession()).toMatchObject({
    version: 2,
    conversationId: "conv-input",
    stage: "input",
    rawQuestion: "买",
    updatedAt: 1_700_000_000_100
  });
});

test("orders recent sessions by updatedAt and caps the index at 20", () => {
  const storage = createMemoryStorage();
  stubWindow(storage);

  for (let index = 0; index < 22; index += 1) {
    saveQuestionSession(
      buildDraft({
        conversationId: `conv-${index}`,
        rawQuestion: `问题 ${index}`
      }),
      1_700_000_000_000 + index
    );
  }

  const recent = listRecentQuestionSessions();
  expect(recent).toHaveLength(20);
  expect(recent[0]?.conversationId).toBe("conv-21");
  expect(recent.at(-1)?.conversationId).toBe("conv-2");
  expect(storage.getItem(`${QUESTION_SESSION_KEY_PREFIX}conv-0`)).toBeNull();
  expect(storage.getItem(`${QUESTION_SESSION_KEY_PREFIX}conv-1`)).toBeNull();
});
```

Also test malformed JSON, unsupported versions, storage exceptions, and index entries whose session key is missing.

- [ ] **Step 2: Run the new storage test file and verify it fails**

Run:

```bash
pnpm --filter web test -- src/lib/question-session-storage.test.ts
```

Expected: FAIL because `question-session-storage.ts` does not exist.

- [ ] **Step 3: Implement V2 schemas and safe storage primitives**

Use Zod schemas with a draft-friendly raw question:

```ts
const PersistedRawQuestionSchema = z.string().max(1000);
const QuestionCompilerStageSchema = z.enum(questionCompilerStages);

const StoredQuestionSessionV2Schema = z.object({
  version: z.literal(2),
  conversationId: z.string().trim().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  stage: QuestionCompilerStageSchema,
  rawQuestion: PersistedRawQuestionSchema,
  answers: ClarificationAnswersSchema,
  analysis: QuestionAnalysisSchema.nullable(),
  retrieval: RetrieveResultSchema.nullable(),
  compiled: CompileResultSchema.nullable()
});
```

Generate production IDs with `crypto.randomUUID()`, but validate persisted IDs as non-empty strings so migrations/future ID strategies are not coupled to one encoding. Implement:

```ts
export function createConversationId(): string {
  return globalThis.crypto.randomUUID();
}
```

The supported runtime baseline (modern browser + Node.js 22 for development/tests) provides `crypto.randomUUID()`.

Implement `getStorage()` / silent remove helpers with the same failure semantics as the existing V1 module.

- [ ] **Step 4: Implement index update and pruning**

`saveQuestionSession()` must:

```ts
const envelope: StoredQuestionSessionV2 = {
  ...draft,
  version: 2,
  updatedAt: now
};

storage.setItem(sessionKey(draft.conversationId), JSON.stringify(envelope));

const current = loadIndexFromStorage(storage);
const nextEntry = toSummary(envelope);
const entries = [
  nextEntry,
  ...current.entries.filter((entry) => entry.conversationId !== envelope.conversationId)
]
  .sort((a, b) => b.updatedAt - a.updatedAt)
  .slice(0, QUESTION_SESSION_LIMIT);

const evictedIds = current.entries
  .map((entry) => entry.conversationId)
  .filter((id) => !entries.some((entry) => entry.conversationId === id));

for (const id of evictedIds) removeSilently(storage, sessionKey(id));

writeIndex(storage, {
  version: 2,
  activeConversationId: envelope.conversationId,
  entries
});
```

If any storage operation throws, catch it and return `false`; never rethrow into React.

`listRecentQuestionSessions()` must return newest-first entries with `rawQuestion.trim().length > 0`; an active draft that the user temporarily cleared may still be stored/restored, but it must not appear as a blank row in Recent History. `loadQuestionSession()` must remove an invalid/corrupt session key and prune that ID from the index. `loadActiveQuestionSession()` must clear a stale active pointer if its session cannot be loaded.

- [ ] **Step 5: Add logical-stage normalization tests and implementation**

Required tests:

```ts
expect(
  resolveRestorableStage(
    buildStored({ stage: "result", analysis, retrieval, compiled: null })
  )
).toBe("coverage");
expect(
  resolveRestorableStage(
    buildStored({ stage: "coverage", analysis, retrieval: null, compiled: null })
  )
).toBe("diagnose");
expect(
  resolveRestorableStage(
    buildStored({ stage: "clarify", analysis: null, retrieval: null, compiled: null })
  )
).toBe("input");
```

When downgrading Result, only choose Coverage if `analysis && retrieval`; otherwise continue down the chain.

- [ ] **Step 6: Add failing V1 migration tests**

Use the exact old envelope shape and key. Cover:

```ts
test("migrates a valid legacy completed result into an active V2 result", () => {
  storage.setItem(
    LEGACY_COMPLETED_SESSION_STORAGE_KEY,
    JSON.stringify(buildLegacyEnvelope({ savedAt: 1_700_000_000_000 }))
  );

  const migrated = migrateLegacyCompletedSession(
    1_700_000_000_000 + 60_000,
    () => "11111111-1111-4111-8111-111111111111"
  );

  expect(migrated).toMatchObject({
    version: 2,
    conversationId: "11111111-1111-4111-8111-111111111111",
    stage: "result"
  });
  expect(storage.getItem(LEGACY_COMPLETED_SESSION_STORAGE_KEY)).toBeNull();
  expect(loadActiveQuestionSession()?.stage).toBe("result");
});
```

Also verify expired/future/malformed V1 data is rejected using the old 24-hour boundary.

- [ ] **Step 7: Implement migration with delete-after-success semantics**

Migration order must be:

```text
read legacy -> parse/TTL validate -> construct V2 -> save V2 -> verify save returned true -> remove legacy key
```

Never remove the legacy key before the V2 write succeeds.

- [ ] **Step 8: Run storage tests**

```bash
pnpm --filter web test -- src/lib/question-session-storage.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/question-session-storage.ts apps/web/src/lib/question-session-storage.test.ts
git commit -m "feat: add versioned question session store"
```

---

### Task 2: Add Debounced Autosave and Lifecycle Flush

**Files:**
- Create: `apps/web/src/lib/use-question-session-persistence.ts`
- Create: `apps/web/src/lib/use-question-session-persistence.test.tsx`

**Interfaces:**
- Consumes: `QuestionSessionDraft`, `saveQuestionSession`, `QUESTION_SESSION_AUTOSAVE_MS`.
- Produces:

```ts
export function useQuestionSessionPersistence(
  draft: QuestionSessionDraft | null
): { flushQuestionSession: () => boolean };
```

- [ ] **Step 1: Write a failing hook test for the 250 ms debounce**

Use fake timers and this concrete jsdom harness:

```tsx
let root: Root | undefined;
let container: HTMLDivElement;

function Harness({ draft }: { draft: QuestionSessionDraft | null }) {
  useQuestionSessionPersistence(draft);
  return null;
}

async function renderHarness(draft: QuestionSessionDraft | null) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root?.render(<Harness draft={draft} />));
}

async function rerenderHarness(draft: QuestionSessionDraft | null) {
  await act(async () => root?.render(<Harness draft={draft} />));
}

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  container?.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("autosaves the latest draft after 250 ms and coalesces rapid edits", async () => {
  vi.useFakeTimers();
  const saveSpy = vi.spyOn(storageModule, "saveQuestionSession").mockReturnValue(true);

  await renderHarness(buildDraft({ rawQuestion: "相" }));
  await rerenderHarness(buildDraft({ rawQuestion: "相机" }));
  await rerenderHarness(buildDraft({ rawQuestion: "相机怎么选" }));

  expect(saveSpy).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(QUESTION_SESSION_AUTOSAVE_MS));

  expect(saveSpy).toHaveBeenCalledTimes(1);
  expect(saveSpy).toHaveBeenLastCalledWith(
    expect.objectContaining({ rawQuestion: "相机怎么选" })
  );
});
```

Import `createRoot`, `Root`, `act`, and reuse a local `buildDraft()` fixture with the `QuestionSessionDraft` shape from Task 1.

- [ ] **Step 2: Add failing lifecycle-flush tests**

Required cases:

```ts
window.dispatchEvent(new PageTransitionEvent("pagehide"));
expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ rawQuestion: "最新文本" }));

Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
document.dispatchEvent(new Event("visibilitychange"));
expect(saveSpy).toHaveBeenCalled();

await act(async () => root?.unmount());
expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ rawQuestion: "最新文本" }));
```

The unmount case covers an internal Next.js route/page switch where `pagehide` may not fire. `draft === null` must not write.

- [ ] **Step 3: Run the hook test and verify failure**

```bash
pnpm --filter web test -- src/lib/use-question-session-persistence.test.tsx
```

Expected: FAIL because the hook does not exist.

- [ ] **Step 4: Implement the hook**

Use one ref for the latest draft and one timer. The lifecycle flush must call the current ref, not a stale closure:

```ts
export function useQuestionSessionPersistence(draft: QuestionSessionDraft | null) {
  const latestDraftRef = useRef<QuestionSessionDraft | null>(draft);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  latestDraftRef.current = draft;

  const flushQuestionSession = useCallback(() => {
    const current = latestDraftRef.current;
    if (!current) return false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return saveQuestionSession(current);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!draft) return;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      saveQuestionSession(latestDraftRef.current as QuestionSessionDraft);
    }, QUESTION_SESSION_AUTOSAVE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [draft]);

  useEffect(() => {
    const onPageHide = () => flushQuestionSession();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushQuestionSession();
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Component unmount covers client-side route/page switches where pagehide may not fire.
      flushQuestionSession();
    };
  }, [flushQuestionSession]);

  return { flushQuestionSession };
}
```

The debounce effect cleanup may cancel timers on draft changes; the separate lifecycle effect is mounted once and flushes only on component unmount. This avoids writing during every React re-render while still covering client-side route changes.

- [ ] **Step 5: Run hook tests**

```bash
pnpm --filter web test -- src/lib/use-question-session-persistence.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/use-question-session-persistence.ts apps/web/src/lib/use-question-session-persistence.test.tsx
git commit -m "feat: autosave question sessions"
```

---

### Task 3: Hydrate and Persist Every Stable Compiler Stage

**Files:**
- Modify: `apps/web/src/components/compiler-demo.tsx`
- Modify: `apps/web/src/components/compiler-demo-recovery.test.tsx`

**Interfaces:**
- Consumes: V2 storage helpers from Task 1 and autosave hook from Task 2.
- Produces: exact-stage recovery without replaying already completed API calls.

- [ ] **Step 1: Replace completed-result-only integration tests with stage recovery tests**

Keep the existing completed Result fixture, and add Clarify / Diagnose / Coverage fixtures. Test direct hydration on mount when `activeConversationId` exists:

```ts
function seedActiveDraft(overrides: Partial<QuestionSessionDraft> = {}) {
  const draft: QuestionSessionDraft = {
    conversationId: "conv-recovery",
    createdAt: 1_700_000_000_000,
    stage: "clarify",
    rawQuestion: "预算 5000，大学生第一台相机怎么选？",
    answers: { usage: "旅游和人像", used: "接受二手" },
    analysis,
    retrieval: null,
    compiled: null,
    ...overrides
  };
  expect(saveQuestionSession(draft, 1_700_000_000_100)).toBe(true);
  return draft;
}

test("reload restores an active Clarify session with selected answers and no API replay", async () => {
  seedActiveDraft();

  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  await renderDemo();

  expect(container.querySelector('[data-stage="clarify"][data-scene-role="stable"]')).not.toBeNull();
  expect(container.textContent).toContain("旅游和人像");
  expect(container.textContent).toContain("接受二手");
  expect(fetchSpy).not.toHaveBeenCalled();
});
```

Add equivalent tests for Coverage and Result.

- [ ] **Step 2: Add pending-operation recovery tests**

Simulate the persisted stable state that exists while a request is pending:

```text
Analyze pending  -> persisted stage input
Retrieve pending -> persisted stage diagnose
Compile pending  -> persisted stage coverage
```

The remounted component must not render any loading label solely because the previous browser instance had a pending request.

- [ ] **Step 3: Run the focused recovery tests and verify failure**

```bash
pnpm --filter web test -- src/components/compiler-demo-recovery.test.tsx
```

Expected: FAIL against the V1 completed-only implementation.

- [ ] **Step 4: Add conversation identity state to `CompilerDemo`**

Add:

```ts
const [conversationId, setConversationId] = useState<string | null>(null);
const [conversationCreatedAt, setConversationCreatedAt] = useState<number | null>(null);
```

When the user first types a non-empty value and there is no current ID:

```ts
if (conversationId === null && value.trim().length > 0) {
  setConversationId(createConversationId());
  setConversationCreatedAt(Date.now());
}
```

Do not create a conversation for the untouched empty landing page.

- [ ] **Step 5: Build one persistable snapshot with `useMemo`**

```ts
const sessionDraft = useMemo<QuestionSessionDraft | null>(() => {
  if (!conversationId || conversationCreatedAt === null) return null;

  return {
    conversationId,
    createdAt: conversationCreatedAt,
    stage,
    rawQuestion,
    answers,
    analysis,
    retrieval,
    compiled
  };
}, [
  conversationId,
  conversationCreatedAt,
  stage,
  rawQuestion,
  answers,
  analysis,
  retrieval,
  compiled
]);

const { flushQuestionSession } = useQuestionSessionPersistence(sessionDraft);
```

`operation`, `error`, `copyStatus`, and `sceneResetEpoch` are intentionally absent.

- [ ] **Step 6: Centralize hydration into one function**

Implement:

```ts
function hydrateQuestionSession(session: StoredQuestionSessionV2) {
  cancelPending();
  setConversationId(session.conversationId);
  setConversationCreatedAt(session.createdAt);
  setRawQuestion(session.rawQuestion);
  setAnswers(session.answers);
  setAnalysis(session.analysis);
  setRetrieval(session.retrieval);
  setCompiled(session.compiled);
  setOperation("idle");
  setCopyStatus("idle");
  setError(null);
  setStage(resolveRestorableStage(session));
  setSceneResetEpoch((value) => value + 1);
}
```

The `sceneResetEpoch` bump is required so hydration becomes the initial stable scene rather than animating Input -> restored stage.

- [ ] **Step 7: Bootstrap migration + active-session hydration on mount**

The mount effect must run once:

```ts
useEffect(() => {
  migrateLegacyCompletedSession();
  const active = loadActiveQuestionSession();
  if (active) hydrateQuestionSession(active);
}, []);
```

Suppress the React-hooks exhaustive-deps concern by keeping hydration dependencies stable or by moving bootstrap into a dedicated callback. Do not create an effect loop that rehydrates after every autosave.

- [ ] **Step 8: Change successful compile and Zhihu handoff to V2 flush**

Delete direct `saveCompletedSession(...)` calls. After setting `compiled`, normal autosave will persist Result. Before opening Zhihu, force a synchronous flush:

```ts
function handleOpenZhihu() {
  flushQuestionSession();
  window.open("https://www.zhihu.com/", "_blank", "noopener,noreferrer");
}
```

Because React state updates are asynchronous, `handleCompile()` must not rely on a stale pre-compile `sessionDraft` for the just-produced result. Immediately persist the completed snapshot after receiving `nextCompiled`:

```ts
const resultConversationId = conversationId ?? createConversationId();
const resultCreatedAt = conversationCreatedAt ?? Date.now();

if (conversationId === null) setConversationId(resultConversationId);
if (conversationCreatedAt === null) setConversationCreatedAt(resultCreatedAt);

const completedDraft: QuestionSessionDraft = {
  conversationId: resultConversationId,
  createdAt: resultCreatedAt,
  stage: "result",
  rawQuestion,
  answers,
  analysis,
  retrieval,
  compiled: nextCompiled
};

saveQuestionSession(completedDraft);
```

Then set React state. This preserves the existing “persist before handoff” guarantee without waiting 250 ms.

- [ ] **Step 9: Redefine `handleNewQuestion()` to retain history**

Current code clears the only stored session. New behavior is:

```ts
function handleNewQuestion() {
  cancelPending();
  flushQuestionSession();
  setActiveConversationId(null);
  setConversationId(null);
  setConversationCreatedAt(null);
  setRawQuestion("");
  setAnswers({});
  setAnalysis(null);
  setRetrieval(null);
  setCompiled(null);
  setError(null);
  setCopyStatus("idle");
  setStage("input");
  setSceneResetEpoch((value) => value + 1);
}
```

Do **not** delete the previous conversation; it must remain in Recent History.

- [ ] **Step 10: Run recovery tests**

```bash
pnpm --filter web test -- src/components/compiler-demo-recovery.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/compiler-demo.tsx apps/web/src/components/compiler-demo-recovery.test.tsx
git commit -m "feat: restore in-progress question sessions"
```

---

### Task 4: Add Recent Question History Without Changing the Five-Scene Layout

**Files:**
- Create: `apps/web/src/components/session-history-drawer.tsx`
- Create: `apps/web/src/components/session-history-drawer.test.tsx`
- Modify: `apps/web/src/components/app-header.tsx`
- Modify: `apps/web/src/components/compiler-demo.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: `QuestionSessionSummaryV2`, `listRecentQuestionSessions()`, `loadQuestionSession()`.
- Produces:

```ts
interface SessionHistoryDrawerProps {
  open: boolean;
  sessions: QuestionSessionSummaryV2[];
  activeConversationId: string | null;
  onClose: () => void;
  onSelect: (conversationId: string) => void;
}
```

`AppHeader` becomes:

```ts
interface AppHeaderProps {
  onOpenHistory: () => void;
  onNewQuestion: () => void;
}
```

- [ ] **Step 1: Write drawer behavior tests**

Cover:

```tsx
const sessions: QuestionSessionSummaryV2[] = [
  {
    conversationId: "conv-new",
    rawQuestion: "预算 5000，大学生第一台相机怎么选？",
    stage: "clarify",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_002_000
  },
  {
    conversationId: "conv-old",
    rawQuestion: "考公还是考研更适合我？",
    stage: "result",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_001_000
  }
];

test("renders recent sessions newest-first with stage labels", async () => {
  await renderDrawer({ sessions, open: true });
  const rows = Array.from(container.querySelectorAll<HTMLButtonElement>(".history-row"));
  expect(rows[0]?.textContent).toContain("预算 5000");
  expect(rows[0]?.textContent).toContain("补充信息");
  expect(rows[1]?.textContent).toContain("考公还是考研");
  expect(rows[1]?.textContent).toContain("编译结果");
});

test("selecting a row returns its conversation id", async () => {
  const onSelect = vi.fn();
  await renderDrawer({ sessions, open: true, onSelect });
  await click(container.querySelectorAll<HTMLButtonElement>(".history-row")[1]);
  expect(onSelect).toHaveBeenCalledWith("conv-old");
});

test("Escape closes the drawer", async () => {
  const onClose = vi.fn();
  await renderDrawer({ sessions, open: true, onClose });
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("backdrop click closes but panel click does not", async () => {
  const onClose = vi.fn();
  await renderDrawer({ sessions, open: true, onClose });
  await click(container.querySelector<HTMLElement>(".history-drawer"));
  expect(onClose).not.toHaveBeenCalled();
  await click(container.querySelector<HTMLElement>(".history-overlay"));
  expect(onClose).toHaveBeenCalledTimes(1);
});
```

Use these helpers in the same test file; do not add a testing-library dependency:

```tsx
let root: Root | undefined;
let container: HTMLDivElement;

async function renderDrawer({
  sessions: nextSessions,
  open,
  onClose = vi.fn(),
  onSelect = vi.fn()
}: {
  sessions: QuestionSessionSummaryV2[];
  open: boolean;
  onClose?: () => void;
  onSelect?: (conversationId: string) => void;
}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <SessionHistoryDrawer
        open={open}
        sessions={nextSessions}
        activeConversationId={null}
        onClose={onClose}
        onSelect={onSelect}
      />
    );
  });
}

async function click(element: Element | null) {
  expect(element).not.toBeNull();
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
```

Use `stageLabels[session.stage]` for stage text; do not duplicate stage-name literals inside the component.

- [ ] **Step 2: Run drawer test and verify failure**

```bash
pnpm --filter web test -- src/components/session-history-drawer.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the accessible overlay**

Return `null` when `open` is false. Use these local helpers so time formatting and backdrop behavior are deterministic:

```ts
const historyTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function formatHistoryTime(timestamp: number): string {
  return historyTimeFormatter.format(new Date(timestamp));
}

function onBackdropMouseDown(event: React.MouseEvent<HTMLDivElement>) {
  if (event.target === event.currentTarget) onClose();
}
```

Required DOM shape:

```tsx
<div className="history-overlay" role="presentation" onMouseDown={onBackdropMouseDown}>
  <section
    className="history-drawer"
    role="dialog"
    aria-modal="true"
    aria-labelledby="history-title"
    onMouseDown={(event) => event.stopPropagation()}
  >
    <header className="history-drawer-header">
      <h2 id="history-title">最近提问</h2>
      <button type="button" className="ghost-button" onClick={onClose}>关闭</button>
    </header>
    <div className="history-list">
      {sessions.map((session) => (
        <button
          type="button"
          className="history-row"
          data-active={session.conversationId === activeConversationId ? "true" : "false"}
          key={session.conversationId}
          onClick={() => onSelect(session.conversationId)}
        >
          <strong>{session.rawQuestion.trim() || "未命名问题"}</strong>
          <span>{stageLabels[session.stage]} · {formatHistoryTime(session.updatedAt)}</span>
        </button>
      ))}
    </div>
  </section>
</div>
```

Install an Escape listener only while `open === true`.

- [ ] **Step 4: Add Header history action**

Keep the current brand block. Replace the single trailing button with:

```tsx
<div className="app-header-actions">
  <button className="ghost-button" type="button" onClick={onOpenHistory}>
    <ActionIcon name="history" />
    历史
  </button>
  <button className="ghost-button" type="button" onClick={onNewQuestion}>
    <ActionIcon name="plus" />
    新建问题
  </button>
</div>
```

Do not convert the header into a navigation sidebar.

- [ ] **Step 5: Wire history state in `CompilerDemo`**

Add:

```ts
const [historyOpen, setHistoryOpen] = useState(false);
const [recentSessions, setRecentSessions] = useState<QuestionSessionSummaryV2[]>([]);

function handleOpenHistory() {
  setRecentSessions(listRecentQuestionSessions());
  setHistoryOpen(true);
}
```

When selecting:

```ts
function handleSelectHistory(conversationId: string) {
  const session = loadQuestionSession(conversationId);
  if (!session) {
      return;
  }
  setActiveConversationId(conversationId);
  hydrateQuestionSession(session);
  setHistoryOpen(false);
}
```

Refresh `recentSessions` when opening the drawer. The drawer does not need to rerender on every autosaved keystroke while closed.

- [ ] **Step 6: Add concrete CSS without disturbing scene geometry**

Append overlay rules outside `.scene-transition-viewport` geometry:

```css
.app-header-actions{
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-header-actions .ghost-button{
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.history-overlay{
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  justify-content: flex-end;
  background: rgba(23, 26, 36, 0.28);
  backdrop-filter: blur(4px);
}

.history-drawer{
  width: min(420px, 92vw);
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--surface-raised);
  border-left: 1px solid var(--border);
  box-shadow: -18px 0 48px rgba(28, 35, 55, 0.12);
}

.history-drawer-header{
  min-height: var(--app-header-height);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}

.history-list{
  padding: 12px;
  overflow-y: auto;
}

.history-row{
  width: 100%;
  padding: 13px 14px;
  display: grid;
  gap: 5px;
  text-align: left;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
}

.history-row:hover,
.history-row[data-active="true"]{
  background: var(--surface-accent);
  border-color: var(--border);
}

.history-row strong{
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: 14px;
}

.history-row span{
  color: var(--text-tertiary);
  font-size: 11px;
}

@media (max-width: 640px){
  .app-header{
    padding-inline: 16px;
  }

  .brand-subtitle{
    display: none;
  }

  .app-header-actions .ghost-button{
    padding-inline: 9px;
  }

  .history-drawer{
    width: 100vw;
  }
}
```

Adjust exact padding only if existing `.ghost-button` rules conflict; do not touch scene safe-frame dimensions for this feature.

- [ ] **Step 7: Run drawer + compiler tests**

```bash
pnpm --filter web test -- src/components/session-history-drawer.test.tsx src/components/compiler-demo-recovery.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/session-history-drawer.tsx \
  apps/web/src/components/session-history-drawer.test.tsx \
  apps/web/src/components/app-header.tsx \
  apps/web/src/components/compiler-demo.tsx \
  apps/web/src/app/globals.css
git commit -m "feat: add recent question history"
```

---

### Task 5: Preserve “Continue Last Question” as a Secondary Recovery Path

**Files:**
- Modify: `apps/web/src/components/resume-session-card.tsx`
- Modify: `apps/web/src/components/compiler-demo.tsx`
- Modify: `apps/web/src/components/compiler-demo-recovery.test.tsx`

**Interfaces:**
- Consumes: `QuestionSessionSummaryV2`, `loadQuestionSession()`.
- Produces: a resume card only when there is no active session to auto-hydrate but a recent prior conversation exists.

- [ ] **Step 1: Add failing recovery-card tests for the new semantics**

Required behavior:

```ts
const resumeConversationId = "conv-resume";

function seedResumeCandidate() {
  const draft = seedActiveDraft({
    conversationId: resumeConversationId,
    stage: "clarify",
    rawQuestion: "预算 5000，大学生第一台相机怎么选？"
  });
  expect(setActiveConversationId(null)).toBe(true);
  return draft;
}

test("no active session + recent history shows 继续上次 without auto-hydrating", async () => {
  const draft = seedResumeCandidate();
  await renderDemo();

  expect(container.querySelector('[data-stage="input"]')).not.toBeNull();
  expect(container.querySelector(".resume-session-card")).not.toBeNull();
  expect(container.textContent).toContain(draft.rawQuestion);
});

test("继续上次 hydrates the candidate exact stage", async () => {
  seedResumeCandidate();
  await renderDemo();
  await clickButton(findButton(container, "继续上次"));

  expect(container.querySelector('[data-stage="clarify"][data-scene-role="stable"]')).not.toBeNull();
});

test("新问题 dismisses the resume card but does not delete the stored history item", async () => {
  seedResumeCandidate();
  await renderDemo();
  await clickButton(findButton(container, "新问题"));

  expect(loadQuestionSession(resumeConversationId)).not.toBeNull();
  expect(container.querySelector(".resume-session-card")).toBeNull();
});
```

- [ ] **Step 2: Run the focused recovery test and verify failure**

```bash
pnpm --filter web test -- src/components/compiler-demo-recovery.test.tsx
```

Expected: FAIL until the card stops assuming a completed-result-only envelope.

- [ ] **Step 3: Change `ResumeSessionCard` props to summary-level data**

Use:

```ts
interface ResumeSessionCardProps {
  session: QuestionSessionSummaryV2;
  onResume: () => void;
  onDismiss: () => void;
}
```

Render `session.rawQuestion` and optionally the concise stage label. Do not require `analysis/retrieval/compiled` in this component.

- [ ] **Step 4: Derive the candidate only when active hydration did not occur**

In `CompilerDemo`:

```ts
const [resumeCandidate, setResumeCandidate] = useState<QuestionSessionSummaryV2 | null>(null);

useEffect(() => {
  migrateLegacyCompletedSession();
  const active = loadActiveQuestionSession();
  if (active) {
    hydrateQuestionSession(active);
    return;
  }
  setResumeCandidate(listRecentQuestionSessions()[0] ?? null);
}, []);
```

On Resume:

```ts
function restoreLastSession() {
  if (!resumeCandidate) return;
  const session = loadQuestionSession(resumeCandidate.conversationId);
  if (!session) {
    setResumeCandidate(null);
      return;
  }
  setActiveConversationId(session.conversationId);
  setResumeCandidate(null);
  hydrateQuestionSession(session);
}
```

On Dismiss:

```ts
function dismissResumeCandidate() {
  setResumeCandidate(null);
}
```

Dismissal is UI-only; it must not delete the history entry.

- [ ] **Step 5: Ensure explicit New Question resets active pointer but keeps recent history**

When Header/Result `新问题` is clicked, also clear `resumeCandidate`. The blank input remains usable and the History drawer still lists prior sessions.

- [ ] **Step 6: Run recovery tests**

```bash
pnpm --filter web test -- src/components/compiler-demo-recovery.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/resume-session-card.tsx \
  apps/web/src/components/compiler-demo.tsx \
  apps/web/src/components/compiler-demo-recovery.test.tsx
git commit -m "feat: continue recent question sessions"
```

---

### Task 6: Remove the V1 Runtime Module and Update Documentation

**Files:**
- Delete: `apps/web/src/lib/completed-session-storage.ts`
- Delete: `apps/web/src/lib/completed-session-storage.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1 legacy migration code.
- Produces: one persistence implementation with no dead duplicate runtime path.

- [ ] **Step 1: Search for legacy runtime imports before deletion**

Run:

```bash
rg "completed-session-storage|saveCompletedSession|loadCompletedSession|clearCompletedSession" apps/web/src README.md
```

Expected before cleanup: only the legacy module/tests, or any missed references that must be moved to V2 first.

- [ ] **Step 2: Delete the old module and old test file**

```bash
rm apps/web/src/lib/completed-session-storage.ts
rm apps/web/src/lib/completed-session-storage.test.ts
```

Do not remove the string `ask-better:completed-session:v1` from the new migration code.

- [ ] **Step 3: Update README recovery documentation**

Replace completed-result-only wording with a concise capability section:

```markdown
### Local question-session recovery

The Web app keeps the current question workflow in a versioned local-first session store:

- every non-empty question receives a stable `conversationId`;
- Input / Clarify / Diagnose / Coverage / Result stable state is autosaved locally;
- refresh or returning to `ask.wulisu.icu` restores the active stable stage without replaying completed API calls;
- pending Analyze / Retrieve / Compile operations are never restored as loading states;
- the latest 20 question sessions are available from Recent History;
- the previous `ask-better:completed-session:v1` completed result is migrated to V2 once when valid.

This remains browser-local. OAuth/account sync and cross-device history are outside the current scope.
```

- [ ] **Step 4: Verify no stale import remains**

```bash
rg "from .*completed-session-storage|saveCompletedSession|loadCompletedSession|clearCompletedSession" apps/web/src
```

Expected: no output.

- [ ] **Step 5: Run Web tests**

```bash
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/lib README.md
git commit -m "refactor: retire completed-session v1 runtime"
```

---

### Task 7: Full Regression Verification and Manual Acceptance

**Files:**
- No feature-code additions unless verification exposes a defect.
- If a fix is required, add a regression test in the nearest existing/new test file before changing production code.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified handoff-ready feature.

- [ ] **Step 1: Run domain tests and typecheck**

```bash
pnpm --filter @ask-better/domain test
pnpm --filter @ask-better/domain typecheck
```

Expected: PASS. No domain behavior should have changed.

- [ ] **Step 2: Run Web tests and typecheck**

```bash
pnpm --filter web test
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 3: Run production build**

```bash
pnpm --filter web build
```

Expected: PASS with no SSR access to `window` / `localStorage` during module initialization.

- [ ] **Step 4: Perform the exact P0 manual acceptance sequence**

Run `pnpm dev`, then verify in a real browser:

```text
A. Start
1. Open Ask Better.
2. Enter a question.
3. Confirm a conversationId-backed session appears in localStorage.

B. Clarify recovery
4. Complete Analyze.
5. Answer at least two clarification questions.
6. Press F5.
Expected: returns to Clarify with the same answers; Analyze is not called again.

C. Page/tab handoff
7. Switch to another tab/page, then return.
Expected: current question remains intact.
8. Close the tab, reopen ask.wulisu.icu.
Expected: active stable stage is restored automatically.

D. Pending operations
9. Start Retrieve, then reload before it completes.
Expected: Diagnose is restored, not a permanent loading state.
10. Start Compile, then reload before it completes.
Expected: Coverage is restored, not a permanent loading state.

E. Result
11. Complete Compile.
12. Click 打开知乎.
13. Return to Ask Better.
Expected: the same Result is present; no recompilation occurs.

F. New question + history
14. Click 新建问题.
Expected: blank Input, previous question remains in 历史.
15. Start and complete a second question.
16. Open 历史.
Expected: both questions appear newest-first.
17. Select the first question.
Expected: its exact saved stable stage is hydrated without replaying prior API calls.

G. Continue-last path
18. Click 新建问题, leaving no active conversation.
19. Reload the app.
Expected: blank Input shows 继续上次 card.
20. Click 继续上次.
Expected: most recent session restores exactly.
```

- [ ] **Step 5: Verify 20-session pruning**

Create or seed 22 sessions. Confirm the history UI displays 20 and the two oldest V2 session keys are removed.

- [ ] **Step 6: Verify legacy migration in browser storage**

Seed a valid `ask-better:completed-session:v1` value using the old schema, remove all V2 keys, reload once.

Expected:

```text
legacy V1 key removed
V2 session key created
V2 index created
activeConversationId points to migrated session
Result restores with no API replay
```

- [ ] **Step 7: Run production smoke after deployment if this branch is deployed**

```bash
SMOKE_BASE_URL=https://ask.wulisu.icu pnpm smoke:production -- "现在转码还有前途吗？"
```

PowerShell:

```powershell
$env:SMOKE_BASE_URL = "https://ask.wulisu.icu"
pnpm smoke:production -- "现在转码还有前途吗？"
```

Expected: existing Analyze/Retrieve/Compile pipeline remains healthy. Session persistence is client-side and must not change API payloads.

- [ ] **Step 8: Commit any verification-only regression fixes**

If no fixes were required, do not create an empty commit. If fixes were required:

```bash
git add <changed-production-file> <matching-regression-test>
git commit -m "fix: harden question session recovery"
```

---

## Required Test Matrix

Before declaring the feature complete, these cases must exist as automated tests, not only manual checks:

| Case | Expected recovery |
|---|---|
| 1–4 character Input draft | Input with exact text |
| Analyze completed | Clarify with `analysis`, no Analyze replay |
| Clarification answers changed | Clarify with latest answer map |
| Diagnose stable | Diagnose with `analysis` |
| Retrieve pending | Diagnose, `operation=idle` |
| Coverage stable | Coverage with existing `retrieval` |
| Compile pending | Coverage, `operation=idle` |
| Result stable | Result with `compiled`, no Compile replay |
| Corrupt JSON | Ignore/remove corrupt entry; app remains usable |
| Logically inconsistent Result | Downgrade to latest safe stable stage |
| Storage denied/quota error | Product continues without throwing |
| New Question | Clears active pointer, does not erase previous history |
| Select recent history | Hydrates chosen `conversationId` |
| V1 valid/unexpired | Migrates once to V2 Result |
| V1 expired/future/malformed | Does not become a V2 session |
| 22 saved sessions | Only newest 20 remain |

---

## Non-Goals / Guardrails for the Implementing Agent

Do not expand this task into any of the following:

```text
- user accounts
- Zhihu OAuth
- device IDs
- server database tables
- Redis-backed user history
- URL routing per conversation
- sharing conversation links
- deleting/renaming conversations
- search within history
- sync across browsers/devices
- analytics events
- reworking StageTransitionViewport
- changing question compiler prompts
- changing API route contracts
```

Those can be layered later because `conversationId` and the local session abstraction provide the future seam.

## Completion Definition

The feature is complete only when all of the following are true:

```text
[PASS] user refreshes at Input / Clarify / Diagnose / Coverage / Result and keeps the latest stable state
[PASS] user answers clarification questions, leaves, and returns without re-answering
[PASS] every started non-empty question owns a stable conversationId
[PASS] pending Analyze/Retrieve/Compile never rehydrate as fake loading
[PASS] New Question starts clean without deleting the prior session
[PASS] Recent History lists up to 20 sessions newest-first
[PASS] selecting history restores the chosen session without replaying completed API calls
[PASS] continue-last card works when there is no active session
[PASS] valid V1 completed-result storage migrates to V2
[PASS] localStorage failures never break the compiler or Zhihu handoff
[PASS] domain tests, Web tests, typecheck, and production build all pass
```
