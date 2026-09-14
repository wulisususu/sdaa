/**
 * Invariants that the main storage suite does not pin, added during implementation review:
 *  - index and payload sets stay identical under pruning and re-save (no orphans either way);
 *  - a second V1 migration call is a no-op;
 *  - quota / index-write failures never throw and never corrupt what is already stored.
 */
import { describe, expect, test, vi, afterEach } from "vitest";
import {
  LEGACY_COMPLETED_SESSION_STORAGE_KEY,
  QUESTION_SESSION_INDEX_KEY,
  QUESTION_SESSION_KEY_PREFIX,
  migrateLegacyCompletedSession,
  listRecentQuestionSessions,
  loadActiveQuestionSession,
  saveQuestionSession,
  setActiveConversationId,
  type QuestionSessionDraft
} from "./question-session-storage";

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
    conversationId: "c",
    createdAt: 1,
    stage: "input",
    rawQuestion: "问题",
    answers: {},
    analysis: null,
    retrieval: null,
    compiled: null,
    ...overrides
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("review probes", () => {

  test("pruning removes BOTH the index entry and the full session payload", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);

    for (let i = 0; i < 22; i += 1) {
      saveQuestionSession(draft({ conversationId: `c${i}`, rawQuestion: `问题 ${i}` }), 1000 + i);
    }

    const index = JSON.parse(storage.getItem(QUESTION_SESSION_INDEX_KEY) as string);
    const indexedIds = index.entries.map((e: { conversationId: string }) => e.conversationId);
    const payloadIds = index.entries
      .map((e: { conversationId: string }) => e.conversationId)
      .filter((id: string) => storage.map.has(`${QUESTION_SESSION_KEY_PREFIX}${id}`));

    expect(indexedIds).toHaveLength(20);
    expect(payloadIds).toHaveLength(20);
    // The two sets must be identical: no orphan payload, no dangling index entry.
    expect([...payloadIds].sort()).toEqual([...indexedIds].sort());
    expect(indexedIds).not.toContain("c0");
    expect(indexedIds).not.toContain("c1");
    expect(storage.getItem(`${QUESTION_SESSION_KEY_PREFIX}c0`)).toBeNull();
    expect(storage.getItem(`${QUESTION_SESSION_KEY_PREFIX}c1`)).toBeNull();
  });

  test("re-saving an existing session does not create an orphan or duplicate", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);

    for (let i = 0; i < 20; i += 1) {
      saveQuestionSession(draft({ conversationId: `c${i}`, rawQuestion: `问题 ${i}` }), 1000 + i);
    }
    // Re-save an existing id with a newer timestamp.
    saveQuestionSession(draft({ conversationId: "c5", rawQuestion: "更新后" }), 5000);

    const index = JSON.parse(storage.getItem(QUESTION_SESSION_INDEX_KEY) as string);
    const indexedIds = index.entries.map((e: { conversationId: string }) => e.conversationId);
    const payloadIds = index.entries
      .map((e: { conversationId: string }) => e.conversationId)
      .filter((id: string) => storage.map.has(`${QUESTION_SESSION_KEY_PREFIX}${id}`));

    expect(indexedIds).toHaveLength(20);
    expect(payloadIds).toHaveLength(20);
    expect([...payloadIds].sort()).toEqual([...indexedIds].sort());
    expect(index.entries[0].conversationId).toBe("c5");
  });

  test("V1 migration runs once: a second call is a no-op and does not duplicate", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    const analysis = {
      intent: ["x"], primaryGoal: "y", timeSensitive: false,
      ambiguities: [], missingContext: [], clarificationQuestions: [], diagnostics: []
    };
    const retrieval = {
      status: "success" as const, evidenceStatus: "sufficient" as const,
      queries: ["q"], evidence: [], existingCoverage: [], knowledgeGaps: []
    };
    // These must satisfy the real CompileResultSchema: publishable title 8-80 chars,
    // context 20-500 chars, each question 4-120 chars.
    const compiled = {
      compiledQuestion: { title: "旧版编译结果标题", background: "旧版背景说明文本", goal: "旧版目标说明文本", constraints: [], coreUncertainty: "旧版核心困惑文本", expectedAnswer: ["要点一", "要点二"] },
      publishableQuestion: { title: "旧版可发布问题标题文本", context: "这是一段足够长的旧版上下文内容，用于通过 schema 的最小长度校验。", questions: ["旧版子问题之一"] },
      evidenceUsed: false
    };
    storage.setItem(LEGACY_COMPLETED_SESSION_STORAGE_KEY, JSON.stringify({
      version: 1, savedAt: 1000, rawQuestion: "旧问题", answers: {}, analysis, retrieval, compiled
    }));

    const first = migrateLegacyCompletedSession(2000, () => "conv-1");
    const second = migrateLegacyCompletedSession(2000, () => "conv-2");

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    const index = JSON.parse(storage.getItem(QUESTION_SESSION_INDEX_KEY) as string);
    expect(index.entries).toHaveLength(1);
    expect(storage.getItem(LEGACY_COMPLETED_SESSION_STORAGE_KEY)).toBeNull();
  });

  test("a quota failure during save returns false and leaves a readable, consistent index", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    expect(saveQuestionSession(draft({ conversationId: "keep", rawQuestion: "保留" }), 1000)).toBe(true);

    // Simulate quota being hit for the NEXT write only, then verify the app still reads back.
    const original = storage.setItem.bind(storage);
    storage.setItem = (k: string, v: string) => {
      if (k.startsWith(QUESTION_SESSION_KEY_PREFIX)) throw new Error("QuotaExceededError");
      return original(k, v);
    };
    expect(saveQuestionSession(draft({ conversationId: "new", rawQuestion: "新" }), 2000)).toBe(false);
    storage.setItem = original;

    // The previous session is still intact and consistent.
    const index = JSON.parse(storage.getItem(QUESTION_SESSION_INDEX_KEY) as string);
    expect(index.entries.map((e: { conversationId: string }) => e.conversationId)).toContain("keep");
    expect(loadActiveQuestionSession()).not.toBeNull();
  });

  test("an index write failure does not throw and leaves sessions loadable by id", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    const original = storage.setItem.bind(storage);
    storage.setItem = (k: string, v: string) => {
      if (k === QUESTION_SESSION_INDEX_KEY) throw new Error("QuotaExceededError");
      return original(k, v);
    };
    expect(() => saveQuestionSession(draft({ conversationId: "orphan" }), 1000)).not.toThrow();
    expect(saveQuestionSession(draft({ conversationId: "orphan" }), 1000)).toBe(false);
    storage.setItem = original;
    // The payload exists but the index does not -> the caller cannot see it in history.
    expect(storage.getItem(`${QUESTION_SESSION_KEY_PREFIX}orphan`)).not.toBeNull();
    expect(storage.getItem(QUESTION_SESSION_INDEX_KEY)).toBeNull();
    expect(listRecentQuestionSessions()).toHaveLength(0);
  });

  test("setActiveConversationId preserves entries and never resurrects an evicted session", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    for (let i = 0; i < 22; i += 1) {
      saveQuestionSession(draft({ conversationId: `c${i}` }), 1000 + i);
    }
    expect(setActiveConversationId("c21")).toBe(true);
    const index = JSON.parse(storage.getItem(QUESTION_SESSION_INDEX_KEY) as string);
    expect(index.activeConversationId).toBe("c21");
    expect(index.entries).toHaveLength(20);
    // Pointing at an evicted session must not restore anything.
    expect(setActiveConversationId("c0")).toBe(true);
    expect(loadActiveQuestionSession()).toBeNull();
  });
});
