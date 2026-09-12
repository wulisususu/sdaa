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
            <span className="section-kicker">补充关键信息</span>
            <h2>把真正会影响答案的条件补完整</h2>
            <small>Clarification Pass</small>
          </div>
          <span className="answer-progress">已回答 {answeredCount} / {questions.length}</span>
        </div>
        <p className="stage-lead">只问高信息增益的问题。不确定的可以跳过，系统不会把未提供的信息当成你的真实背景。</p>
        <div className="clarification-grid">
          {questions.map((item, index) => {
            const answered = Boolean(answers[item.id]);
            return (
              <article className={`clarification-card ${answered ? "is-answered" : ""}`} key={item.id}>
                <div className="clarification-number" aria-hidden="true">{answered ? "✓" : index + 1}</div>
                <div className="clarification-content">
                  <div className="clarification-title-row">
                    <h3>{item.question}</h3>
                    {answered && <span className="answered-label">已补充</span>}
                  </div>
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
                          <span className="option-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                          <span>{option}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="stage-action-bar">
          <button className="secondary-button" type="button" onClick={onBack}>返回修改问题</button>
          <button className="primary-button" type="button" onClick={onContinue}>继续问题体检 <span aria-hidden="true">→</span></button>
        </div>
      </div>
    </section>
  );
}
