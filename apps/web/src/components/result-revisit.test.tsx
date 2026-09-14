// @vitest-environment jsdom
//
// Task 6 regression: once a Result has been produced, walking back through the pipeline
// (Result -> Clarify -> Diagnose -> Coverage -> Result) must REUSE the compiled result instead of
// re-running Analyse/Retrieve/Compile. The bug was that `handleReoptimize` invalidated `retrieval`
// and `compiled` while merely navigating to Clarify, and that `handleCompile` had no reuse guard
// symmetric with `handleRetrieve`'s.
//
// Call counts on the real network boundary (`fetch`) are the primary oracle: a second Compile
// renders the same kind of Result screen, so only the request count proves reuse.
//
// Every payload is distinct — the seeded session carries the "SEEDED" markers and the first
// network response carries the "FIRST" ones — so "reused" and "re-fetched" are distinguishable by
// content on every single call, no matter how many calls a given test performs. That keeps the
// oracles order-independent: what is asserted is not "the Nth response" but "the payload produced
// by this exact request".
//
// Nothing here needs a cache, a fingerprint, sessionStorage or a second localStorage key: reuse
// rides entirely on the Question Session, which stays the single persistence owner.
//
// Deliberately NOT asserted: `data-result-*` hooks, the Result copy strings, `before-after-grid`,
// `compile-bridge`, and any class name. The Result UI is being restyled in a parallel worktree, so
// these tests rely only on stage transitions, API counts and domain-content strings.
import type { CompileResult, QuestionAnalysis, RetrieveResult } from "@ask-better/domain";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  loadActiveQuestionSession,
  saveQuestionSession,
  type QuestionSessionDraft
} from "../lib/question-session-storage";
import { CompilerDemo } from "./compiler-demo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// These are end-to-end component tests that drive real scene handoffs, so a single case can
// perform eight of them. The default 5s budget is not enough for that.
vi.setConfig({ testTimeout: 20_000 });

const CONVERSATION_ID = "conv-result-revisit";
const RETYPE_QUESTION = "现在转码还有前途吗？换个问法重新来过。";

const analysis: QuestionAnalysis = {
  intent: ["评估转码前景"],
  primaryGoal: "判断现在转码是否仍有前途",
  timeSensitive: true,
  ambiguities: [],
  missingContext: [],
  clarificationQuestions: [
    { id: "direction", question: "你更想转向哪个方向？", options: ["AI 应用开发", "前端开发"] }
  ],
  diagnostics: []
};

function makeRetrieval(marker: string): RetrieveResult {
  return {
    status: "success",
    evidenceStatus: "sufficient",
    queries: [`现在转码还有前途吗 ${marker}`],
    evidence: [0, 1, 2].map((index) => ({
      id: `${marker}-e${index + 1}`,
      title: `${marker}证据${index + 1}`,
      contentType: "Answer",
      summary: `${marker}摘要${index + 1}`,
      url: `https://www.zhihu.com/question/${900000 + index}`,
      author: "答主",
      editedAt: 1710000000 + index,
      rankingScore: 0.9,
      authorityLevel: "2",
      voteUpCount: 10 + index,
      commentCount: index,
      selectedComments: [],
      source: "zhihu" as const
    })),
    existingCoverage: [
      {
        id: `${marker}-c1`,
        title: `${marker}覆盖标题`,
        detail: `${marker}已有讨论覆盖了趋势。`,
        strength: "medium" as const
      }
    ],
    knowledgeGaps: [
      { id: `${marker}-g1`, title: `${marker}追问标题`, detail: `${marker}当前检索没有覆盖这个细节。` }
    ]
  };
}

function makeCompiled(marker: string): CompileResult {
  return {
    compiledQuestion: {
      title: `${marker}可发布标题`,
      background: `${marker}背景：用户是工作三年的后端工程师。`,
      goal: `${marker}目标：判断转码的可行性与时机。`,
      constraints: [`${marker}限制：只能利用业余时间学习`],
      coreUncertainty: `${marker}核心困惑：转码窗口是否已经关闭。`,
      expectedAnswer: [`${marker}期望：给出可执行的判断标准`, `${marker}期望：说明主要风险`]
    },
    publishableQuestion: {
      title: `${marker}最终标题：工作三年后端工程师现在转码还来得及吗`,
      context: `${marker}上下文：工作三年，正在评估转向 AI 应用开发的可行性与时机。`,
      questions: [`${marker}请教：现在开始转码，三年后还有竞争力吗？`]
    },
    evidenceUsed: true
  };
}

/** What the restored session already owns. Nothing may be re-fetched on top of it. */
const SEEDED_RETRIEVAL = makeRetrieval("会话已存检索");
const SEEDED_COMPILED = makeCompiled("会话已存编译");

