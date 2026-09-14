import {
  ClarificationAnswersSchema,
  CompileResultSchema,
  QuestionAnalysisSchema,
  RetrieveResultSchema,
  questionCompilerStages,
  type ClarificationAnswers,
  type CompileResult,
  type QuestionAnalysis,
  type QuestionCompilerStage,
  type RetrieveResult
} from "@ask-better/domain";
import { z } from "zod";

export const QUESTION_SESSION_INDEX_KEY = "ask-better:session-index:v2";
export const QUESTION_SESSION_KEY_PREFIX = "ask-better:session:v2:";
export const LEGACY_COMPLETED_SESSION_STORAGE_KEY = "ask-better:completed-session:v1";
export const LEGACY_COMPLETED_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const QUESTION_SESSION_LIMIT = 20;
export const QUESTION_SESSION_AUTOSAVE_MS = 250;

/**
 * The persistable slice of the compiler state. Transient values (`operation`, `error`,
 * `copyStatus`, animation state) are deliberately absent: recovery must always land on the
 * last stable stage instead of resuming a fake loading state.
 */
export interface QuestionSessionDraft {
  conversationId: string;
  createdAt: number;
  stage: QuestionCompilerStage;
  rawQuestion: string;
  answers: ClarificationAnswers;
  analysis: QuestionAnalysis | null;
  retrieval: RetrieveResult | null;
  compiled: CompileResult | null;
}

export interface StoredQuestionSessionV2 extends QuestionSessionDraft {
  version: 2;
  updatedAt: number;
}

export interface QuestionSessionSummaryV2 {
  conversationId: string;
  rawQuestion: string;
  stage: QuestionCompilerStage;
  createdAt: number;
  updatedAt: number;
}

export interface QuestionSessionIndexV2 {
  version: 2;
  activeConversationId: string | null;
  entries: QuestionSessionSummaryV2[];
}

const QuestionCompilerStageSchema = z.enum(questionCompilerStages);

/**
 * Drafts may hold fewer than five characters, so this must NOT reuse
 * `AnalyzeRequestSchema.shape.rawQuestion` (which requires min(5)).
 */
const PersistedRawQuestionSchema = z.string().max(1000);

const StoredQuestionSessionV2Schema = z.object({
  version: z.literal(2),
  conversationId: z.string().trim().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  stage: QuestionCompilerStageSchema,
  rawQuestion: PersistedRawQuestionSchema,
  answers: ClarificationAnswersSchema,
  analysis: QuestionAnalysisSchema.nullable(),
  retrieval: RetrieveResultSchema.nullable(),
  compiled: CompileResultSchema.nullable()
});

const QuestionSessionSummaryV2Schema = z.object({
  conversationId: z.string().trim().min(1),
  rawQuestion: z.string().max(1000),
  stage: QuestionCompilerStageSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative()
});

const QuestionSessionIndexV2Schema = z.object({
  version: z.literal(2),
  activeConversationId: z.string().trim().min(1).nullable(),
  entries: z.array(QuestionSessionSummaryV2Schema)
});

/** The legacy V1 completed-result envelope, kept only for one-time migration. */
const LegacyCompletedSessionV1Schema = z.object({
  version: z.literal(1),
  savedAt: z.number().int().nonnegative(),
  rawQuestion: PersistedRawQuestionSchema,
  answers: ClarificationAnswersSchema,
  analysis: QuestionAnalysisSchema,
  retrieval: RetrieveResultSchema,
  compiled: CompileResultSchema
});

const EMPTY_INDEX: QuestionSessionIndexV2 = {
  version: 2,
  activeConversationId: null,
  entries: []
};

export function createConversationId(): string {
  return globalThis.crypto.randomUUID();
}

function sessionKey(conversationId: string): string {
  return `${QUESTION_SESSION_KEY_PREFIX}${conversationId}`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeSilently(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Best effort: a broken storage must never block the product.
  }
}

