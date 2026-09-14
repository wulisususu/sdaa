import type { CompileResult, QuestionAnalysis, RetrieveResult } from "@ask-better/domain";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  LEGACY_COMPLETED_SESSION_STORAGE_KEY,
  LEGACY_COMPLETED_SESSION_TTL_MS,
  QUESTION_SESSION_INDEX_KEY,
  QUESTION_SESSION_KEY_PREFIX,
  QUESTION_SESSION_LIMIT,
  createConversationId,
  listRecentQuestionSessions,
  loadActiveQuestionSession,
  loadQuestionSession,
  migrateLegacyCompletedSession,
  resolveRestorableStage,
  saveQuestionSession,
  setActiveConversationId,
  type QuestionSessionDraft,
  type QuestionSessionIndexV2,
  type StoredQuestionSessionV2
} from "./question-session-storage";

type MemoryStorage = Storage & { map: Map<string, string> };

function createMemoryStorage(): MemoryStorage {
  const map = new Map<string, string>();
  const storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    map
  };
  return storage as MemoryStorage;
}

function stubWindow(storage: Storage) {
  vi.stubGlobal("window", { localStorage: storage });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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

/**
 * A fully-populated Result by default, so each normalization test states only the field it is
 * removing. `baseDraft` holds all-null payloads, so it must not be spread last.
 */
function buildStored(overrides: Partial<StoredQuestionSessionV2> = {}): StoredQuestionSessionV2 {
  return {
    ...baseDraft,
    version: 2,
    updatedAt: 1_700_000_000_100,
    stage: "result",
    analysis,
    retrieval,
    compiled,
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

function sessionKey(conversationId: string) {
  return `${QUESTION_SESSION_KEY_PREFIX}${conversationId}`;
}

function readIndex(storage: MemoryStorage): QuestionSessionIndexV2 | null {
  const raw = storage.map.get(QUESTION_SESSION_INDEX_KEY);
  return raw ? (JSON.parse(raw) as QuestionSessionIndexV2) : null;
}

describe("question-session-storage save/load", () => {
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

  test("persists a draft shorter than the analyze minimum", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);

    // Local drafts must survive before they are eligible to submit.
    expect(saveQuestionSession(buildDraft({ conversationId: "c1", rawQuestion: "买" }))).toBe(true);
    expect(loadQuestionSession("c1")?.rawQuestion).toBe("买");
  });

  test("round-trips analysis, retrieval and compiled payloads", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);

    saveQuestionSession(
      buildDraft({
        conversationId: "conv-full",
        stage: "result",
        answers: { usage: "旅游和人像" },
        analysis,
        retrieval,
        compiled
      })
    );

    const loaded = loadQuestionSession("conv-full");
    expect(loaded?.analysis?.primaryGoal).toBe(analysis.primaryGoal);
    expect(loaded?.retrieval?.queries).toEqual(retrieval.queries);
    expect(loaded?.compiled?.compiledQuestion.title).toBe(compiled.compiledQuestion.title);
    expect(loaded?.answers).toEqual({ usage: "旅游和人像" });
  });

  test("orders recent sessions by updatedAt DESC and caps the index at 20", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);

    for (let index = 0; index < 22; index += 1) {
      saveQuestionSession(
        buildDraft({ conversationId: `conv-${index}`, rawQuestion: `问题 ${index}` }),
        1_700_000_000_000 + index
      );
    }

    const recent = listRecentQuestionSessions();
    expect(recent).toHaveLength(20);
    expect(recent[0]?.conversationId).toBe("conv-21");
    expect(recent.at(-1)?.conversationId).toBe("conv-2");
    expect(storage.getItem(sessionKey("conv-0"))).toBeNull();
    expect(storage.getItem(sessionKey("conv-1"))).toBeNull();
  });

  test("re-saving a session updates rather than duplicates its index entry", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);

    saveQuestionSession(buildDraft({ conversationId: "conv-1", rawQuestion: "第一次" }), 1_700_000_000_000);
    saveQuestionSession(buildDraft({ conversationId: "conv-1", rawQuestion: "第二次" }), 1_700_000_000_500);

    const recent = listRecentQuestionSessions();
    expect(recent).toHaveLength(1);
    expect(recent[0]?.rawQuestion).toBe("第二次");
    expect(recent[0]?.updatedAt).toBe(1_700_000_000_500);
  });

  test("hides an emptied draft from recent history but keeps it loadable", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);

    saveQuestionSession(buildDraft({ conversationId: "conv-blank", rawQuestion: "   " }), 1_700_000_000_000);

    expect(listRecentQuestionSessions()).toHaveLength(0);
    expect(loadQuestionSession("conv-blank")?.rawQuestion).toBe("   ");
  });

  test("setActiveConversationId stores and clears the active pointer", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);

    expect(setActiveConversationId("conv-9")).toBe(true);
    expect(readIndex(storage)?.activeConversationId).toBe("conv-9");

    expect(setActiveConversationId(null)).toBe(true);
    expect(readIndex(storage)?.activeConversationId).toBeNull();
  });

  test("returns false instead of throwing when window is unavailable", () => {
    expect(saveQuestionSession(buildDraft())).toBe(false);
    expect(loadQuestionSession("conv-base")).toBeNull();
    expect(loadActiveQuestionSession()).toBeNull();
    expect(listRecentQuestionSessions()).toEqual([]);
    expect(setActiveConversationId("conv-base")).toBe(false);
    expect(migrateLegacyCompletedSession()).toBeNull();
  });

  test("storage exceptions never throw to the caller", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      }
    } as unknown as Storage;
    stubWindow(throwingStorage);

    expect(saveQuestionSession(buildDraft())).toBe(false);
    expect(loadQuestionSession("conv-base")).toBeNull();
    expect(loadActiveQuestionSession()).toBeNull();
    expect(listRecentQuestionSessions()).toEqual([]);
    expect(setActiveConversationId("conv-base")).toBe(false);
    expect(() => migrateLegacyCompletedSession()).not.toThrow();
  });
});

