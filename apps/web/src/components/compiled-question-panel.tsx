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

/**
 * The publishable result and the controls that act on it.
 *
 * This is rendered in two places with the same markup contract: standalone (the pipeline UI tests
 * render it directly) and as the right-hand column of `ResultStage`. It therefore stays a fragment of
 * three siblings rather than one wrapping `<section>`: inside the Result the publishable content is
 * the column of a comparison, while the compiled details and the action row belong to the column's
 * own scroll region, so wrapping them in a `.workspace-panel` card would nest a card inside the
 * unified white panel.
 *
 * The three siblings are:
 *   1. the labelled scrollable publishable block (the only tab stop this component contributes),
 *   2. the `<details>` holding the Question IR, closed by default,
 *   3. the four action buttons.
 */
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
    <>
      <div
        className="panel-content"
        data-result-scroll-region="true"
        tabIndex={0}
        aria-label="知乎可发布版本内容"
      >
        <div className="compiled-panel-body">
          <div className="compiled-publishable-scroll">
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
          </div>
        </div>
      </div>

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

      {/*
        The badge and the actions are siblings on purpose. `ResultStage` uses positional CSS
        (`> :nth-child`) to decide which child is the publishable column, which is the compiled
        details, and which is the pinned footer, so the boundaries between the three children must
        stay in one place rather than being duplicated as extra wrapper elements.

        The provenance chip and the evidence note that used to carry `evidenceUsed` in the Result
        stage were removed with the old three-surface composition. This badge is the surviving
        carrier of that meaning, so it is rendered here rather than becoming dead markup.
      */}
      <div className="result-footer" data-result-footer="true">
        <span className={`panel-badge result-evidence-badge ${evidenceUsed ? "panel-badge-success" : ""}`}>
          {evidenceUsed ? "Evidence-assisted" : "User context only"}
        </span>

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
    </>
  );
}
