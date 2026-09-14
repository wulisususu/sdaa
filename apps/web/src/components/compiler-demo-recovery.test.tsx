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
  answers: { market: "国内市场" },
  analysis: {
    intent: ["评估转码前景"],
    primaryGoal: "判断现在转码是否仍有前途",
    timeSensitive: true,
    ambiguities: [],
    missingContext: [],
    clarificationQuestions: [],
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
let root: Root;

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
    root.render(<CompilerDemo />);
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

async function clickButton(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
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
      root.unmount();
    });
  }
  container?.remove();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("compiler demo session recovery", () => {
  test("recovery card 新问题 fully resets draft state and clears the persisted session", async () => {
    await renderDemo();

    // The recovery card surfaces the stored session on the input stage.
    const card = container.querySelector(".resume-session-card");
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain("现在转码还有前途吗？");

    // The user types a different draft before discarding the recovery card.
    await act(async () => {
      typeIntoTextarea("孩子上小学，课后托管怎么选？");
    });
    expect(container.querySelector("textarea")?.value).toBe("孩子上小学，课后托管怎么选？");

    const newQuestionButton = Array.from(container.querySelectorAll(".resume-session-card button")).find(
      (button) => button.textContent?.includes("新问题")
    ) as HTMLButtonElement | undefined;
    expect(newQuestionButton).toBeDefined();

    await clickButton(newQuestionButton as HTMLButtonElement);

    // Persisted record removed.
    expect(window.localStorage.getItem(COMPLETED_SESSION_STORAGE_KEY)).toBeNull();
    // Clean input state: draft cleared, card gone, still on the input stage.
    expect(container.querySelector("textarea")?.value).toBe("");
    expect(container.querySelector(".resume-session-card")).toBeNull();
    expect(container.querySelector('[data-stage="input"]')).not.toBeNull();
  });

  test("recovery card stays hidden when no valid session exists", async () => {
    window.localStorage.clear();
    await renderDemo();

    expect(container.querySelector(".resume-session-card")).toBeNull();
    expect(container.querySelector('[data-stage="input"]')).not.toBeNull();
  });
});
