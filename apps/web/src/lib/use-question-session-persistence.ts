"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  QUESTION_SESSION_AUTOSAVE_MS,
  saveQuestionSession,
  type QuestionSessionDraft
} from "./question-session-storage";

/**
 * Debounced autosave for the active question session, plus a synchronous flush on the
 * lifecycle edges where a debounce would be lost: `pagehide`, the document becoming hidden,
 * and component unmount (which covers client-side page/route switches where `pagehide`
 * may never fire).
 *
 * The lifecycle listener reads the latest draft through a ref so a mounted-once effect never
 * closes over a stale value.
 */
export function useQuestionSessionPersistence(
  draft: QuestionSessionDraft | null
): { flushQuestionSession: () => boolean } {
  const latestDraftRef = useRef<QuestionSessionDraft | null>(draft);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  latestDraftRef.current = draft;

  const flushQuestionSession = useCallback(() => {
    const current = latestDraftRef.current;
    if (!current) return false;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return saveQuestionSession(current);
  }, []);

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (!draft) return;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const current = latestDraftRef.current;
      if (current) saveQuestionSession(current);
    }, QUESTION_SESSION_AUTOSAVE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [draft]);

  useEffect(() => {
    const onPageHide = () => {
      flushQuestionSession();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushQuestionSession();
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Covers client-side route/page switches where `pagehide` may not fire.
      flushQuestionSession();
    };
  }, [flushQuestionSession]);

  return { flushQuestionSession };
}
