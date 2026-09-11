import type { CompiledQuestion } from "@ask-better/domain";

export function CompiledQuestionPanel({ question }: { question: CompiledQuestion }) {
  return (
    <section className="workspace-panel compiled-panel">
      <div className="panel-heading"><div><h2>编译结果</h2><span>Compiled</span></div><span className="panel-badge panel-badge-success">可继续编辑</span></div>
      <div className="panel-content">
        <article className="compiled-card">
          <h3>{question.title}</h3>
          <dl className="compiled-details"><div><dt>背景</dt><dd>{question.background}</dd></div><div><dt>目标</dt><dd>{question.goal}</dd></div><div><dt>真正困惑</dt><dd>{question.coreUncertainty}</dd></div></dl>
          <div className="expectation-row">{question.expectedAnswer.map((item) => <span key={item}>{item}</span>)}</div>
        </article>
        <div className="action-row"><button className="primary-button" type="button">复制问题</button><button className="secondary-button" type="button">重新优化</button><button className="secondary-button" type="button">去知乎提问</button></div>
      </div>
    </section>
  );
}
