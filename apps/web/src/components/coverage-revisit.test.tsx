// @vitest-environment jsdom
//
// Task 6 regression: revisiting Coverage must reuse the retrieval CompilerDemo already owns
// instead of re-running Retrieve. Assertions are call-count based on the real network boundary
// (`fetch`), because a second successful Retrieve renders the same kind of screen — only the
// request count proves reuse. Two *different* retrieval payloads are used so "reused" and
// "re-fetched" are distinguishable by content as well.
//
// Retrieval stays in the single authoritative store: the Question Session. Nothing here needs a
// cache, sessionStorage, a second localStorage key, a fingerprint, or an api-client change.
import type { QuestionAnalysis, RetrieveResult } from "@ask-better/domain";
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

function makeRetrieval(marker: string, evidenceCount: number): RetrieveResult {
  return {
    status: "success",
    evidenceStatus: "sufficient",
    queries: [`现在转码还有前途吗 ${marker}`],
    evidence: Array.from({ length: evidenceCount }, (_, index) => ({
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

/** A re-fetch would visibly swap this in, so reuse and re-fetch differ by content too. */
const FIRST = makeRetrieval("第一次检索", 3);
const SECOND = makeRetrieval("第二次检索", 5);

let container: HTMLDivElement | undefined;
let root: Root | undefined;
let fetchMock: ReturnType<typeof vi.fn>;
let createdContainers: HTMLDivElement[] = [];

function callsTo(fragment: string): number {
  return fetchMock.mock.calls.filter((call) => String(call[0]).includes(fragment)).length;
}
const retrieveCalls = () => callsTo("/api/question/retrieve");
const analyzeCalls = () => callsTo("/api/question/analyze");

/**
 * Realistic `matchMedia`. This matters: `StageTransitionViewport` gates its GSAP handoff timeline
 * on `gsap.matchMedia()` for `(prefers-reduced-motion: no-preference)` / `(prefers-reduced-motion:
 * reduce)`. A stub that answers `false` to everything (as in the recovery suite, which never
 * completes a transition) starts no timeline at all, so the scene stays half-swapped forever and
 * no stage can be asserted.
 *
 * The reduced-motion branch is answered truthfully here: it runs the same handoff, the same
 * `handleHandoffComplete`, and the same role swap, just with a 0.16s timeline instead of 0.68s.
 * That keeps an integration test that performs ~8 handoffs well inside its budget. The animated
 * branch is covered by the Task 7 browser verification of the real handoff.
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
    if (target.includes("/analyze")) return jsonResponse({ ok: true, data: analysis });
    if (target.includes("/retrieve")) {
      // `mock.calls` already contains this call, so counting PRIOR retrieves distinguishes a reused
      // first payload from a re-fetched second one.
      const priorRetrieves = retrieveCalls() - 1;
      return jsonResponse({ ok: true, data: priorRetrieves === 0 ? FIRST : SECOND });
    }
    if (target.includes("/compile")) throw new Error("compile must not run in this test");
    throw new Error(`unexpected request: ${target}`);
  });
  vi.stubGlobal("fetch", fetchMock);
}

function seedDiagnoseSession(overrides: Partial<QuestionSessionDraft> = {}) {
  const draft: QuestionSessionDraft = {
    conversationId: "conv-coverage-revisit",
    createdAt: 1_700_000_000_000,
    stage: "diagnose",
    rawQuestion: "现在转码还有前途吗？",
    answers: { direction: "AI 应用开发" },
    analysis,
    retrieval: null,
    compiled: null,
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

/** Unmount + mount against the same storage, which is what a browser refresh does here. */
async function remountDemo() {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  root = undefined;
  container?.remove();
  container = undefined;
  return renderDemo();
}

async function tick(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/** Lets the 250 ms autosave debounce fire so what is on disk matches what is on screen. */
const flushAutosave = () => tick(320);

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
function allStages(): string[] {
  return Array.from(container?.querySelectorAll("[data-stage]") ?? []).map(
    (element) => element.getAttribute("data-stage") ?? ""
  );
}
function text(): string {
  return container?.textContent ?? "";
}

function findButton(scope: ParentNode, label: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll("button")).find((item) =>
    item.textContent?.trim().includes(label)
  );
  expect(button, `button not found: ${label}`).toBeDefined();
  return button as HTMLButtonElement;
}

/** Clicks a control and waits for the resulting scene handoff to settle. */
async function clickLabel(label: string, expectedStage?: string) {
  const button = findButton(container as HTMLElement, label);
  await act(async () => {
    button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
  await settleTransition();
  if (expectedStage) expect(stableStage()).toBe(expectedStage);
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

/** Diagnose (restored from storage, no request) -> Clarify -> Diagnose with a fresh answer. */
async function changeAnswer(nextOption: string) {
  await clickLabel("返回补充信息", "clarify");
  await clickLabel(nextOption);
  await clickLabel("继续问题体检", "diagnose");
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

describe("coverage revisit reuses the owned retrieval", () => {
  test("re-entering Coverage from Diagnose does not call Retrieve again", async () => {
    seedDiagnoseSession();
    await renderDemo();

    // A restored Diagnose session replays nothing on mount.
    expect(stableStage()).toBe("diagnose");
    expect(retrieveCalls()).toBe(0);
    expect(analyzeCalls()).toBe(0);

    // First Diagnose -> Coverage: exactly one Retrieve, and its result is rendered.
    await clickLabel("查看知乎已有讨论", "coverage");
    expect(retrieveCalls()).toBe(1);
    expect(text()).toContain(FIRST.existingCoverage[0].title);
    expect(text()).toContain(FIRST.evidence[0].title);

    // Coverage -> Diagnose must keep the retrieval.
    await clickLabel("返回问题体检", "diagnose");
    expect(retrieveCalls()).toBe(1);
    expect(text()).not.toContain(FIRST.existingCoverage[0].title);

    // Same Diagnose -> Coverage again: no new request and the FIRST retrieval is shown.
    await clickLabel("查看知乎已有讨论", "coverage");
    expect(retrieveCalls()).toBe(1);
    expect(text()).toContain(FIRST.existingCoverage[0].title);
    expect(text()).toContain(FIRST.evidence[0].title);
    expect(text()).not.toContain(SECOND.existingCoverage[0].title);
    expect(analyzeCalls()).toBe(0);
  });

  test("revisiting twice in a row still reuses the same retrieval", async () => {
    seedDiagnoseSession();
    await renderDemo();

    for (let visit = 0; visit < 3; visit += 1) {
      await clickLabel("查看知乎已有讨论", "coverage");
      expect(retrieveCalls(), `retrieve count after visit ${visit + 1}`).toBe(1);
      expect(text()).toContain(FIRST.existingCoverage[0].title);
      if (visit < 2) await clickLabel("返回问题体检", "diagnose");
    }
  });

  test("changing a clarification answer invalidates the retrieval and refetches", async () => {
    seedDiagnoseSession();
    await renderDemo();

    await clickLabel("查看知乎已有讨论", "coverage");
    expect(retrieveCalls()).toBe(1);
    expect(text()).toContain(FIRST.existingCoverage[0].title);

    // Coverage -> Diagnose -> Clarify, then change the answer.
    await clickLabel("返回问题体检", "diagnose");
    await changeAnswer("前端开发");

    // The changed answer must not silently reuse the old retrieval.
    await clickLabel("查看知乎已有讨论", "coverage");
    expect(retrieveCalls()).toBe(2);
    expect(text()).toContain(SECOND.existingCoverage[0].title);
    expect(text()).not.toContain(FIRST.existingCoverage[0].title);
  });

  test("changing the raw question invalidates the retrieval and refetches", async () => {
    seedDiagnoseSession();
    await renderDemo();

    await clickLabel("查看知乎已有讨论", "coverage");
    expect(retrieveCalls()).toBe(1);

    // Walk back to Input the way a user would: the question can only be edited there.
    await clickLabel("返回问题体检", "diagnose");
    await clickLabel("返回补充信息", "clarify");
    await clickLabel("返回修改问题", "input");
    await retypeQuestion("现在转码还有前途吗？换个问法。");

    await clickLabel("开始编译问题", "clarify");
    await clickLabel("继续问题体检", "diagnose");
    await clickLabel("查看知乎已有讨论", "coverage");

    expect(retrieveCalls()).toBe(2);
    expect(text()).toContain(SECOND.existingCoverage[0].title);
    expect(text()).not.toContain(FIRST.existingCoverage[0].title);
  });

  test("新建问题 clears the current retrieval so the next visit refetches", async () => {
    seedDiagnoseSession();
    await renderDemo();

    await clickLabel("查看知乎已有讨论", "coverage");
    expect(retrieveCalls()).toBe(1);

    // New Question remounts the scene and empties the question, so no handoff is involved.
    await clickLabel("新建问题", "input");
    expect((container?.querySelector("textarea") as HTMLTextAreaElement | null)?.value).toBe("");

    await retypeQuestion("转码之外还有别的出路吗？");
    await clickLabel("开始编译问题", "clarify");
    await clickLabel("继续问题体检", "diagnose");
    await clickLabel("查看知乎已有讨论", "coverage");

    expect(retrieveCalls()).toBe(2);
    expect(text()).toContain(SECOND.existingCoverage[0].title);
    expect(text()).not.toContain(FIRST.existingCoverage[0].title);
  });
});

describe("coverage revisit after a session restore", () => {
  test("a refreshed Diagnose session reuses its persisted retrieval with no new request", async () => {
    seedDiagnoseSession();
    await renderDemo();

    await clickLabel("查看知乎已有讨论", "coverage");
    expect(retrieveCalls()).toBe(1);

    // Back to Diagnose, then let the autosave commit the stable stage together with the retrieval.
    await clickLabel("返回问题体检", "diagnose");
    await flushAutosave();

    const persisted = loadActiveQuestionSession();
    expect(persisted).not.toBeNull();
    expect(persisted?.stage).toBe("diagnose");
    expect(persisted?.retrieval).not.toBeNull();
    expect(persisted?.retrieval?.existingCoverage[0]?.title).toBe(FIRST.existingCoverage[0].title);
    expect(persisted?.retrieval?.evidence).toHaveLength(FIRST.evidence.length);

    // Refresh: a brand new mount reading the same storage.
    await remountDemo();

    expect(stableStage()).toBe("diagnose");
    expect(retrieveCalls()).toBe(1);
    expect(analyzeCalls()).toBe(0);
    // The restored Diagnose scene renders the restored question (answers live on the Clarify
    // stage, so they are asserted from storage instead).
    expect(text()).toContain("现在转码还有前途吗？");
    expect(loadActiveQuestionSession()?.answers).toEqual({ direction: "AI 应用开发" });

    // The restored retrieval is reused: immediate Coverage, still no new Retrieve.
    await clickLabel("查看知乎已有讨论", "coverage");
    expect(retrieveCalls()).toBe(1);
    expect(text()).toContain(FIRST.existingCoverage[0].title);
    expect(text()).toContain(FIRST.evidence[0].title);
    expect(text()).not.toContain(SECOND.existingCoverage[0].title);
  });

  test("a refreshed session that had not retrieved yet does fetch once on the next visit", async () => {
    seedDiagnoseSession();
    await renderDemo();

    await flushAutosave();
    const beforeRefresh = loadActiveQuestionSession();
    expect(beforeRefresh?.retrieval).toBeNull();

    await remountDemo();
    expect(stableStage()).toBe("diagnose");
    await clickLabel("查看知乎已有讨论", "coverage");

    expect(retrieveCalls()).toBe(1);
    expect(text()).toContain(FIRST.existingCoverage[0].title);
  });

  test("a refreshed Coverage session renders its persisted retrieval without any request", async () => {
    seedDiagnoseSession();
    await renderDemo();

    await clickLabel("查看知乎已有讨论", "coverage");
    await flushAutosave();
    expect(retrieveCalls()).toBe(1);

    const session = loadActiveQuestionSession();
    expect(session?.stage).toBe("coverage");
    expect(session?.retrieval).not.toBeNull();

    await remountDemo();

    expect(stableStage()).toBe("coverage");
    expect(retrieveCalls()).toBe(1);
    expect(text()).toContain(FIRST.existingCoverage[0].title);
  });
});

describe("coverage revisit keeps the session store authoritative", () => {
  test("reuse persists only the single active session in the existing store", async () => {
    seedDiagnoseSession();
    await renderDemo();

    await clickLabel("查看知乎已有讨论", "coverage");
    await clickLabel("返回问题体检", "diagnose");
    await clickLabel("查看知乎已有讨论", "coverage");
    await flushAutosave();
    expect(retrieveCalls()).toBe(1);

    // No cache key, no second store: the reuse rides entirely on the existing Question Session.
    expect(Object.keys(window.localStorage).sort()).toEqual([
      "ask-better:session-index:v2",
      "ask-better:session:v2:conv-coverage-revisit"
    ]);

    const persisted = loadActiveQuestionSession();
    expect(persisted?.conversationId).toBe("conv-coverage-revisit");
    expect(persisted?.stage).toBe("coverage");
    expect(persisted?.retrieval?.existingCoverage[0]?.title).toBe(FIRST.existingCoverage[0].title);
  });
});