describe("question-session-storage corruption handling", () => {
  test("removes a corrupt session key and prunes its index entry", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    saveQuestionSession(buildDraft({ conversationId: "conv-bad" }), 1_700_000_000_000);
    storage.map.set(sessionKey("conv-bad"), "{ not valid json");

    expect(loadQuestionSession("conv-bad")).toBeNull();
    expect(storage.map.has(sessionKey("conv-bad"))).toBe(false);
    expect(listRecentQuestionSessions()).toHaveLength(0);
  });

  test("removes a session with an unsupported version", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.map.set(sessionKey("conv-v9"), JSON.stringify({ ...buildStored(), version: 9 }));

    expect(loadQuestionSession("conv-v9")).toBeNull();
    expect(storage.map.has(sessionKey("conv-v9"))).toBe(false);
  });

  test("ignores a corrupt index and stays usable", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.map.set(QUESTION_SESSION_INDEX_KEY, "{ not valid json");

    expect(listRecentQuestionSessions()).toEqual([]);
    expect(saveQuestionSession(buildDraft({ conversationId: "conv-fresh" }), 1_700_000_000_000)).toBe(true);
    expect(listRecentQuestionSessions().map((entry) => entry.conversationId)).toEqual(["conv-fresh"]);
  });

  test("drops index entries whose session key is missing", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    saveQuestionSession(buildDraft({ conversationId: "conv-ghost" }), 1_700_000_000_000);
    storage.map.delete(sessionKey("conv-ghost"));

    expect(listRecentQuestionSessions()).toEqual([]);
    expect(readIndex(storage)?.entries ?? []).toHaveLength(0);
  });

  test("clears a stale active pointer when its session cannot be loaded", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.map.set(
      QUESTION_SESSION_INDEX_KEY,
      JSON.stringify({
        version: 2,
        activeConversationId: "conv-missing",
        entries: [
          {
            conversationId: "conv-missing",
            rawQuestion: "不存在的问题",
            stage: "input",
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_000_000
          }
        ]
      })
    );

    expect(loadActiveQuestionSession()).toBeNull();
    expect(readIndex(storage)?.activeConversationId ?? null).toBeNull();
  });
});

describe("resolveRestorableStage", () => {
  test("keeps a logically complete Result", () => {
    expect(resolveRestorableStage(buildStored({ stage: "result", analysis, retrieval, compiled }))).toBe("result");
  });

  test("downgrades a Result without compiled payload to Coverage", () => {
    // Regression: the fallback must walk DOWN from Result. An earlier implementation returned
    // "coverage" only when the stored stage was already Coverage, so this case collapsed to
    // Input and discarded the user's analysis and retrieval.
    expect(
      resolveRestorableStage(buildStored({ stage: "result", analysis, retrieval, compiled: null }))
    ).toBe("coverage");
  });

  test("downgrades a Result without retrieval all the way down", () => {
    expect(
      resolveRestorableStage(buildStored({ stage: "result", analysis, retrieval: null, compiled: null }))
    ).toBe("diagnose");
  });

  test("downgrades a Result with no payload at all to Input", () => {
    expect(
      resolveRestorableStage(buildStored({ stage: "result", analysis: null, retrieval: null, compiled: null }))
    ).toBe("input");
  });

  test("downgrades a Coverage without retrieval to Diagnose", () => {
    expect(
      resolveRestorableStage(buildStored({ stage: "coverage", analysis, retrieval: null, compiled: null }))
    ).toBe("diagnose");
  });

  test("keeps a Coverage that has analysis and retrieval", () => {
    expect(resolveRestorableStage(buildStored({ stage: "coverage", analysis, retrieval, compiled: null }))).toBe("coverage");
  });

  test("downgrades a Clarify without analysis to Input", () => {
    expect(
      resolveRestorableStage(buildStored({ stage: "clarify", analysis: null, retrieval: null, compiled: null }))
    ).toBe("input");
  });

  test("keeps Diagnose when analysis exists", () => {
    expect(resolveRestorableStage(buildStored({ stage: "diagnose", analysis }))).toBe("diagnose");
  });

  test("never restores a transient operation as a stage", () => {
    // Transient operations are not persisted at all, so a stored stage is always stable.
    for (const stage of ["input", "clarify", "diagnose", "coverage", "result"] as const) {
      const resolved = resolveRestorableStage(buildStored({ stage, analysis, retrieval, compiled }));
      expect(["input", "clarify", "diagnose", "coverage", "result"]).toContain(resolved);
      expect(["analyzing", "retrieving", "compiling"]).not.toContain(resolved);
    }
  });
});