/**
 * What the network returns if — and only if — a request is actually made.
 *
 * Each API is answered with ONE fixed payload. `prior === 0` looks tempting ("distinguish a reused
 * first payload from a re-fetched second one") but it makes the reply depend on how many requests
 * the whole test happened to make, which silently turns a wrong-but-plausible count into a
 * wrong-and-confusing payload. Answering every request identically keeps each assertion a
 * statement about "did this request happen at all", which is exactly what these cases are about.
 */
const FIRST = makeRetrieval("第一次检索");
const COMPILED_A = makeCompiled("初次编译");

const SEEDED_TITLE = SEEDED_COMPILED.publishableQuestion.title;
const FIRST_TITLE = COMPILED_A.publishableQuestion.title;
const SEEDED_COVERAGE = SEEDED_RETRIEVAL.existingCoverage[0].title;
const FIRST_COVERAGE = FIRST.existingCoverage[0].title;

let container: HTMLDivElement | undefined;
let root: Root | undefined;
let fetchMock: ReturnType<typeof vi.fn>;
let createdContainers: HTMLDivElement[] = [];

function callsTo(fragment: string): number {
  return fetchMock.mock.calls.filter((call) => String(call[0]).includes(fragment)).length;
}
const analyzeCalls = () => callsTo("/api/question/analyze");
const retrieveCalls = () => callsTo("/api/question/retrieve");
const compileCalls = () => callsTo("/api/question/compile");

/**
 * Realistic `matchMedia`. This matters: `StageTransitionViewport` gates its GSAP handoff timeline
 * on `gsap.matchMedia()` for `(prefers-reduced-motion: no-preference)` / `(prefers-reduced-motion:
 * reduce)`. A stub that answers `false` to everything starts no timeline at all, so the scene
 * stays half-swapped forever and no stage can be asserted.
 */
function stubMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    })
  });
}

function jsonResponse(payload: unknown): Response {
  return { json: async () => payload } as unknown as Response;
}

function installFetchMock() {
  fetchMock = vi.fn(async (url: unknown) => {
    const target = String(url);
    if (target.includes("/api/question/analyze")) {
      return jsonResponse({ ok: true, data: analysis });
    }
    if (target.includes("/api/question/retrieve")) {
      // The seeded session owns the "SEEDED" retrieval; anything the network produces is visibly
      // different, so a fetch that happens can never be mistaken for a reuse.
      return jsonResponse({ ok: true, data: FIRST });
    }
    if (target.includes("/api/question/compile")) {
      return jsonResponse({ ok: true, data: COMPILED_A });
    }
    throw new Error(`unexpected request: ${target}`);
  });
  vi.stubGlobal("fetch", fetchMock);
}

function seedSession(overrides: Partial<QuestionSessionDraft> = {}) {
  const draft: QuestionSessionDraft = {
    conversationId: CONVERSATION_ID,
    createdAt: 1_700_000_000_000,
    stage: "result",
    rawQuestion: "现在转码还有前途吗？",
    answers: { direction: "AI 应用开发" },
    analysis,
    retrieval: SEEDED_RETRIEVAL,
    compiled: SEEDED_COMPILED,
    ...overrides
  };
  expect(saveQuestionSession(draft, 1_700_000_100_000)).toBe(true);
  return draft;
}

async function renderDemo() {
  container = document.createElement("div");
  createdContainers.push(container);
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<CompilerDemo />);
  });
  await settleTransition();
  return container;
}

async function tick(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function roles(): string[] {
  return Array.from(container?.querySelectorAll("[data-scene-role]") ?? []).map(
    (element) => element.getAttribute("data-scene-role") ?? ""
  );
}

/**
 * Waits until the scene handoff has fully landed (only a `stable` canvas remains). Without this,
 * assertions can observe the mid-transition half-swapped DOM instead of the settled scene.
 */
async function settleTransition(tries = 80) {
  for (let i = 0; i < tries; i += 1) {
    const current = roles();
    if (current.length === 1 && current[0] === "stable") return;
    await tick(50);
  }
  throw new Error(`scene handoff never settled; roles=${JSON.stringify(roles())}`);
}

function stableStage(): string | null {
  return container?.querySelector('[data-scene-role="stable"]')?.getAttribute("data-stage") ?? null;
}
function text(): string {
  return container?.textContent ?? "";
}
function busyButtons(): number {
  return container?.querySelectorAll('[aria-busy="true"]').length ?? 0;
}

function findButton(scope: ParentNode, label: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll("button")).find((item) =>
    item.textContent?.trim().includes(label)
  );
  expect(button, `button not found: ${label}`).toBeDefined();
  return button as HTMLButtonElement;
}

