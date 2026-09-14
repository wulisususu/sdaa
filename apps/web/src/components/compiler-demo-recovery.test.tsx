// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  COMPLETED_SESSION_STORAGE_KEY,
  type StoredCompletedSessionV1
} from "../lib/completed-session-storage";
import { CompilerDemo } from "./compiler-demo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const savedSession: StoredCompletedSessionV1 = {
  version: 1,
  savedAt: 1_700_000_000_000,
  rawQuestion: "现在转码还有前途吗？",
  answers: { direction: "AI 应用开发" },
  analysis: {
    intent: ["评估转码前景"],
    primaryGoal: "判断现在转码是否仍有前途",
    timeSensitive: true,
    ambiguities: [],
    missingContext: [],
    clarificationQuestions: [
      {
        id: "direction",
        question: "你更想转向哪个方向？",
        options: ["AI 应用开发", "前端开发"]
      }
    ],
    diagnostics: []
  },
  retrieval: {
    status: "success",
    evidenceStatus: "sufficient",
    queries: ["现在转码还有前途吗"],
    evidence: [],
    existingCoverage: [],
    knowledgeGaps: []
  },
  compiled: {
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
  }
};

let container: HTMLDivElement;
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
}

function findButton(scope: ParentNode, label: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll("button")).find(
    (item) => item.textContent?.trim().includes(label)
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
  const textarea = container.querySelector("textarea");
  expect(textarea).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  expect(setter).toBeDefined();
  setter?.call(textarea, value);
  textarea?.dispatchEvent(new window.Event("input", { bubbles: true }));
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000 + 60_000);
  stubMatchMedia();
  window.localStorage.clear();
  window.localStorage.setItem(COMPLETED_SESSION_STORAGE_KEY, JSON.stringify(savedSession));
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  root = undefined;
  container?.remove();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("compiler demo session recovery", () => {
  test("继续上次 hydrates directly into a stable Result without API calls", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await renderDemo();

    const card = container.querySelector(".resume-session-card");
    expect(card).not.toBeNull();
    await clickButton(findButton(card as HTMLElement, "继续上次"));

    expect(container.querySelector('[data-stage="result"][data-scene-role="stable"]')).not.toBeNull();
    expect(container.querySelector('[data-scene-role="outgoing"]')).toBeNull();
    expect(container.querySelector('[data-scene-role="incoming"]')).toBeNull();
    expect(container.textContent).toContain(savedSession.compiled.publishableQuestion.title);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("recovery-card 新问题 fully resets draft state and clears persistence", async () => {
    await renderDemo();

    const card = container.querySelector(".resume-session-card");
    expect(card).not.toBeNull();

    await act(async () => {
      typeIntoTextarea("孩子上小学，课后托管怎么选？");
    });
    expect(container.querySelector("textarea")?.value).toBe("孩子上小学，课后托管怎么选？");

    await clickButton(findButton(card as HTMLElement, "新问题"));

    expect(window.localStorage.getItem(COMPLETED_SESSION_STORAGE_KEY)).toBeNull();
    expect(container.querySelector("textarea")?.value).toBe("");
    expect(container.querySelector(".resume-session-card")).toBeNull();
    expect(container.querySelector('[data-stage="input"][data-scene-role="stable"]')).not.toBeNull();
  });

  test("打开知乎 persists first, opens the verified root target, and storage failure never blocks", async () => {
    await renderDemo();
    await clickButton(findButton(container, "继续上次"));

    const order: string[] = [];
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      order.push("save");
      return originalSetItem.call(this, key, value);
    });
    const openSpy = vi.spyOn(window, "open").mockImplementation((url, target, features) => {
      order.push("open");
      expect(url).toBe("https://www.zhihu.com/");
      expect(target).toBe("_blank");
      expect(features).toBe("noopener,noreferrer");
      return null;
    });

    await clickButton(findButton(container, "打开知乎"));
    expect(order.slice(0, 2)).toEqual(["save", "open"]);
    expect(openSpy).toHaveBeenCalledTimes(1);

    vi.mocked(Storage.prototype.setItem).mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    await clickButton(findButton(container, "打开知乎"));
    expect(openSpy).toHaveBeenCalledTimes(2);
  });

  test("restored Result keeps copy, continue-optimization, and new-question actions usable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    await renderDemo();
    await clickButton(findButton(container, "继续上次"));

    await clickButton(findButton(container, "复制"));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("已复制");

    await clickButton(findButton(container, "继续优化"));
    expect(container.querySelector('[data-stage="clarify"]')).not.toBeNull();
  });

  test("restored Result 新问题 clears the stored session and returns to clean Input", async () => {
    await renderDemo();
    await clickButton(findButton(container, "继续上次"));
    await clickButton(findButton(container, "新问题"));

    expect(window.localStorage.getItem(COMPLETED_SESSION_STORAGE_KEY)).toBeNull();
    expect(container.querySelector('[data-stage="input"][data-scene-role="stable"]')).not.toBeNull();
    expect(container.querySelector("textarea")?.value).toBe("");
  });

  test("recovery card stays hidden when no valid session exists", async () => {
    window.localStorage.clear();
    await renderDemo();

    expect(container.querySelector(".resume-session-card")).toBeNull();
    expect(container.querySelector('[data-stage="input"]')).not.toBeNull();
  });
});
