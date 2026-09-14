"use client";

import {
  countAnsweredClarifications,
  formatPublishableQuestion,
  getPreviousStage,
  isRawQuestionReady,
  setClarificationAnswer,
  type ClarificationAnswers,
  type CompileResult,
  type QuestionAnalysis,
  type QuestionCompilerStage,
  type RetrieveResult
} from "@ask-better/domain";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeQuestionApi,
  compileQuestionApi,
  retrieveQuestionApi
} from "../lib/api-client";
import {
  createConversationId,
  listRecentQuestionSessions,
  loadActiveQuestionSession,
  loadQuestionSession,
  migrateLegacyCompletedSession,
  resolveRestorableStage,
  saveQuestionSession,
  setActiveConversationId,
  type QuestionSessionDraft,
  type QuestionSessionSummaryV2,
  type StoredQuestionSessionV2
} from "../lib/question-session-storage";
import { useQuestionSessionPersistence } from "../lib/use-question-session-persistence";
import { AppHeader } from "./app-header";
import { ClarificationStage } from "./clarification-stage";
import { CoverageStage } from "./coverage-stage";
import { DiagnosisStage } from "./diagnosis-stage";
import { InputStage } from "./input-stage";
import { ResultStage } from "./result-stage";
import { ResumeSessionCard } from "./resume-session-card";
import { SessionHistoryDrawer } from "./session-history-drawer";
import { StageTransitionViewport } from "./stage-transition-viewport";

type CopyStatus = "idle" | "copied" | "error";
type Operation = "idle" | "analyzing" | "retrieving" | "compiling";

function safeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "处理失败，请重试。";
}

