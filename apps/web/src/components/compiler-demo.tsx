"use client";

import {
  canVisitStage,
  countAnsweredClarifications,
  formatCompiledQuestion,
  getNextStage,
  getPreviousStage,
  getStageIndex,
  isRawQuestionReady,
  setClarificationAnswer,
  type ClarificationAnswers,
  type QuestionCompilerStage
} from "@ask-better/domain";
import { useMemo, useState } from "react";
import { mockQuestionState } from "../lib/mock-question";
import { AppHeader } from "./app-header";
import { ClarificationStage } from "./clarification-stage";
import { CoverageStage } from "./coverage-stage";
import { DiagnosisStage } from "./diagnosis-stage";
import { InputStage } from "./input-stage";
import { ResultStage } from "./result-stage";
import { StageStepper } from "./stage-stepper";

type CopyStatus = "idle" | "copied" | "error";

export function CompilerDemo() {
  const [stage, setStage] = useState<QuestionCompilerStage>("input");
  const [maxVisited, setMaxVisited] = useState<QuestionCompilerStage>("input");
  const [rawQuestion, setRawQuestion] = useState(mockQuestionState.rawQuestion);
  const [answers, setAnswers] = useState<ClarificationAnswers>({});
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  const ready = isRawQuestionReady(rawQuestion);
  const answeredCount = useMemo(
    () => countAnsweredClarifications(mockQuestionState.clarificationQuestions, answers),
    [answers]
  );

  function visit(next: QuestionCompilerStage) {
    if (!canVisitStage(next, maxVisited)) return;
    setStage(next);
  }

  function advance() {
    const next = getNextStage(stage);
    setStage(next);
    if (getStageIndex(next) > getStageIndex(maxVisited)) setMaxVisited(next);
  }

  function back() {
    setStage(getPreviousStage(stage));
  }

  function handleAnswer(questionId: string, option: string) {
    setAnswers((current) => setClarificationAnswer(current, questionId, option));
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatCompiledQuestion(mockQuestionState.compiledQuestion));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  function handleNewQuestion() {
    setRawQuestion("");
    setAnswers({});
    setCopyStatus("idle");
    setStage("input");
    setMaxVisited("input");
  }

  function handleReoptimize() {
    setCopyStatus("idle");
    setStage("clarify");
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
          <span className="demo-badge">交互原型 · Mock Data</span>
        </section>

        <StageStepper stage={stage} maxVisited={maxVisited} onChange={visit} />

        {stage === "input" && (
          <InputStage
            rawQuestion={rawQuestion}
            ready={ready}
            onChange={(value) => { setRawQuestion(value); setCopyStatus("idle"); }}
            onContinue={advance}
          />
        )}

        {stage === "clarify" && (
          <ClarificationStage
            questions={mockQuestionState.clarificationQuestions}
            answers={answers}
            answeredCount={answeredCount}
            onAnswer={handleAnswer}
            onBack={back}
            onContinue={advance}
          />
        )}

        {stage === "diagnose" && (
          <DiagnosisStage
            rawQuestion={rawQuestion}
            intent={mockQuestionState.intent}
            diagnostics={mockQuestionState.diagnostics}
            onBack={back}
            onContinue={advance}
          />
        )}

        {stage === "coverage" && (
          <CoverageStage
            coverage={mockQuestionState.existingCoverage}
            gaps={mockQuestionState.knowledgeGaps}
            onBack={back}
            onContinue={advance}
          />
        )}

        {stage === "result" && (
          <ResultStage
            rawQuestion={rawQuestion}
            question={mockQuestionState.compiledQuestion}
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