function toSummary(session: StoredQuestionSessionV2): QuestionSessionSummaryV2 {
  return {
    conversationId: session.conversationId,
    rawQuestion: session.rawQuestion,
    stage: session.stage,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

function parseSession(raw: string): StoredQuestionSessionV2 | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = StoredQuestionSessionV2Schema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/**
 * Reads the index. A corrupt index is discarded rather than throwing; the next save rebuilds it.
 */
function loadIndexFromStorage(storage: Storage): QuestionSessionIndexV2 {
  const raw = readRaw(storage, QUESTION_SESSION_INDEX_KEY);
  if (raw === null) return { ...EMPTY_INDEX };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ...EMPTY_INDEX };
  }
  const parsed = QuestionSessionIndexV2Schema.safeParse(json);
  return parsed.success ? parsed.data : { ...EMPTY_INDEX };
}

function writeIndex(storage: Storage, index: QuestionSessionIndexV2): boolean {
  return writeRaw(storage, QUESTION_SESSION_INDEX_KEY, JSON.stringify(index));
}

/** Drops index entries whose session payload is missing or unreadable. */
function pruneMissingEntries(
  storage: Storage,
  index: QuestionSessionIndexV2
): QuestionSessionIndexV2 {
  const entries = index.entries.filter((entry) => readRaw(storage, sessionKey(entry.conversationId)) !== null);
  if (entries.length === index.entries.length) return index;
  const next: QuestionSessionIndexV2 = {
    version: 2,
    activeConversationId: entries.some((entry) => entry.conversationId === index.activeConversationId)
      ? index.activeConversationId
      : null,
    entries
  };
  writeIndex(storage, next);
  return next;
}

/**
 * A logically incomplete stored session is downgraded to the latest stage its payload can
 * actually render, so recovery can never show a blank Coverage/Result scene.
 */
export function resolveRestorableStage(session: StoredQuestionSessionV2): QuestionCompilerStage {
  const hasAnalysis = Boolean(session.analysis);
  const hasRetrieval = Boolean(session.analysis) && Boolean(session.retrieval);
  const hasCompiled = hasRetrieval && Boolean(session.compiled);

  // Walk DOWN the fallback chain from the stored stage until a renderable one is found.
  // The plan's original snippet returned "coverage" only when the stored stage was already
  // "coverage", so a Result missing just its compiled payload collapsed straight to Input and
  // threw away the user's analysis/retrieval. Each stage is now gated on its own requirements.
  if (session.stage === "result") {
    if (hasCompiled) return "result";
    if (hasRetrieval) return "coverage";
    if (hasAnalysis) return "diagnose";
    return "input";
  }

  if (session.stage === "coverage") {
    if (hasRetrieval) return "coverage";
    if (hasAnalysis) return "diagnose";
    return "input";
  }

  if (session.stage === "diagnose") {
    return hasAnalysis ? "diagnose" : "input";
  }

  if (session.stage === "clarify") {
    return hasAnalysis ? "clarify" : "input";
  }

  return "input";
}

/**
 * Persists one session and owns index ordering, the 20-session retention limit, eviction and
 * the active pointer. Callers never touch `localStorage` directly.
 */
export function saveQuestionSession(draft: QuestionSessionDraft, now: number = Date.now()): boolean {
  const storage = getStorage();
  if (!storage) return false;

  const envelope: StoredQuestionSessionV2 = {
    ...draft,
    version: 2,
    updatedAt: now
  };

  if (!writeRaw(storage, sessionKey(draft.conversationId), JSON.stringify(envelope))) {
    return false;
  }

  const current = loadIndexFromStorage(storage);
  const nextEntry = toSummary(envelope);
  const entries = [
    nextEntry,
    ...current.entries.filter((entry) => entry.conversationId !== envelope.conversationId)
  ]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, QUESTION_SESSION_LIMIT);

  const evictedIds = current.entries
    .map((entry) => entry.conversationId)
    .filter((id) => !entries.some((entry) => entry.conversationId === id));

  for (const id of evictedIds) removeSilently(storage, sessionKey(id));

  return writeIndex(storage, {
    version: 2,
    activeConversationId: envelope.conversationId,
    entries
  });
}

