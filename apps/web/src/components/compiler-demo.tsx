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
  clearCompletedSession,
  loadCompletedSession,
  saveCompletedSession,
  type StoredCompletedSessionV1
} from "../lib/completed-session-storage";
import { AppHeader } from "./app-header";
import { ClarificationStage } from "./clarification-stage";
import { CoverageStage } from "./coverage-stage";
import { DiagnosisStage } from "./diagnosis-stage";
import { InputStage } from "./input-stage";
import { ResultStage } from "./result-stage";
import { ResumeSessionCard } from "./resume-session-card";
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
  const [rawQuestion, setRawQuestion] = useState("");
  const [answers, setAnswers] = useState<ClarificationAnswers>({});
  const [analysis, setAnalysis] = useState<QuestionAnalysis | null>(null);
  const [retrieval, setRetrieval] = useState<RetrieveResult | null>(null);
  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [operation, setOperation] = useState<Operation>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [restorableSession, setRestorableSession] = useState<StoredCompletedSessionV1 | null>(null);
  const [sceneResetEpoch, setSceneResetEpoch] = useState(0);
  const requestVersion = useRef(0);

  useEffect(() => {
    setRestorableSession(loadCompletedSession());
  }, []);

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

  function back() {
    cancelPending();
    setError(null);
    transitionTo(getPreviousStage(stage));
  }

  function handleRawQuestionChange(value: string) {
    cancelPending();
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
      setCompiled(nextCompiled);
      setCopyStatus("idle");
      saveCompletedSession({ rawQuestion, answers, analysis, retrieval, compiled: nextCompiled });
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
    clearCompletedSession();
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
    const session = restorableSession;
    if (!session) return;
    cancelPending();
    setRawQuestion(session.rawQuestion);
    setAnswers(session.answers);
    setAnalysis(session.analysis);
    setRetrieval(session.retrieval);
    setCompiled(session.compiled);
    setCopyStatus("idle");
    setError(null);
    setRestorableSession(null);
    transitionTo("result");
    // Recovery is hydration, not a pipeline step. Remount the visual viewport so Result
    // becomes the initial stable scene instead of animating Input -> Result.
    setSceneResetEpoch((value) => value + 1);
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
    if (analysis && retrieval && compiled) {
      saveCompletedSession({ rawQuestion, answers, analysis, retrieval, compiled });
    }
    window.open("https://www.zhihu.com/", "_blank", "noopener,noreferrer");
  }

  function renderStage(stageToRender: QuestionCompilerStage) {
    switch (stageToRender) {
      case "input":
        return (
          <>
            {restorableSession && (
              <ResumeSessionCard
                rawQuestion={restorableSession.rawQuestion}
                onResume={restoreLastSession}
                onDiscard={handleNewQuestion}
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
      <AppHeader onNewQuestion={handleNewQuestion} />
      <div className="page-container">
        <StageTransitionViewport
          key={sceneResetEpoch}
          targetStage={stage}
          scene={renderStage(stage)}
          resetEpoch={sceneResetEpoch}
        />
      </div>
    </main>
  );
}
