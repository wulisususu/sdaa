import type { QuestionDiagnostic } from "@ask-better/domain";

interface DiagnosisStageProps {
  rawQuestion: string;
  intent: string[];
  diagnostics: QuestionDiagnostic[];
  loading?: boolean;
  error?: string | null;
  onBack: () => void;
  onContinue: () => void;
}

export function DiagnosisStage({
  rawQuestion,
  intent,
  diagnostics,
  loading = false,
  error = null,
  onBack,
  onContinue
}: DiagnosisStageProps) {
  return (
    <section className="flow-stage flow-stage-wide">
      <div className="diagnosis-layout">
        <aside className="flow-card diagnosis-question-card">
          <div className="flow-heading">
            <div>
              <span className="section-kicker">你的问题</span>
              <h2>{rawQuestion}</h2>
              <small>Original Question</small>
            </div>
          </div>
          <div className="intent-box">
            <div className="section-kicker">我理解你主要在问</div>
            <div className="chip-row">{intent.map((item) => <span className="chip" key={item}>{item}</span>)}</div>
          </div>
        </aside>

        <div className="flow-card">
          <div className="flow-heading flow-heading-split">
            <div>
              <span className="section-kicker">问题体检</span>
              <h2>发现 {diagnostics.length} 个需要改进的地方</h2>
              <small>Diagnostics</small>
            </div>
            <span className="answer-progress">{diagnostics.length} 项</span>
          </div>
          <div className="diagnostic-list diagnosis-list-large">
            {diagnostics.map((item) => (
              <article className={`diagnostic-card diagnostic-${item.level}`} key={item.code}>
                <div className="diagnostic-code">{item.code}</div>
                <div><h3>{item.title}</h3><p>{item.summary}</p></div>
              </article>
            ))}
          </div>
        </div>
      </div>
      {error && <p className="pipeline-error" role="alert">{error}</p>}
      <div className="stage-action-bar detached-actions">
        <button className="secondary-button" type="button" onClick={onBack}>返回补充信息</button>
        <button className="primary-button" type="button" onClick={onContinue} disabled={loading}>
          {loading ? "正在知乎已有讨论中查找相关内容…" : "查看知乎已有讨论"}
        </button>
      </div>
    </section>
  );
}
