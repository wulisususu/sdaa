// @vitest-environment jsdom
import type { QuestionAnalysis, RetrieveResult, CompileResult } from "@ask-better/domain";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LEGACY_COMPLETED_SESSION_STORAGE_KEY } from "../lib/question-session-storage";
import {
  QUESTION_SESSION_INDEX_KEY,
  QUESTION_SESSION_KEY_PREFIX,
  listRecentQuestionSessions,
  loadQuestionSession,
  saveQuestionSession,
  setActiveConversationId,
  type QuestionSessionDraft
} from "../lib/question-session-storage";
import { CompilerDemo } from "./compiler-demo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const retrieval: RetrieveResult = {
  status: "success",
  evidenceStatus: "sufficient",
  queries: ["现在转码还有前途吗"],
  evidence: [],
  existingCoverage: [{ id: "c1", title: "转码趋势", detail: "已有讨论覆盖趋势。", strength: "medium" }],
  knowledgeGaps: []
};

const compiled: CompileResult = {
  compiledQuestion: {
    title: "2026 年转码前景评估",
    background: "提问者正在考虑转行做软件开发。",
    goal: "判断现在转码是否仍有前途。",
    constraints: ["关注国内就业市场"],
    coreUncertainty: "当前转码的投入产出比是否仍然合理。",
    expectedAnswer: ["近三年转码就业趋势", "不同背景转码的难度差异"]
  },
  publishableQuestion: {
    title: "2026 年了，现在转码还有前途吗？",
    context: "我正在考虑转行做软件开发，想基于当前国内就业市场认真评估一次再决定。",
    questions: ["近三年转码就业的真实趋势如何？"]
  },
  evidenceUsed: false
};

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function stubMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
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

async function renderDemo() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<CompilerDemo />);
  });
  return container;
}

function findButton(scope: ParentNode, label: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll("button")).find((item) =>
    item.textContent?.trim().includes(label)
  );
  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

async function clickButton(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
}

