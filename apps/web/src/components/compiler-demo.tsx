"use client";

import {
  canVisitStage,
  countAnsweredClarifications,
  formatCompiledQuestion,
  getPreviousStage,
  getStageIndex,
  isRawQuestionReady,
  setClarificationAnswer,
  type ClarificationAnswers,
  type CompileResult,
  type QuestionAnalysis,
  type QuestionCompilerStage,
  type RetrieveResult
} from "@ask-better/domain";
import { useMemo, useRef, useState } from "react";
import {
  analyzeQuestionApi,
  compileQuestionApi,
  retrieveQuestionApi
} from "../lib/api-client";
import { AppHeader } from "./app-header";
import { ClarificationStage } from "./clarification-stage";
import { CoverageStage } from "./coverage-stage";
import { DiagnosisStage } from "./diagnosis-stage";
import { InputStage } from "./input-stage";
import { ResultStage } from "./result-stage";
import { StageStepper } from "./stage-stepper";

type CopyStatus = "idle" | "copied" | "error";
type Operation = "idle" | "analyzing" | "retrieving" | "compiling";

export function capVisitedStageAfterAnswer(
  current: QuestionCompilerStage
): QuestionCompilerStage {
  return getStageIndex(current) > getStageIndex("diagnose")
    ? "diagnose"
    : current;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "处理失败，请重试。";
}

export function CompilerDemo() {
  const [stage, setStage] = useState<QuestionCompilerStage>("input");
  const [maxVisited, setMaxVisited] = useState<QuestionCompilerStage>("input");
  const [rawQuestion, setRawQuestion] = useState("");
  const [answers, setAnswers] = useState<ClarificationAnswers>({});
  const [analysis, setAnalysis] = useState<QuestionAnalysis | null>(null);
  const [retrieval, setRetrieval] = useState<RetrieveResult | null>(null);
  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [operation, setOperation] = useState<Operation>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const requestVersion = useRef(0);

  const ready = isRawQuestionReady(rawQuestion);
  const clarificationQuestions = analysis?.clarificationQuestions ?? [];
  const answeredCount = useMemo(
    () => countAnsweredClarifications(clarificationQuestions, answers),
    [clarificationQuestions, answers]
  );

  function markVisited(next: QuestionCompilerStage) {
    setStage(next);
    setMaxVisited((current) =>
      getStageIndex(next) > getStageIndex(current) ? next : current
    );
  }

  function cancelPending() {
    requestVersion.current += 1;
    setOperation("idle");
  }

  function visit(next: QuestionCompilerStage) {
    if (!canVisitStage(next, maxVisited)) return;
    if (next !== stage && operation !== "idle") cancelPending();
    setStage(next);
  }

  function back() {
    cancelPending();
    setError(null);
    setStage(getPreviousStage(stage));
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
    setStage("input");
    setMaxVisited("input");
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
      markVisited("clarify");
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
    setMaxVisited((current) => capVisitedStageAfterAnswer(current));
  }

  function handleClarifyContinue() {
    if (!analysis) return;
    setError(null);
    markVisited("diagnose");
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
      markVisited("coverage");
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
      markVisited("result");
    } catch (nextError) {
      if (version === requestVersion.current) setError(safeErrorMessage(nextError));
    } finally {
      if (version === requestVersion.current) setOperation("idle");
    }
  }

  async function handleCopy() {
    if (!compiled) return;
    try {
      await navigator.clipboard.writeText(formatCompiledQuestion(compiled.compiledQuestion));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  function handleNewQuestion() {
    cancelPending();
    setRawQuestion("");
    setAnswers({});
    setAnalysis(null);
    setRetrieval(null);
    setCompiled(null);
    setError(null);
    setCopyStatus("idle");
    setStage("input");
    setMaxVisited("input");
  }

  function handleReoptimize() {
    cancelPending();
    setRetrieval(null);
    setCompiled(null);
    setError(null);
    setCopyStatus("idle");
    setStage("clarify");
    setMaxVisited("diagnose");
  }

  function handleOpenZhihu() {
    window.open("https://www.zhihu.com/question/ask", "_blank", "noopener,noreferrer");
  }

  return (
    <main className="app-shell">
      <AppHeader onNewQuestion={handleNewQuestion} />
      <div className="page-container">
        <section className="page-intro">
          <div>
            <span className="eyebrow">知乎 AI 提问编译器</span>
            <h1>把模糊需求，整理成值得回答的问题</h1>
            <p>先把问题问清楚，再进入答案世界。</p>
          </div>
          <span className="demo-badge">真实链路 · AI + 知乎检索</span>
        </section>

        <StageStepper stage={stage} maxVisited={maxVisited} onChange={visit} />

        {stage === "input" && (
          <InputStage
            rawQuestion={rawQuestion}
            ready={ready}
            loading={operation === "analyzing"}
            error={error}
            onChange={handleRawQuestionChange}
            onContinue={handleAnalyze}
          />
        )}

        {stage === "clarify" && analysis && (
          <ClarificationStage
            questions={analysis.clarificationQuestions}
            answers={answers}
            answeredCount={answeredCount}
            onAnswer={handleAnswer}
            onBack={back}
            onContinue={handleClarifyContinue}
          />
        )}

        {stage === "diagnose" && analysis && (
          <DiagnosisStage
            rawQuestion={rawQuestion}
            intent={analysis.intent}
            diagnostics={analysis.diagnostics}
            loading={operation === "retrieving"}
            error={error}
            onBack={back}
            onContinue={handleRetrieve}
          />
        )}

        {stage === "coverage" && retrieval && (
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
        )}

        {stage === "result" && compiled && (
          <ResultStage
            rawQuestion={rawQuestion}
            question={compiled.compiledQuestion}
            evidenceUsed={compiled.evidenceUsed}
            warnings={compiled.warnings}
            copyStatus={copyStatus}
            onCopy={handleCopy}
            onReoptimize={handleReoptimize}
            onNewQuestion={handleNewQuestion}
            onOpenZhihu={handleOpenZhihu}
          />
        )}
      </div>
    </main>
  );
}
