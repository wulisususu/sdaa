import type { CompiledQuestion } from "@ask-better/domain";
import { CompiledQuestionPanel } from "./compiled-question-panel";

interface ResultStageProps {
  rawQuestion: string;
  question: CompiledQuestion;
  copyStatus: "idle" | "copied" | "error";
  onCopy: () => void;
  onReoptimize: () => void;
  onNewQuestion: () => void;
  onOpenZhihu: () => void;
}

export function ResultStage({
  rawQuestion,
  question,
  copyStatus,
  onCopy,
  onReoptimize,
  onNewQuestion,
  onOpenZhihu
}: ResultStageProps) {
  return (
    <section className="flow-stage flow-stage-wide">
      <div className="result-status">
        <span className="result-check">✓</span>
        <div><strong>问题已经整理完成</strong><small>Question Compiled</small></div>
      </div>
      <div className="before-after-grid">
        <article className="before-card">
          <div className="flow-heading">
            <div><span className="section-kicker">之前</span><h2>原始问题</h2><small>Before</small></div>
          </div>
          <p>{rawQuestion}</p>
        </article>
        <CompiledQuestionPanel
          question={question}
          copyStatus={copyStatus}
          onCopy={onCopy}
          onReoptimize={onReoptimize}
          onOpenZhihu={onOpenZhihu}
        />
      </div>
      <div className="result-footer-actions">
        <button className="ghost-button" type="button" onClick={onNewQuestion}>新建一个问题</button>
      </div>
    </section>
  );
}
