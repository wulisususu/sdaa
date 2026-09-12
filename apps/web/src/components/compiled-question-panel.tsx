import type { CompiledQuestion } from "@ask-better/domain";

interface CompiledQuestionPanelProps {
  question: CompiledQuestion;
  evidenceUsed?: boolean;
  copyStatus?: "idle" | "copied" | "error";
  onCopy?: () => void;
  onReoptimize?: () => void;
  onOpenZhihu?: () => void;
}

export function CompiledQuestionPanel({
  question,
  evidenceUsed = false,
  copyStatus = "idle",
  onCopy,
  onReoptimize,
  onOpenZhihu
}: CompiledQuestionPanelProps) {
  const copyLabel = copyStatus === "copied"
    ? "✓ 已复制"
    : copyStatus === "error"
      ? "复制失败，请重试"
      : "复制问题";

  return (
    <section className="workspace-panel compiled-panel after-card">
      <div className="panel-heading compiled-heading">
        <div>
          <span className="section-kicker">After</span>
          <h2>编译后的问题</h2>
        </div>
        <span className={`panel-badge ${evidenceUsed ? "panel-badge-success" : ""}`}>
          {evidenceUsed ? "Evidence-assisted" : "User context only"}
        </span>
      </div>
      <div className="panel-content">
        <article className="compiled-card">
          <span className="compiled-label">最终标题</span>
          <h3>{question.title}</h3>
          <dl className="compiled-details">
            <div><dt>背景</dt><dd>{question.background}</dd></div>
            <div><dt>目标</dt><dd>{question.goal}</dd></div>
            <div><dt>限制</dt><dd>{question.constraints.length > 0 ? question.constraints.join("；") : "未额外限定"}</dd></div>
            <div><dt>核心困惑</dt><dd>{question.coreUncertainty}</dd></div>
          </dl>
          <div className="expected-answer-block">
            <span className="compiled-label">希望回答者重点讨论</span>
            <div className="expectation-row">
              {question.expectedAnswer.map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
        </article>
        <div className="action-row compiled-actions">
          <button
            className={`primary-button copy-button copy-${copyStatus}`}
            type="button"
            onClick={onCopy}
            aria-live="polite"
          >
            {copyLabel}
          </button>
          <button className="secondary-button" type="button" onClick={onOpenZhihu}>打开知乎提问页 ↗</button>
          <button className="ghost-button" type="button" onClick={onReoptimize}>重新优化</button>
        </div>
      </div>
    </section>
  );
}
