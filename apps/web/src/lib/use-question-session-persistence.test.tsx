// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import * as storageModule from "./question-session-storage";
import { QUESTION_SESSION_AUTOSAVE_MS, type QuestionSessionDraft } from "./question-session-storage";
import { useQuestionSessionPersistence } from "./use-question-session-persistence";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function buildDraft(overrides: Partial<QuestionSessionDraft> = {}): QuestionSessionDraft {
  return {
    conversationId: "conv-hook",
    createdAt: 1_700_000_000_000,
    stage: "input",
    rawQuestion: "相",
    answers: {},
    analysis: null,
    retrieval: null,
    compiled: null,
    ...overrides
  };
}

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

async function unmountHarness() {
  await act(async () => root?.unmount());
  root = undefined;
}

afterEach(async () => {
  if (root) await unmountHarness();
  container?.remove();
  container = undefined;
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
  await act(async () => {
    vi.advanceTimersByTime(QUESTION_SESSION_AUTOSAVE_MS);
  });

  expect(saveSpy).toHaveBeenCalledTimes(1);
  expect(saveSpy).toHaveBeenLastCalledWith(expect.objectContaining({ rawQuestion: "相机怎么选" }));
});

test("does not autosave before the debounce elapses", async () => {
  vi.useFakeTimers();
  const saveSpy = vi.spyOn(storageModule, "saveQuestionSession").mockReturnValue(true);

  await renderHarness(buildDraft());
  await act(async () => {
    vi.advanceTimersByTime(QUESTION_SESSION_AUTOSAVE_MS - 1);
  });

  expect(saveSpy).not.toHaveBeenCalled();
});

test("a null draft never writes", async () => {
  vi.useFakeTimers();
  const saveSpy = vi.spyOn(storageModule, "saveQuestionSession").mockReturnValue(true);

  await renderHarness(null);
  await act(async () => {
    vi.advanceTimersByTime(QUESTION_SESSION_AUTOSAVE_MS * 4);
  });
  window.dispatchEvent(new PageTransitionEvent("pagehide"));
  await unmountHarness();

  expect(saveSpy).not.toHaveBeenCalled();
});

test("flushes synchronously on pagehide with the latest draft", async () => {
  vi.useFakeTimers();
  const saveSpy = vi.spyOn(storageModule, "saveQuestionSession").mockReturnValue(true);

  await renderHarness(buildDraft({ rawQuestion: "最新文本" }));

  await act(async () => {
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
  });

  expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ rawQuestion: "最新文本" }));
});

test("flushes when the document becomes hidden", async () => {
  vi.useFakeTimers();
  const saveSpy = vi.spyOn(storageModule, "saveQuestionSession").mockReturnValue(true);

  await renderHarness(buildDraft({ rawQuestion: "最新文本" }));

  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

  expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ rawQuestion: "最新文本" }));
});

test("does not flush on visibilitychange while the document is visible", async () => {
  vi.useFakeTimers();
  const saveSpy = vi.spyOn(storageModule, "saveQuestionSession").mockReturnValue(true);

  await renderHarness(buildDraft({ rawQuestion: "最新文本" }));

  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

  expect(saveSpy).not.toHaveBeenCalled();
});

test("flushes on unmount so a client-side page switch is not lost", async () => {
  vi.useFakeTimers();
  const saveSpy = vi.spyOn(storageModule, "saveQuestionSession").mockReturnValue(true);

  await renderHarness(buildDraft({ rawQuestion: "最新文本" }));
  await unmountHarness();

  expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ rawQuestion: "最新文本" }));
});

test("a pending debounce is cancelled by an explicit flush", async () => {
  vi.useFakeTimers();
  const saveSpy = vi.spyOn(storageModule, "saveQuestionSession").mockReturnValue(true);

  await renderHarness(buildDraft({ rawQuestion: "最新文本" }));
  await act(async () => {
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
  });
  await act(async () => {
    vi.advanceTimersByTime(QUESTION_SESSION_AUTOSAVE_MS * 2);
  });

  expect(saveSpy).toHaveBeenCalledTimes(1);
});

test("a storage failure during flush does not throw", async () => {
  vi.useFakeTimers();
  vi.spyOn(storageModule, "saveQuestionSession").mockReturnValue(false);

  await renderHarness(buildDraft());
  await expect(
    act(async () => {
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    })
  ).resolves.toBeUndefined();
});
