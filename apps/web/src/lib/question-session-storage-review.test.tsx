/**
 * Regression suite for defects found during implementation review.
 *
 * The headline case: the session index is a single JSON document, so one oversized
 * `rawQuestion` used to make the whole index unparseable — every session disappeared from
 * History and active restore returned null, while the payloads sat intact on disk. The Input
 * stage now caps typing at the schema maximum and the store rejects unreadable payloads.
 */
import { describe, expect, test, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import {
  PERSISTED_RAW_QUESTION_MAX,
  QUESTION_SESSION_INDEX_KEY,
  QUESTION_SESSION_KEY_PREFIX,
  listRecentQuestionSessions,
  loadActiveQuestionSession,
  loadQuestionSession,
  saveQuestionSession,
  type QuestionSessionDraft
} from "./question-session-storage";
import { InputStage } from "../components/input-stage";

type MemoryStorage = Storage & { map: Map<string, string> };

function createMemoryStorage(): MemoryStorage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    map
  } as MemoryStorage;
}

function stubWindow(storage: Storage) {
  vi.stubGlobal("window", { localStorage: storage });
}

function draft(overrides: Partial<QuestionSessionDraft> = {}): QuestionSessionDraft {
  return {
    conversationId: "c", createdAt: 1, stage: "input", rawQuestion: "问题",
    answers: {}, analysis: null, retrieval: null, compiled: null, ...overrides
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("oversized question cannot corrupt the session index", () => {
  test("a question beyond the schema maximum is refused and leaves history intact", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);

    saveQuestionSession(draft({ conversationId: "good1", rawQuestion: "正常问题一" }), 1000);
    saveQuestionSession(draft({ conversationId: "good2", rawQuestion: "正常问题二" }), 1001);
    saveQuestionSession(draft({ conversationId: "good3", rawQuestion: "正常问题三" }), 1002);
    expect(listRecentQuestionSessions()).toHaveLength(3);

    const oversized = "问".repeat(PERSISTED_RAW_QUESTION_MAX + 1);
    expect(saveQuestionSession(draft({ conversationId: "long", rawQuestion: oversized }), 1003)).toBe(false);

    // The three healthy sessions must remain visible AND restorable.
    expect(listRecentQuestionSessions()).toHaveLength(3);
    expect(loadActiveQuestionSession()).not.toBeNull();
    expect(loadQuestionSession("good1")).not.toBeNull();
    // Nothing was written for the refused draft.
    expect(storage.getItem(`${QUESTION_SESSION_KEY_PREFIX}long`)).toBeNull();
    expect(JSON.parse(storage.getItem(QUESTION_SESSION_INDEX_KEY) as string).entries).toHaveLength(3);
  });

  test("a question exactly at the maximum is accepted", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    const atLimit = "问".repeat(PERSISTED_RAW_QUESTION_MAX);
    expect(saveQuestionSession(draft({ conversationId: "at-limit", rawQuestion: atLimit }), 1000)).toBe(true);
    expect(listRecentQuestionSessions()).toHaveLength(1);
    expect(loadActiveQuestionSession()).not.toBeNull();
  });

  test("the Input textarea caps typing at the same maximum the API accepts", () => {
    const html = renderToStaticMarkup(
      <InputStage rawQuestion="短问题" ready onChange={() => undefined} onContinue={() => undefined} />
    );

    // React renders the attribute as maxLength in static markup.
    expect(html).toMatch(new RegExp(`maxlength="${PERSISTED_RAW_QUESTION_MAX}"`, "i"));
  });

  test("a payload the schema cannot read back is rejected rather than serialized", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    // A hostile answer map defeats the type system; the store must not persist it.
    const hostile = {
      ...draft({ conversationId: "hostile" }),
      answers: { toJSON() { throw new Error("boom"); } }
    } as unknown as QuestionSessionDraft;

    let threw = false;
    try {
      saveQuestionSession(hostile, 1000);
    } catch {
      threw = true;
    }
    // Either outcome is acceptable as long as the store stays readable; an escaping throw is not.
    expect(threw).toBe(false);
    expect(storage.getItem(`${QUESTION_SESSION_KEY_PREFIX}hostile`)).toBeNull();
  });

  test("unknown extra fields are not persisted into the stored envelope", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    // Spreading a wider object must not smuggle transient UI state into storage.
    saveQuestionSession(
      { ...draft({ conversationId: "wide" }), operation: "analyzing", error: "boom" } as QuestionSessionDraft,
      1000
    );
    const raw = storage.getItem(`${QUESTION_SESSION_KEY_PREFIX}wide`) as string;
    expect(raw).not.toContain('"operation"');
    expect(raw).not.toContain('"error"');
  });
});