export function CompilerDemo() {
  const [stage, setStage] = useState<QuestionCompilerStage>("input");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationCreatedAt, setConversationCreatedAt] = useState<number | null>(null);
  const [rawQuestion, setRawQuestion] = useState("");
  const [answers, setAnswers] = useState<ClarificationAnswers>({});
  const [analysis, setAnalysis] = useState<QuestionAnalysis | null>(null);
  const [retrieval, setRetrieval] = useState<RetrieveResult | null>(null);
  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [operation, setOperation] = useState<Operation>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [restorableSession, setRestorableSession] = useState<QuestionSessionSummaryV2 | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [recentSessions, setRecentSessions] = useState<QuestionSessionSummaryV2[]>([]);
  const [sceneResetEpoch, setSceneResetEpoch] = useState(0);
  const requestVersion = useRef(0);
  const bootstrappedRef = useRef(false);

  const ready = isRawQuestionReady(rawQuestion);
  const clarificationQuestions = analysis?.clarificationQuestions ?? [];
  const answeredCount = useMemo(
    () => countAnsweredClarifications(clarificationQuestions, answers),
    [clarificationQuestions, answers]
  );

  function transitionTo(next: QuestionCompilerStage) {
    if (next === stage) return;
    setStage(next);
  }

  function cancelPending() {
    requestVersion.current += 1;
    setOperation("idle");
  }

  /**
   * Hydration is not a pipeline step: it restores the exact saved stable state and remounts
   * the visual viewport so the restored stage becomes the initial stable scene instead of
   * animating Input -> restored stage. Transient values reset to idle so recovery can never
   * resume a fake loading state.
   */
  function hydrateQuestionSession(session: StoredQuestionSessionV2) {
    cancelPending();
    setConversationId(session.conversationId);
    setConversationCreatedAt(session.createdAt);
    setRawQuestion(session.rawQuestion);
    setAnswers(session.answers);
    setAnalysis(session.analysis);
    setRetrieval(session.retrieval);
    setCompiled(session.compiled);
    setOperation("idle");
    setCopyStatus("idle");
    setError(null);
    setStage(resolveRestorableStage(session));
    setSceneResetEpoch((value) => value + 1);
  }

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    migrateLegacyCompletedSession();
    const active = loadActiveQuestionSession();
    if (active) {
      hydrateQuestionSession(active);
      return;
    }
    // No active session to auto-hydrate: offer the newest recent session as a secondary path.
    setRestorableSession(listRecentQuestionSessions()[0] ?? null);
  }, []);

  const sessionDraft = useMemo<QuestionSessionDraft | null>(() => {
    if (!conversationId || conversationCreatedAt === null) return null;
    return {
      conversationId,
      createdAt: conversationCreatedAt,
      stage,
      rawQuestion,
      answers,
      analysis,
      retrieval,
      compiled
    };
  }, [conversationId, conversationCreatedAt, stage, rawQuestion, answers, analysis, retrieval, compiled]);

  const { flushQuestionSession } = useQuestionSessionPersistence(sessionDraft);

  function ensureConversation(value: string) {
    if (conversationId === null && value.trim().length > 0) {
      setConversationId(createConversationId());
      setConversationCreatedAt(Date.now());
    }
  }

  function back() {
    cancelPending();
    setError(null);
    transitionTo(getPreviousStage(stage));
  }

  function handleRawQuestionChange(value: string) {
    cancelPending();
    ensureConversation(value);
    setRawQuestion(value);
    setAnswers({});
    setAnalysis(null);
    setRetrieval(null);
    setCompiled(null);
    setCopyStatus("idle");
    setError(null);
    transitionTo("input");
  }

  async function handleAnalyze() {
    if (!ready || operation !== "idle") return;
    const version = ++requestVersion.current;
    setOperation("analyzing");
    setError(null);
    try {
      const nextAnalysis = await analyzeQuestionApi(rawQuestion);
      if (version !== requestVersion.current) return;
      setAnalysis(nextAnalysis);
      setAnswers({});
      setRetrieval(null);
      setCompiled(null);
      setCopyStatus("idle");
      transitionTo("clarify");
    } catch (nextError) {
      if (version === requestVersion.current) setError(safeErrorMessage(nextError));
    } finally {
      if (version === requestVersion.current) setOperation("idle");
    }
  }

  function handleAnswer(questionId: string, option: string) {
    setAnswers((current) => setClarificationAnswer(current, questionId, option));
    setRetrieval(null);
    setCompiled(null);
    setCopyStatus("idle");
    setError(null);
  }

  function handleClarifyContinue() {
    if (!analysis) return;
    setError(null);
    transitionTo("diagnose");
  }

  async function handleRetrieve() {
    if (!analysis || operation !== "idle") return;

    // Revisiting Coverage must not re-run Retrieve. `retrieval` is the single authoritative copy
    // owned by this component, and every input it depends on clears it (raw question, Analyze,
    // clarification answer, New Question, re-optimize), so a non-null value is always consistent
    // with the current analysis and answers. Backing out to Diagnose deliberately keeps it, which
    // is what makes this return safe — no cache, fingerprint or second store is involved.
    if (retrieval) {
      setError(null);
      transitionTo("coverage");
      return;
    }

    const version = ++requestVersion.current;
    setOperation("retrieving");
    setError(null);
    try {
      const nextRetrieval = await retrieveQuestionApi({
        rawQuestion,
        analysis,
        clarificationAnswers: answers
      });
      if (version !== requestVersion.current) return;
      setRetrieval(nextRetrieval);
      setCompiled(null);
      setCopyStatus("idle");
      transitionTo("coverage");
    } catch (nextError) {
      if (version === requestVersion.current) setError(safeErrorMessage(nextError));
    } finally {
      if (version === requestVersion.current) setOperation("idle");
    }
  }

  async function handleCompile() {
    if (!analysis || !retrieval || operation !== "idle") return;
    const version = ++requestVersion.current;
    setOperation("compiling");
    setError(null);
    try {
      const nextCompiled = await compileQuestionApi({
        rawQuestion,
        analysis,
        clarificationAnswers: answers,
        retrieval
      });
      if (version !== requestVersion.current) return;

      // React state updates are async, so the just-produced Result is persisted from a locally
      // built snapshot rather than from the stale pre-compile `sessionDraft`. This keeps the
      // existing "persist before handoff" guarantee without waiting for the 250 ms debounce.
      const resultConversationId = conversationId ?? createConversationId();
      const resultCreatedAt = conversationCreatedAt ?? Date.now();
      if (conversationId === null) setConversationId(resultConversationId);
      if (conversationCreatedAt === null) setConversationCreatedAt(resultCreatedAt);
      saveQuestionSession({
        conversationId: resultConversationId,
        createdAt: resultCreatedAt,
        stage: "result",
        rawQuestion,
        answers,
        analysis,
        retrieval,
        compiled: nextCompiled
      });

      setCompiled(nextCompiled);
      setCopyStatus("idle");
      setRestorableSession(null);
      transitionTo("result");
    } catch (nextError) {
      if (version === requestVersion.current) setError(safeErrorMessage(nextError));
    } finally {
      if (version === requestVersion.current) setOperation("idle");
    }
  }

  async function handleCopy() {
    if (!compiled) return;
    try {
      await navigator.clipboard.writeText(formatPublishableQuestion(compiled.publishableQuestion));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  function handleNewQuestion() {
    cancelPending();
    // Persist whatever the user had, then start clean. The previous question is deliberately
    // retained in Recent History rather than deleted.
    flushQuestionSession();
    setActiveConversationId(null);
    setConversationId(null);
    setConversationCreatedAt(null);
    // The blank Input stays usable and the History drawer still lists prior sessions.
    setRestorableSession(null);
    setRawQuestion("");
    setAnswers({});
    setAnalysis(null);
    setRetrieval(null);
    setCompiled(null);
    setError(null);
    setCopyStatus("idle");
    transitionTo("input");
    setSceneResetEpoch((value) => value + 1);
  }

  function restoreLastSession() {
    const candidate = restorableSession;
    if (!candidate) return;
    const session = loadQuestionSession(candidate.conversationId);
    if (!session) {
      setRestorableSession(null);
      return;
    }
    setActiveConversationId(session.conversationId);
    setRestorableSession(null);
    hydrateQuestionSession(session);
  }

  /** Dismissal is UI-only: it must not delete the stored history entry. */
  function dismissResumeCandidate() {
    setRestorableSession(null);
  }

  function handleReoptimize() {
    cancelPending();
    setRetrieval(null);
    setCompiled(null);
    setError(null);
    setCopyStatus("idle");
    transitionTo("clarify");
  }

  function handleOpenZhihu() {
    // Force a synchronous flush so the session is durable before the user leaves for Zhihu.
    flushQuestionSession();
    window.open("https://www.zhihu.com/", "_blank", "noopener,noreferrer");
  }

  function handleOpenHistory() {
    // Refreshed on open; the drawer does not need to rerender on every autosaved keystroke.
    setRecentSessions(listRecentQuestionSessions());
    setHistoryOpen(true);
  }

  function handleSelectHistory(selectedConversationId: string) {
    const session = loadQuestionSession(selectedConversationId);
    if (!session) return;
    flushQuestionSession();
    setActiveConversationId(selectedConversationId);
    setRestorableSession(null);
    hydrateQuestionSession(session);
    setHistoryOpen(false);
  }

  function renderStage(stageToRender: QuestionCompilerStage) {
    switch (stageToRender) {
      case "input":
        return (
          <>
            {restorableSession && (
              <ResumeSessionCard
                session={restorableSession}
                onResume={restoreLastSession}
                onDismiss={dismissResumeCandidate}
              />
            )}
            <InputStage
              rawQuestion={rawQuestion}
              ready={ready}
              loading={operation === "analyzing"}
              error={error}
              onChange={handleRawQuestionChange}
              onContinue={handleAnalyze}
            />
          </>
        );

      case "clarify":
        return analysis ? (
          <ClarificationStage
            questions={analysis.clarificationQuestions}
            answers={answers}
            answeredCount={answeredCount}
            onAnswer={handleAnswer}
            onBack={back}
            onContinue={handleClarifyContinue}
          />
        ) : null;

      case "diagnose":
        return analysis ? (
          <DiagnosisStage
            rawQuestion={rawQuestion}
            intent={analysis.intent}
            diagnostics={analysis.diagnostics}
            loading={operation === "retrieving"}
            error={error}
            onBack={back}
            onContinue={handleRetrieve}
          />
        ) : null;

      case "coverage":
        return retrieval ? (
          <CoverageStage
            coverage={retrieval.existingCoverage}
            gaps={retrieval.knowledgeGaps}
            evidence={retrieval.evidence}
            status={retrieval.status}
            loading={operation === "compiling"}
            error={error}
            onBack={back}
            onContinue={handleCompile}
          />
        ) : null;

      case "result":
        return compiled ? (
          <ResultStage
            rawQuestion={rawQuestion}
            question={compiled.compiledQuestion}
            publishableQuestion={compiled.publishableQuestion}
            evidenceUsed={compiled.evidenceUsed}
            warnings={compiled.warnings}
            copyStatus={copyStatus}
            onCopy={handleCopy}
            onReoptimize={handleReoptimize}
            onNewQuestion={handleNewQuestion}
            onOpenZhihu={handleOpenZhihu}
          />
        ) : null;
    }
  }

  return (
    <main className="app-shell">
      <AppHeader onOpenHistory={handleOpenHistory} onNewQuestion={handleNewQuestion} />
      <div className="page-container">
        <StageTransitionViewport
          key={sceneResetEpoch}
          targetStage={stage}
          scene={renderStage(stage)}
          resetEpoch={sceneResetEpoch}
        />
      </div>
      <SessionHistoryDrawer
        open={historyOpen}
        sessions={recentSessions}
        activeConversationId={conversationId}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleSelectHistory}
      />
    </main>
  );
}
