"use client";

import { getNextStage, type QuestionCompilerStage } from "@ask-better/domain";
import { useMemo, useState } from "react";
import { mockQuestionState } from "../lib/mock-question";
import { AppHeader } from "./app-header";
import { MobileQuestionFlow } from "./mobile-question-flow";
import { QuestionIde } from "./question-ide";
import { StageStepper } from "./stage-stepper";

export function CompilerDemo() {
  const [stage, setStage] = useState<QuestionCompilerStage>(mockQuestionState.stage);
  const [rawQuestion, setRawQuestion] = useState(mockQuestionState.rawQuestion);
  const state = useMemo(() => ({ ...mockQuestionState, stage, rawQuestion }), [stage, rawQuestion]);

  return (
    <main className="app-shell"><AppHeader /><div className="page-container">
      <section className="page-intro"><div><span className="eyebrow">知乎 AI 提问编译器</span><h1>把模糊需求，编译成值得回答的问题</h1><p>先把问题问清楚，再进入答案世界。</p></div><span className="demo-badge">前端原型 · Mock Data</span></section>
      <div className="desktop-only"><StageStepper stage={stage} onChange={setStage} /></div>
      <div className="desktop-only"><QuestionIde state={state} rawQuestion={rawQuestion} onRawQuestionChange={setRawQuestion} /></div>
      <div className="mobile-only"><MobileQuestionFlow state={state} stage={stage} rawQuestion={rawQuestion} onRawQuestionChange={setRawQuestion} onNext={() => setStage(getNextStage(stage))} /></div>
    </div></main>
  );
}
