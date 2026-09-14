import type { CompiledQuestion, PublishableQuestion } from "@ask-better/domain";
import { CompiledQuestionPanel } from "./compiled-question-panel";

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
    <section className="flow-stage flow-stage-wide result-stage">
      <div className="result-status" role="status">
        <span className="result-check" aria-hidden="true">✓</span>
        <div className="result-status-copy">
          <strong>问题已编译完成</strong>
          <small>Question successfully compiled</small>
        </div>
        <span className={`result-provenance ${evidenceUsed ? "has-evidence" : ""}`}>
          {evidenceUsed ? "已参考本次知乎 Evidence" : "仅基于用户提供的信息"}
        </span>
      </div>

      <p className="result-evidence-note">
        {evidenceUsed
          ? "知乎检索结果只用于判断已有覆盖与知识缺口；你的个人背景和约束仍只来自你自己提供的信息。"
          : "本次编译未使用知乎检索证据，结果仅基于你提供的问题与补充条件。"}
      </p>

      {warnings.length > 0 && (
        <div className="result-warning-list" role="status">
          {warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}

      <div className="before-after-grid">
        <article className="before-card" data-motion="before">
          <div className="flow-heading">
            <div>
              <span className="section-kicker">Before</span>
              <h2>你一开始的问题</h2>
            </div>
          </div>
          <blockquote>{rawQuestion}</blockquote>
          <div className="before-card-caption">原始表达保持不变，用来直观看见这次“编译”补充了什么。</div>
        </article>

        <div className="compile-bridge" aria-hidden="true">
          <span>Compile</span>
          <strong>→</strong>
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
    </section>
  );
}
