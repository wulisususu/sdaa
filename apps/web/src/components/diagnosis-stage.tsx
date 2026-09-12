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

function severityLabel(level: QuestionDiagnostic["level"]): string {
  if (level === "high") return "高优先级";
  if (level === "warning") return "建议优化";
  return "提示";
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
              <span className="section-kicker">Question Snapshot</span>
              <h2>{rawQuestion}</h2>
              <small>你的原始问题</small>
            </div>
          </div>
          <div className="intent-box">
            <div className="section-kicker">我理解你主要在判断</div>
            <div className="chip-row">{intent.map((item) => <span className="chip" key={item}>{item}</span>)}</div>
          </div>
          <p className="diagnosis-hint">如果这里理解偏了，可以返回上一阶段调整条件，再重新检查。</p>
        </aside>

        <div className="flow-card diagnosis-findings-card">
          <div className="flow-heading flow-heading-split">
            <div>
              <span className="section-kicker">Question Diagnostics</span>
              <h2>发现 {diagnostics.length} 个值得优化的地方</h2>
              <small>不是语法错误，而是可能影响回答质量的信息问题</small>
            </div>
            <span className="answer-progress">{diagnostics.length} 项发现</span>
          </div>
          <div className="diagnostic-list diagnosis-list-large">
            {diagnostics.map((item) => (
              <article className={`diagnostic-card diagnostic-${item.level}`} key={item.code}>
                <div className="diagnostic-meta">
                  <span className="diagnostic-code">{item.code}</span>
                  <span className="diagnostic-severity">{severityLabel(item.level)}</span>
                </div>
                <div className="diagnostic-copy">
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
      {error && <p className="pipeline-error" role="alert">{error}</p>}
      <div className="stage-action-bar detached-actions">
        <button className="secondary-button" type="button" onClick={onBack}>返回补充信息</button>
        <button className="primary-button" type="button" onClick={onContinue} disabled={loading} aria-busy={loading}>
          {loading ? <><span className="button-spinner" aria-hidden="true" />正在知乎已有讨论中查找相关内容…</> : <>查看知乎已有讨论 <span aria-hidden="true">→</span></>}
        </button>
      </div>
    </section>
  );
}
