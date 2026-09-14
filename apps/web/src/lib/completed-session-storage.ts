import {
  AnalyzeRequestSchema,
  ClarificationAnswersSchema,
  CompileResultSchema,
  QuestionAnalysisSchema,
  RetrieveResultSchema,
  type ClarificationAnswers,
  type CompileResult,
  type QuestionAnalysis,
  type RetrieveResult
} from "@ask-better/domain";
import { z } from "zod";

export const COMPLETED_SESSION_STORAGE_KEY = "ask-better:completed-session:v1";
export const COMPLETED_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface StoredCompletedSessionV1 {
  version: 1;
  savedAt: number;
  rawQuestion: string;
  answers: ClarificationAnswers;
  analysis: QuestionAnalysis;
  retrieval: RetrieveResult;
  compiled: CompileResult;
}

const StoredCompletedSessionV1Schema = z.object({
  version: z.literal(1),
  savedAt: z.number().int().nonnegative(),
  rawQuestion: AnalyzeRequestSchema.shape.rawQuestion,
  answers: ClarificationAnswersSchema,
  analysis: QuestionAnalysisSchema,
  retrieval: RetrieveResultSchema,
  compiled: CompileResultSchema
});

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function removeSilently(storage: Storage): void {
  try {
    storage.removeItem(COMPLETED_SESSION_STORAGE_KEY);
  } catch {
    // Best effort: a broken storage must never block the product.
  }
}

export function saveCompletedSession(
  session: Omit<StoredCompletedSessionV1, "version" | "savedAt">
): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    const envelope: StoredCompletedSessionV1 = {
      ...session,
      version: 1,
      savedAt: Date.now()
    };
    storage.setItem(COMPLETED_SESSION_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function loadCompletedSession(now: number = Date.now()): StoredCompletedSessionV1 | null {
  const storage = getStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(COMPLETED_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    removeSilently(storage);
    return null;
  }

  const parsed = StoredCompletedSessionV1Schema.safeParse(json);
  if (!parsed.success) {
    removeSilently(storage);
    return null;
  }

  if (now - parsed.data.savedAt > COMPLETED_SESSION_TTL_MS) {
    removeSilently(storage);
    return null;
  }

  return parsed.data;
}

export function clearCompletedSession(): void {
  const storage = getStorage();
  if (!storage) return;
  removeSilently(storage);
}
