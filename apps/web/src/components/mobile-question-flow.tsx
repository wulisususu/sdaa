import { stageEnglishLabels, stageLabels, type QuestionCompilerState, type QuestionCompilerStage } from "@ask-better/domain";

interface MobileQuestionFlowProps {
  state: QuestionCompilerState;
  stage: QuestionCompilerStage;
  rawQuestion: string;
  onRawQuestionChange: (value: string) => void;
  onNext: () => void;
}

export function MobileQuestionFlow({ state, stage, rawQuestion, onRawQuestionChange, onNext }: MobileQuestionFlowProps) {
  const stageIndex = ["input", "clarify", "diagnose", "coverage", "result"].indexOf(stage) + 1;
  return (
    <section className="mobile-flow">
      <div className="mobile-stage-header"><div><span className="section-kicker">当前步骤</span><h2>{stageLabels[stage]}</h2><small>{stageEnglishLabels[stage]}</small></div><span className="mobile-stage-count">{stageIndex} / 5</span></div>
      {stage === "input" && <div className="mobile-stage-card"><label className="field-label" htmlFor="mobile-question">你想问什么？</label><textarea id="mobile-question" value={rawQuestion} onChange={(event) => onRawQuestionChange(event.target.value)} rows={6} /></div>}
      {stage === "clarify" && <div className="mobile-stage-card clarification-list">{state.clarificationQuestions.map((item) => <article key={item.id}><h3>{item.question}</h3>{item.helper && <p>{item.helper}</p>}<div className="option-list">{item.options.map((option) => <button type="button" key={option}>{option}</button>)}</div></article>)}</div>}
      {stage === "diagnose" && <div className="mobile-stage-card diagnostic-list">{state.diagnostics.map((item) => <article className={`diagnostic-card diagnostic-${item.level}`} key={item.code}><div className="diagnostic-code">{item.code}</div><div><h3>{item.title}</h3><p>{item.summary}</p></div></article>)}</div>}
      {stage === "coverage" && <div className="mobile-stage-card"><div className="mobile-subsection"><h3>已有讨论</h3><small>Existing Knowledge</small></div>{state.existingCoverage.map((item) => <div className="compact-row" key={item.id}><strong>{item.title}</strong><span>{item.detail}</span></div>)}<div className="mobile-subsection mobile-gap-title"><h3>还值得继续问什么</h3><small>Knowledge Gap</small></div>{state.knowledgeGaps.map((item) => <div className="compact-gap" key={item.id}><strong>{item.title}</strong><span>{item.detail}</span></div>)}</div>}
      {stage === "result" && <div className="mobile-stage-card"><div className="compiled-card mobile-compiled"><h3>{state.compiledQuestion.title}</h3><p>{state.compiledQuestion.coreUncertainty}</p></div><div className="mobile-action-stack"><button className="primary-button" type="button">复制问题</button><button className="secondary-button" type="button">去知乎提问</button></div></div>}
      <button className="mobile-next primary-button" type="button" onClick={onNext} disabled={stage === "result"}>{stage === "result" ? "已经完成" : "继续"}</button>
    </section>
  );
}
