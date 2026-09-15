import type { CompiledQuestion, PublishableQuestion } from "@ask-better/domain";
import { CompiledQuestionPanel } from "./compiled-question-panel";
import styles from "./result-stage.module.css";

interface ResultStageProps {
  rawQuestion: string;
  question: CompiledQuestion;
  publishableQuestion: PublishableQuestion;
  evidenceUsed: boolean;
  warnings?: string[];
  copyStatus: "idle" | "copied" | "error";
  onCopy: () => void;
  onReoptimize: () => void;
  onNewQuestion: () => void;
  onOpenZhihu: () => void;
}

/**
 * The Result screen: one white panel containing the whole result, in reading order —
 * heading, status, warnings, the `original -> publishable` comparison, then the compiled details and
 * the four actions.
 *
 * The composition used to be three surfaces (`Before` card, a `Compile ->` bridge, and the compiled
 * workspace panel) stacked on the scene backdrop, so the backdrop was visible between them and the
 * stage read as three screens. The bridge is gone, the cards are de-chromed by
 * `result-stage.module.css`, and one `.flow-card` now carries the surface. Class names like
 * `.before-card` and `.compiled-panel-body` survive because `globals.css` and `scene-contrast.css`
 * anchor real rules to them; only the chrome is neutralised.
 *
 * `evidenceUsed` stays a required prop and is still forwarded: the two render sites that used it were
 * removed with the old composition, and the badge inside `CompiledQuestionPanel` is what carries the
 * semantics now.
 */
export function ResultStage({
  rawQuestion,
  question,
  publishableQuestion,
  evidenceUsed,
  warnings = [],
  copyStatus,
  onCopy,
  onReoptimize,
  onNewQuestion,
  onOpenZhihu
}: ResultStageProps) {
  return (
    <section
      className={`flow-stage flow-stage-wide result-stage ${styles.resultStage}`}
      data-result-stage="true"
    >
      <div className={`flow-card ${styles.resultPanel}`} data-result-panel="true">
        <div
          className={`flow-heading stage-section-heading ${styles.resultHeader}`}
          data-result-heading="true"
        >
          <div>
            <span className="section-kicker">05 / 05 · COMPILED</span>
            <h2 data-motion="headline">这个问题现在可以拿去问了</h2>
            <small>Original → Publishable</small>
          </div>
          <div className={`result-status ${styles.statusLine}`} role="status" data-result-status="true">
            <span className="result-check" aria-hidden="true">✓</span>
            <div className="result-status-copy">
              <strong>问题已编译完成</strong>
              <small>Question successfully compiled</small>
            </div>
          </div>
        </div>

        {warnings.length > 0 && (
          <div
            className={`result-warning-list ${styles.resultWarnings}`}
            role="status"
            data-result-warnings="true"
          >
            {warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        )}

        {/* Bounded container only: the publishable column inside it is the single scroll owner. */}
        <div className={styles.resultBody} data-result-body="true">
          <div
            className={`before-after-grid ${styles.comparison}`}
            data-result-comparison="true"
          >
            <article
              className={`before-card ${styles.originalColumn}`}
              data-motion="before"
              data-result-original="true"
            >
              <div className={`flow-heading ${styles.columnHeading}`}>
                <div>
                  <span className="section-kicker">Before</span>
                  <h2>你一开始的问题</h2>
                </div>
              </div>
              <blockquote tabIndex={0} aria-label="你一开始的问题">{rawQuestion}</blockquote>
            </article>

            <div className={styles.publishColumn} data-result-publishable="true">
              <div className={`flow-heading ${styles.publishHeading}`} data-motion="after">
                <div>
                  <h2>知乎可发布版本</h2>
                </div>
              </div>
              <CompiledQuestionPanel
                question={question}
                publishableQuestion={publishableQuestion}
                evidenceUsed={evidenceUsed}
                copyStatus={copyStatus}
                onCopy={onCopy}
                onReoptimize={onReoptimize}
                onNewQuestion={onNewQuestion}
                onOpenZhihu={onOpenZhihu}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