function typeIntoTextarea(value: string) {
  const textarea = container?.querySelector("textarea");
  expect(textarea).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  expect(setter).toBeDefined();
  setter?.call(textarea, value);
  textarea?.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function seedActiveSession(overrides: Partial<QuestionSessionDraft> = {}) {
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
  expect(saveQuestionSession(draft, 1_700_000_100_000)).toBe(true);
  return draft;
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(1_700_000_200_000);
  stubMatchMedia();
  window.localStorage.clear();
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  root = undefined;
  container?.remove();
  container = undefined;
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("compiler demo stable-stage recovery", () => {
  test("reload restores an active Clarify session with its questions and no API replay", async () => {
    seedActiveSession();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await renderDemo();

    expect(container?.querySelector('[data-stage="clarify"][data-scene-role="stable"]')).not.toBeNull();
    expect(container?.querySelector('[data-scene-role="outgoing"]')).toBeNull();
    // Clarify is single-question focus, so the restored analysis is proven by the focused
    // question rendering rather than by an answer of a later question.
    expect(container?.textContent).toContain("你更想转向哪个方向？");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("reload restores a Diagnose session without replaying Analyze", async () => {
    seedActiveSession({ stage: "diagnose", answers: { direction: "AI 应用开发" } });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await renderDemo();

    expect(container?.querySelector('[data-stage="diagnose"][data-scene-role="stable"]')).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("reload restores a Coverage session without replaying Retrieve", async () => {
    seedActiveSession({ stage: "coverage", retrieval });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await renderDemo();

    expect(container?.querySelector('[data-stage="coverage"][data-scene-role="stable"]')).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("reload restores a Result session without replaying Compile", async () => {
    seedActiveSession({ stage: "result", retrieval, compiled });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await renderDemo();

    expect(container?.querySelector('[data-stage="result"][data-scene-role="stable"]')).not.toBeNull();
    expect(container?.textContent).toContain(compiled.publishableQuestion.title);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("keeps a short Input draft and its exact text", async () => {
    seedActiveSession({
      conversationId: "conv-short",
      stage: "input",
      rawQuestion: "买",
      answers: {},
      analysis: null,
      retrieval: null,
      compiled: null
    });

    await renderDemo();

    expect(container?.querySelector('[data-stage="input"][data-scene-role="stable"]')).not.toBeNull();
    expect(container?.querySelector("textarea")?.value).toBe("买");
  });

  test("restores Clarify answers from the latest saved map", async () => {
    seedActiveSession({ stage: "clarify", answers: { direction: "前端开发" } });

    await renderDemo();

    expect(container?.textContent).toContain("前端开发");
  });

  test("downgrades a logically incomplete Result to Coverage", async () => {
    seedActiveSession({ stage: "result", retrieval, compiled: null });

    await renderDemo();

    expect(container?.querySelector('[data-stage="coverage"][data-scene-role="stable"]')).not.toBeNull();
    expect(container?.querySelector('[data-stage="result"]')).toBeNull();
  });

  test("an untouched landing page creates no session", async () => {
    await renderDemo();

    expect(container?.querySelector('[data-stage="input"][data-scene-role="stable"]')).not.toBeNull();
    expect(listRecentQuestionSessions()).toHaveLength(0);
    expect(window.localStorage.getItem(QUESTION_SESSION_INDEX_KEY)).toBeNull();
  });

  test("starts a conversation id once the user types a non-empty question", async () => {
    vi.useFakeTimers();
    try {
      await renderDemo();

      await act(async () => {
        typeIntoTextarea("现在转码还有前途吗？");
      });
      // The session is written by the debounced autosave, not synchronously on keystroke.
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      const recent = listRecentQuestionSessions();
      expect(recent.length).toBeGreaterThan(0);
      expect(recent[0]?.rawQuestion).toBe("现在转码还有前途吗？");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("compiler demo pending-operation recovery", () => {
  test("a persisted Input stage during a pending Analyze restores idle Input, not loading", async () => {
    seedActiveSession({
      conversationId: "conv-pending-analyze",
      stage: "input",
      rawQuestion: "现在转码还有前途吗？",
      answers: {},
      analysis: null,
      retrieval: null,
      compiled: null
    });

    await renderDemo();

    expect(container?.querySelector('[data-stage="input"][data-scene-role="stable"]')).not.toBeNull();
    expect(container?.textContent).not.toContain("正在理解你的问题");
  });

  test("a persisted Diagnose stage during a pending Retrieve restores idle Diagnose", async () => {
    seedActiveSession({ conversationId: "conv-pending-retrieve", stage: "diagnose" });

    await renderDemo();

    expect(container?.querySelector('[data-stage="diagnose"][data-scene-role="stable"]')).not.toBeNull();
    expect(container?.textContent).not.toContain("正在知乎已有讨论中查找相关内容");
  });

  test("a persisted Coverage stage during a pending Compile restores idle Coverage", async () => {
    seedActiveSession({ conversationId: "conv-pending-compile", stage: "coverage", retrieval });

    await renderDemo();

    expect(container?.querySelector('[data-stage="coverage"][data-scene-role="stable"]')).not.toBeNull();
    expect(container?.textContent).not.toContain("正在把信息编译成一个更清楚的问题");
  });
});

describe("compiler demo new question and history retention", () => {
  test("新建问题 clears the active pointer but keeps the previous session loadable", async () => {
    const draft = seedActiveSession({ stage: "clarify" });
    await renderDemo();

    await clickButton(findButton(container as HTMLElement, "新建问题"));

    expect(container?.querySelector('[data-stage="input"][data-scene-role="stable"]')).not.toBeNull();
    expect(container?.querySelector("textarea")?.value).toBe("");
    expect(loadQuestionSession(draft.conversationId)).not.toBeNull();
    expect(listRecentQuestionSessions().map((entry) => entry.conversationId)).toContain(
      draft.conversationId
    );
  });
});

describe("compiler demo legacy migration", () => {
  test("migrates a valid legacy completed session and restores its Result", async () => {
    window.localStorage.setItem(
      LEGACY_COMPLETED_SESSION_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: 1_700_000_000_000,
        rawQuestion: "现在转码还有前途吗？",
        answers: {},
        analysis,
        retrieval,
        compiled
      })
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await renderDemo();

    expect(container?.querySelector('[data-stage="result"][data-scene-role="stable"]')).not.toBeNull();
    expect(window.localStorage.getItem(LEGACY_COMPLETED_SESSION_STORAGE_KEY)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(
      listRecentQuestionSessions().some((entry) => entry.rawQuestion === "现在转码还有前途吗？")
    ).toBe(true);
  });

  test("an expired legacy session does not restore and is dropped", async () => {
    window.localStorage.setItem(
      LEGACY_COMPLETED_SESSION_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: 1_700_000_000_000,
        rawQuestion: "现在转码还有前途吗？",
        answers: {},
        analysis,
        retrieval,
        compiled
      })
    );
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000 + 24 * 60 * 60 * 1000 + 1);

    await renderDemo();

    expect(container?.querySelector('[data-stage="input"][data-scene-role="stable"]')).not.toBeNull();
    expect(window.localStorage.getItem(LEGACY_COMPLETED_SESSION_STORAGE_KEY)).toBeNull();
  });

  test("a corrupt session key leaves the app usable", async () => {
    window.localStorage.setItem(`${QUESTION_SESSION_KEY_PREFIX}conv-corrupt`, "{ not valid json");
    window.localStorage.setItem(
      QUESTION_SESSION_INDEX_KEY,
      JSON.stringify({
        version: 2,
        activeConversationId: "conv-corrupt",
        entries: [
          {
            conversationId: "conv-corrupt",
            rawQuestion: "坏掉的问题",
            stage: "clarify",
            createdAt: 1,
            updatedAt: 2
          }
        ]
      })
    );

    await renderDemo();

    expect(container?.querySelector('[data-stage="input"][data-scene-role="stable"]')).not.toBeNull();
    expect(window.localStorage.getItem(`${QUESTION_SESSION_KEY_PREFIX}conv-corrupt`)).toBeNull();
  });

  test("storage denial never blocks rendering", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    await renderDemo();

    expect(container?.querySelector('[data-stage="input"][data-scene-role="stable"]')).not.toBeNull();
  });
});