/**
 * Loads one session. A corrupt or schema-invalid payload is removed and pruned from the index.
 */
export function loadQuestionSession(conversationId: string): StoredQuestionSessionV2 | null {
  const storage = getStorage();
  if (!storage) return null;

  const raw = readRaw(storage, sessionKey(conversationId));
  if (raw === null) return null;

  const session = parseSession(raw);
  if (!session) {
    removeSilently(storage, sessionKey(conversationId));
    const index = loadIndexFromStorage(storage);
    writeIndex(storage, {
      version: 2,
      activeConversationId: index.activeConversationId === conversationId ? null : index.activeConversationId,
      entries: index.entries.filter((entry) => entry.conversationId !== conversationId)
    });
    return null;
  }

  return session;
}

/** Loads the active session, clearing a stale active pointer when it cannot be restored. */
export function loadActiveQuestionSession(): StoredQuestionSessionV2 | null {
  const storage = getStorage();
  if (!storage) return null;

  const index = loadIndexFromStorage(storage);
  const activeConversationId = index.activeConversationId;
  if (!activeConversationId) return null;

  const session = loadQuestionSession(activeConversationId);
  if (session) return session;

  writeIndex(storage, {
    version: 2,
    activeConversationId: null,
    entries: index.entries.filter((entry) => entry.conversationId !== activeConversationId)
  });
  return null;
}

/**
 * Newest-first recent list. An emptied draft stays loadable but must not appear as a blank row.
 */
export function listRecentQuestionSessions(): QuestionSessionSummaryV2[] {
  const storage = getStorage();
  if (!storage) return [];

  const index = pruneMissingEntries(storage, loadIndexFromStorage(storage));
  return [...index.entries]
    .filter((entry) => entry.rawQuestion.trim().length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function setActiveConversationId(conversationId: string | null): boolean {
  const storage = getStorage();
  if (!storage) return false;

  const index = loadIndexFromStorage(storage);
  return writeIndex(storage, {
    version: 2,
    activeConversationId: conversationId,
    entries: index.entries
  });
}

/**
 * One-time upgrade of the legacy completed-result envelope.
 *
 * Order matters: read -> TTL/schema validate -> build V2 -> save V2 -> only then remove the
 * legacy key. The legacy key survives whenever the V2 write fails.
 */
export function migrateLegacyCompletedSession(
  now: number = Date.now(),
  idFactory: () => string = createConversationId
): StoredQuestionSessionV2 | null {
  const storage = getStorage();
  if (!storage) return null;

  const raw = readRaw(storage, LEGACY_COMPLETED_SESSION_STORAGE_KEY);
  if (raw === null) return null;

  const removeLegacy = () => removeSilently(storage, LEGACY_COMPLETED_SESSION_STORAGE_KEY);

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    removeLegacy();
    return null;
  }

  const parsed = LegacyCompletedSessionV1Schema.safeParse(json);
  if (!parsed.success) {
    removeLegacy();
    return null;
  }

  const age = now - parsed.data.savedAt;
  if (age < 0 || age > LEGACY_COMPLETED_SESSION_TTL_MS) {
    removeLegacy();
    return null;
  }

  const migrated: StoredQuestionSessionV2 = {
    version: 2,
    conversationId: idFactory(),
    createdAt: parsed.data.savedAt,
    updatedAt: now,
    stage: "result",
    rawQuestion: parsed.data.rawQuestion,
    answers: parsed.data.answers,
    analysis: parsed.data.analysis,
    retrieval: parsed.data.retrieval,
    compiled: parsed.data.compiled
  };

  if (!saveQuestionSession(migrated, now)) return null;

  removeLegacy();
  return migrated;
}
