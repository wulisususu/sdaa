import type { CompiledQuestion, PublishableQuestion } from "@ask-better/domain";
import { ActionIcon, type ActionIconName } from "./action-icons";

interface CompiledQuestionPanelProps {
  question: CompiledQuestion;
  publishableQuestion: PublishableQuestion;
  evidenceUsed?: boolean;
  copyStatus?: "idle" | "copied" | "error";
  onCopy?: () => void;
  onReoptimize?: () => void;
  onNewQuestion?: () => void;
  onOpenZhihu?: () => void;
}

export function CompiledQuestionPanel({
  question,
  publishableQuestion,
  evidenceUsed = false,
  copyStatus = "idle",
  onCopy,
  onReoptimize,
  onNewQuestion,
  onOpenZhihu
}: CompiledQuestionPanelProps) {
  const copyLabel = copyStatus === "copied"
    ? "已复制"
    : copyStatus === "error"
      ? "重试"
      : "复制";
  const copyIcon: ActionIconName = copyStatus === "copied"
    ? "check"
    : copyStatus === "error"
      ? "retry"
      : "copy";

  return (
    <section className="workspace-panel compiled-panel after-card" data-motion="after">
      <div className="panel-heading compiled-heading">
        <div>
          <span className="section-kicker">After · Publishable</span>
          <h2>知乎可发布版本</h2>
        </div>
        <span className={`panel-badge ${evidenceUsed ? "panel-badge-success" : ""}`}>
          {evidenceUsed ? "Evidence-assisted" : "User context only"}
        </span>
      </div>

      <div className="panel-content">
        <article className="compiled-card publishable-card">
          <span className="compiled-label">最终标题</span>
          <h3>{publishableQuestion.title}</h3>
          <p className="publishable-context">{publishableQuestion.context}</p>
          <div className="expected-answer-block publishable-questions-block">
            <span className="compiled-label">想请教</span>
            <ol className="publishable-question-list">
              {publishableQuestion.questions.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </div>
        </article>

        <details className="compiler-details">
          <summary>查看编译细节 <span>Question IR</span></summary>
          <div className="compiler-details-body">
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
          </div>
        </details>

        <div className="action-row compiled-actions mobile-sticky-actions" data-motion="result-actions">
          <button
            className={`primary-button copy-button copy-${copyStatus}`}
            type="button"
            onClick={onCopy}
            aria-live="polite"
          >
            <ActionIcon name={copyIcon} />
            {copyLabel}
          </button>
          <button className="secondary-button" type="button" onClick={onOpenZhihu}>
            <ActionIcon name="external-link" />
            打开知乎
          </button>
          <button className="ghost-button" type="button" onClick={onReoptimize}>
            <ActionIcon name="sparkles" />
            继续优化
          </button>
          <button className="ghost-button" type="button" onClick={onNewQuestion}>
            <ActionIcon name="plus" />
            新问题
          </button>
        </div>
      </div>
    </section>
  );
}