/**
 * Clicks a control and waits for the resulting scene handoff to settle. `expectedStage` is
 * mandatory so a "nothing navigated" bug can never masquerade as a pass.
 */
async function clickLabel(label: string, expectedStage: string) {
  const button = findButton(container as HTMLElement, label);
  await act(async () => {
    button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
  await settleTransition();
  expect(stableStage(), `stage after clicking ${label}`).toBe(expectedStage);
}

function typeIntoTextarea(value: string) {
  const textarea = container?.querySelector("textarea");
  expect(textarea).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  expect(setter).toBeDefined();
  setter?.call(textarea, value);
  textarea?.dispatchEvent(new window.Event("input", { bubbles: true }));
}

async function retypeQuestion(value: string) {
  await act(async () => {
    typeIntoTextarea(value);
  });
  await settleTransition();
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(1_700_000_200_000);
  stubMatchMedia();
  window.localStorage.clear();
  installFetchMock();
  createdContainers = [];
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  root = undefined;
  container = undefined;
  for (const element of createdContainers) element.remove();
  createdContainers = [];
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("coverage revisit after a compiled result", () => {
  test("R1: re-entering Coverage from Diagnose still reuses the owned retrieval", async () => {
    seedSession({ stage: "diagnose", retrieval: null, compiled: null });
    await renderDemo();

    expect(stableStage()).toBe("diagnose");
    expect(retrieveCalls()).toBe(0);

    await clickLabel("查看知乎已有讨论", "coverage");
    expect(retrieveCalls()).toBe(1);
    expect(text()).toContain(FIRST_COVERAGE);

    await clickLabel("返回问题体检", "diagnose");
    expect(retrieveCalls()).toBe(1);

    await clickLabel("查看知乎已有讨论", "coverage");
    expect(retrieveCalls()).toBe(1);
    expect(text()).toContain(FIRST_COVERAGE);
    expect(text()).not.toContain(SEEDED_COVERAGE);
    expect(analyzeCalls()).toBe(0);
    expect(compileCalls()).toBe(0);
  });

  test("R2: compiling from a restored Coverage session reuses the persisted compiled result", async () => {
    seedSession({ stage: "coverage" });
    await renderDemo();

    // A restored Coverage session replays nothing on mount.
    expect(stableStage()).toBe("coverage");
    expect(compileCalls()).toBe(0);
    expect(retrieveCalls()).toBe(0);
    expect(analyzeCalls()).toBe(0);

    await clickLabel("编译我的问题", "result");

    // NOTE: `compileCalls()` is 0, not 1. A restored `coverage` session that already owns both
    // `retrieval` and `compiled` has nothing left to build, so the symmetric guard in
    // `handleCompile` turns the click into the same pure navigation `handleRetrieve` already
    // performs. That is the intended behaviour: "reuses the persisted compiled result" means the
    // persisted result is what gets shown, which can only be true if no Compile was issued.
    expect(compileCalls()).toBe(0);
    expect(retrieveCalls()).toBe(0);
    expect(analyzeCalls()).toBe(0);
    // The persisted Result is what is rendered — not a re-compiled one.
    expect(text()).toContain(SEEDED_TITLE);
    expect(text()).not.toContain(FIRST_TITLE);
    expect(busyButtons()).toBe(0);

    // And the session still owns exactly that Result.
    expect(loadActiveQuestionSession()?.compiled?.publishableQuestion.title).toBe(SEEDED_TITLE);
  });

  test("R3: backing out to Clarify without changing anything keeps the compiled result", async () => {
    seedSession();
    await renderDemo();

    expect(stableStage()).toBe("result");
    expect(analyzeCalls()).toBe(0);
    expect(retrieveCalls()).toBe(0);
    expect(compileCalls()).toBe(0);
    expect(text()).toContain(SEEDED_TITLE);

    // Pure navigation: no answer is touched anywhere on this walk.
    await clickLabel("继续优化", "clarify");
    await clickLabel("继续问题体检", "diagnose");
    await clickLabel("查看知乎已有讨论", "coverage");

    // Still visible while Coverage is on screen: the seeded retrieval, not a re-fetched one.
    expect(retrieveCalls()).toBe(0);
    expect(text()).toContain(SEEDED_COVERAGE);
    expect(text()).not.toContain(FIRST_COVERAGE);

    await clickLabel("编译我的问题", "result");

    expect(analyzeCalls()).toBe(0);
    expect(retrieveCalls()).toBe(0);
    expect(compileCalls()).toBe(0);
    // Same payload as before the walk: nothing was re-fetched and nothing was dropped. (The
    // Coverage text is gone here because Coverage itself is no longer mounted.)
    expect(text()).toContain(SEEDED_TITLE);
    expect(text()).not.toContain(FIRST_TITLE);
    expect(loadActiveQuestionSession()?.compiled).not.toBeNull();
  });

  test("R4: changing a clarification answer still invalidates retrieval and compilation", async () => {
    seedSession();
    await renderDemo();
    expect(stableStage()).toBe("result");

    await clickLabel("继续优化", "clarify");
    // The fixture question has two options; the other one is the change.
    await clickLabel("前端开发", "clarify");
    await clickLabel("继续问题体检", "diagnose");
    await clickLabel("查看知乎已有讨论", "coverage");

    // The changed answer must not silently reuse the old retrieval.
    expect(retrieveCalls()).toBe(1);
    expect(text()).toContain(FIRST_COVERAGE);
    expect(text()).not.toContain(SEEDED_COVERAGE);

    await clickLabel("编译我的问题", "result");

    expect(analyzeCalls()).toBe(0);
    expect(retrieveCalls()).toBe(1);
    expect(compileCalls()).toBe(1);
    expect(text()).toContain(FIRST_TITLE);
    expect(text()).not.toContain(SEEDED_TITLE);
  });

  test("R4b: re-picking the already selected answer does NOT invalidate anything", async () => {
    seedSession();
    await renderDemo();
    expect(stableStage()).toBe("result");

    await clickLabel("继续优化", "clarify");
    // Same value as the stored answer: nothing actually changed, so nothing may be invalidated.
    await clickLabel("AI 应用开发", "clarify");
    await clickLabel("继续问题体检", "diagnose");
    await clickLabel("查看知乎已有讨论", "coverage");

    expect(retrieveCalls()).toBe(0);
    expect(text()).toContain(SEEDED_COVERAGE);
    expect(text()).not.toContain(FIRST_COVERAGE);

    await clickLabel("编译我的问题", "result");

    expect(analyzeCalls()).toBe(0);
    expect(retrieveCalls()).toBe(0);
    expect(compileCalls()).toBe(0);
    expect(text()).toContain(SEEDED_TITLE);
    expect(text()).not.toContain(FIRST_TITLE);
  });

  test("R5: editing the raw question still invalidates the whole pipeline", async () => {
    seedSession();
    await renderDemo();
    expect(stableStage()).toBe("result");

    await clickLabel("继续优化", "clarify");
    await clickLabel("返回修改问题", "input");
    await retypeQuestion(RETYPE_QUESTION);

    await clickLabel("开始编译问题", "clarify");
    await clickLabel("继续问题体检", "diagnose");
    await clickLabel("查看知乎已有讨论", "coverage");

    // Checked while Coverage is mounted: the edited question produced a brand-new retrieval.
    expect(retrieveCalls()).toBe(1);
    expect(text()).toContain(FIRST_COVERAGE);
    expect(text()).not.toContain(SEEDED_COVERAGE);

    await clickLabel("编译我的问题", "result");

    expect(analyzeCalls()).toBe(1);
    expect(retrieveCalls()).toBe(1);
    expect(compileCalls()).toBe(1);
    expect(text()).toContain(FIRST_TITLE);
    expect(text()).not.toContain(SEEDED_TITLE);
  });
});

describe("result revisit after a refresh", () => {
  test("R6: a refreshed Result session renders its persisted compilation with no request", async () => {
    seedSession();
    await renderDemo();

    expect(stableStage()).toBe("result");
    expect(analyzeCalls()).toBe(0);
    expect(retrieveCalls()).toBe(0);
    expect(compileCalls()).toBe(0);

    // Content that survives any restyling: the publishable title plus the compiled details and
    // the publishable context.
    expect(text()).toContain(SEEDED_TITLE);
    expect(text()).toContain(SEEDED_COMPILED.compiledQuestion.background);
    expect(text()).toContain(SEEDED_COMPILED.publishableQuestion.context);
    expect(text()).not.toContain(FIRST_TITLE);
  });
});

describe("result revisit keeps the session store authoritative", () => {
  test("R7: reuse persists only the single active session in the existing store", async () => {
    seedSession();
    await renderDemo();

    await clickLabel("继续优化", "clarify");
    await clickLabel("继续问题体检", "diagnose");
    await clickLabel("查看知乎已有讨论", "coverage");
    await clickLabel("编译我的问题", "result");

    expect(analyzeCalls()).toBe(0);
    expect(retrieveCalls()).toBe(0);
    expect(compileCalls()).toBe(0);

    // No cache key, no second store: the reuse rides entirely on the existing Question Session.
    expect(Object.keys(window.localStorage).sort()).toEqual([
      "ask-better:session-index:v2",
      `ask-better:session:v2:${CONVERSATION_ID}`
    ]);
    expect(loadActiveQuestionSession()?.compiled).not.toBeNull();
  });
});
