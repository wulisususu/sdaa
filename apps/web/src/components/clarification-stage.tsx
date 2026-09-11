import type { ClarificationAnswers, ClarificationQuestion } from "@ask-better/domain";

interface ClarificationStageProps {
  questions: ClarificationQuestion[];
  answers: ClarificationAnswers;
  answeredCount: number;
  onAnswer: (questionId: string, option: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function ClarificationStage({
  questions,
  answers,
  answeredCount,
  onAnswer,
  onBack,
  onContinue
}: ClarificationStageProps) {
  return (
    <section className="flow-stage flow-stage-wide">
      <div className="flow-card">
        <div className="flow-heading flow-heading-split">
          <div>
            <span className="section-kicker">补充信息</span>
            <h2>还差 {questions.length} 个关键条件</h2>
            <small>Clarify</small>
          </div>
          <span className="answer-progress">已回答 {answeredCount} / {questions.length}</span>
        </div>
        <p className="stage-lead">只补充真正会影响答案的条件，不确定的可以跳过。</p>
        <div className="clarification-grid">
          {questions.map((item, index) => (
            <article className="clarification-card" key={item.id}>
              <div className="clarification-number">{index + 1}</div>
              <div className="clarification-content">
                <h3>{item.question}</h3>
                {item.helper && <p>{item.helper}</p>}
                <div className="option-list">
                  {item.options.map((option) => {
                    const selected = answers[item.id] === option;
                    return (
                      <button
                        type="button"
                        key={option}
                        className={`option-button ${selected ? "is-selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => onAnswer(item.id, option)}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="stage-action-bar">
          <button className="secondary-button" type="button" onClick={onBack}>返回修改问题</button>
          <button className="primary-button" type="button" onClick={onContinue}>继续体检</button>
        </div>
      </div>
    </section>
  );
}
