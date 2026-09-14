import type { CompileResult, QuestionAnalysis, RetrieveResult } from "@ask-better/domain";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  COMPLETED_SESSION_STORAGE_KEY,
  COMPLETED_SESSION_TTL_MS,
  clearCompletedSession,
  loadCompletedSession,
  saveCompletedSession,
  type StoredCompletedSessionV1
} from "./completed-session-storage";

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

const analysis: QuestionAnalysis = {
  intent: ["评估转码前景"],
  primaryGoal: "判断现在转码是否仍有前途",
  timeSensitive: true,
  ambiguities: [],
  missingContext: [],
  clarificationQuestions: [],
  diagnostics: []
};

const retrieval: RetrieveResult = {
  status: "success",
  evidenceStatus: "sufficient",
  queries: ["现在转码还有前途吗"],
  evidence: [
    {
      id: "123",
      title: "现在转码还有前途吗？",
      contentType: "Question",
      summary: "讨论转码就业趋势与门槛。",
      url: "https://www.zhihu.com/question/123",
      author: "答主",
      editedAt: 1710000000,
      rankingScore: 0.9,
      authorityLevel: "2",
      voteUpCount: 42,
      commentCount: 6,
      selectedComments: [],
      source: "zhihu"
    }
  ],
  existingCoverage: [
    { id: "c1", title: "转码趋势讨论", detail: "已有内容覆盖近年转码就业趋势。", strength: "medium" }
  ],
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
  evidenceUsed: true
};

const session: Omit<StoredCompletedSessionV1, "version" | "savedAt"> = {
  rawQuestion: "现在转码还有前途吗？",
  answers: { market: "国内市场" },
  analysis,
  retrieval,
  compiled
};

function buildEnvelope(overrides: Partial<StoredCompletedSessionV1> = {}): StoredCompletedSessionV1 {
  return { version: 1, savedAt: 1_700_000_000_000, ...session, ...overrides };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("completed-session-storage", () => {
  test("saves a valid completed session with a v1 envelope", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);

    expect(saveCompletedSession(session)).toBe(true);

    const raw = storage.map.get(COMPLETED_SESSION_STORAGE_KEY);
    expect(raw).toBeDefined();
    const envelope = JSON.parse(raw as string) as StoredCompletedSessionV1;
    expect(envelope.version).toBe(1);
    expect(typeof envelope.savedAt).toBe("number");
    expect(envelope.rawQuestion).toBe(session.rawQuestion);
  });

  test("loads a valid unexpired session", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.map.set(COMPLETED_SESSION_STORAGE_KEY, JSON.stringify(buildEnvelope()));

    const restored = loadCompletedSession(1_700_000_000_000 + 60_000);

    expect(restored).not.toBeNull();
    expect(restored?.rawQuestion).toBe(session.rawQuestion);
    expect(restored?.answers).toEqual(session.answers);
    expect(restored?.analysis.primaryGoal).toBe(analysis.primaryGoal);
    expect(restored?.retrieval.status).toBe("success");
    expect(restored?.compiled.evidenceUsed).toBe(true);
  });

  test("keeps a session at exactly the TTL boundary", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.map.set(COMPLETED_SESSION_STORAGE_KEY, JSON.stringify(buildEnvelope()));

    expect(loadCompletedSession(1_700_000_000_000 + COMPLETED_SESSION_TTL_MS)).not.toBeNull();
  });

  test("rejects an expired session and clears it", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.map.set(COMPLETED_SESSION_STORAGE_KEY, JSON.stringify(buildEnvelope()));

    const restored = loadCompletedSession(1_700_000_000_000 + COMPLETED_SESSION_TTL_MS + 1);

    expect(restored).toBeNull();
    expect(storage.map.has(COMPLETED_SESSION_STORAGE_KEY)).toBe(false);
  });

  test("rejects malformed JSON and clears it", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.map.set(COMPLETED_SESSION_STORAGE_KEY, "{ not valid json");

    expect(loadCompletedSession()).toBeNull();
    expect(storage.map.has(COMPLETED_SESSION_STORAGE_KEY)).toBe(false);
  });

  test("rejects schema-invalid JSON and clears it", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.map.set(
      COMPLETED_SESSION_STORAGE_KEY,
      JSON.stringify({ version: 1, savedAt: 1_700_000_000_000, rawQuestion: "现在转码还有前途吗？" })
    );

    expect(loadCompletedSession(1_700_000_000_000)).toBeNull();
    expect(storage.map.has(COMPLETED_SESSION_STORAGE_KEY)).toBe(false);
  });

  test("rejects an unsupported version and clears it", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.map.set(
      COMPLETED_SESSION_STORAGE_KEY,
      JSON.stringify({ ...buildEnvelope(), version: 2 })
    );

    expect(loadCompletedSession(1_700_000_000_000)).toBeNull();
    expect(storage.map.has(COMPLETED_SESSION_STORAGE_KEY)).toBe(false);
  });

  test("clearCompletedSession removes the stored envelope", () => {
    const storage = createMemoryStorage();
    stubWindow(storage);
    storage.map.set(COMPLETED_SESSION_STORAGE_KEY, JSON.stringify(buildEnvelope()));

    clearCompletedSession();

    expect(storage.map.has(COMPLETED_SESSION_STORAGE_KEY)).toBe(false);
  });

  test("returns null and stays silent when window is unavailable", () => {
    expect(loadCompletedSession()).toBeNull();
    expect(saveCompletedSession(session)).toBe(false);
    expect(() => clearCompletedSession()).not.toThrow();
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

    expect(saveCompletedSession(session)).toBe(false);
    expect(loadCompletedSession()).toBeNull();
    expect(() => clearCompletedSession()).not.toThrow();
  });
});