describe("legacy V1 migration", () => {
  test("migrates a valid legacy completed result into an active V2 result", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
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

  test("migrates the legacy createdAt from savedAt", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.setItem(
      LEGACY_COMPLETED_SESSION_STORAGE_KEY,
      JSON.stringify(buildLegacyEnvelope({ savedAt: 1_700_000_000_000 }))
    );

    const migrated = migrateLegacyCompletedSession(1_700_000_000_500, () => "conv-legacy");

    expect(migrated?.createdAt).toBe(1_700_000_000_000);
    expect(migrated?.updatedAt).toBe(1_700_000_000_500);
  });

  test("keeps the legacy key when the V2 write fails", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.setItem(
      LEGACY_COMPLETED_SESSION_STORAGE_KEY,
      JSON.stringify(buildLegacyEnvelope({ savedAt: 1_700_000_000_000 }))
    );
    const originalSetItem = storage.setItem;
    storage.setItem = () => {
      throw new Error("quota");
    };

    expect(migrateLegacyCompletedSession(1_700_000_000_100, () => "conv-legacy")).toBeNull();
    storage.setItem = originalSetItem;
    expect(storage.getItem(LEGACY_COMPLETED_SESSION_STORAGE_KEY)).not.toBeNull();
  });

  test("rejects an expired legacy result and removes the key", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.setItem(
      LEGACY_COMPLETED_SESSION_STORAGE_KEY,
      JSON.stringify(buildLegacyEnvelope({ savedAt: 1_700_000_000_000 }))
    );

    expect(
      migrateLegacyCompletedSession(1_700_000_000_000 + LEGACY_COMPLETED_SESSION_TTL_MS + 1)
    ).toBeNull();
    expect(storage.getItem(LEGACY_COMPLETED_SESSION_STORAGE_KEY)).toBeNull();
  });

  test("keeps a legacy result at exactly the TTL boundary", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.setItem(
      LEGACY_COMPLETED_SESSION_STORAGE_KEY,
      JSON.stringify(buildLegacyEnvelope({ savedAt: 1_700_000_000_000 }))
    );

    expect(
      migrateLegacyCompletedSession(1_700_000_000_000 + LEGACY_COMPLETED_SESSION_TTL_MS, () => "conv-edge")
    ).not.toBeNull();
  });

  test("rejects a future-dated legacy result", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.setItem(
      LEGACY_COMPLETED_SESSION_STORAGE_KEY,
      JSON.stringify(buildLegacyEnvelope({ savedAt: 1_700_000_000_000 }))
    );

    expect(migrateLegacyCompletedSession(1_700_000_000_000 - 1)).toBeNull();
    expect(storage.getItem(LEGACY_COMPLETED_SESSION_STORAGE_KEY)).toBeNull();
  });

  test("rejects malformed and schema-invalid legacy data", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);

    storage.setItem(LEGACY_COMPLETED_SESSION_STORAGE_KEY, "{ not valid json");
    expect(migrateLegacyCompletedSession(1_700_000_000_000)).toBeNull();
    expect(storage.getItem(LEGACY_COMPLETED_SESSION_STORAGE_KEY)).toBeNull();

    storage.setItem(LEGACY_COMPLETED_SESSION_STORAGE_KEY, JSON.stringify({ version: 1, savedAt: 1 }));
    expect(migrateLegacyCompletedSession(1_700_000_000_000)).toBeNull();
    expect(storage.getItem(LEGACY_COMPLETED_SESSION_STORAGE_KEY)).toBeNull();
  });

  test("is a no-op when no legacy key exists", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);

    expect(migrateLegacyCompletedSession(1_700_000_000_000)).toBeNull();
    expect(listRecentQuestionSessions()).toHaveLength(0);
  });
});

describe("createConversationId", () => {
  test("returns a non-empty unique id", () => {
    const first = createConversationId();
    const second = createConversationId();
    expect(typeof first).toBe("string");
    expect(first.trim().length).toBeGreaterThan(0);
    expect(first).not.toBe(second);
  });
});
