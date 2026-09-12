import type { CompiledQuestion } from "@ask-better/domain";
import { CompiledQuestionPanel } from "./compiled-question-panel";

interface ResultStageProps {
  rawQuestion: string;
  question: CompiledQuestion;
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
  evidenceUsed,
  warnings = [],
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
      <p className="result-evidence-note">
        {evidenceUsed
          ? "编译时已参考本次知乎检索证据，用于判断已有覆盖与知识缺口。"
          : "本次编译未使用知乎检索证据，结果仅基于你提供的问题与补充条件。"}
      </p>
      {warnings.length > 0 && (
        <div className="result-warning-list" role="status">
          {warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}
      <div className="before-after-grid">
        <article className="before-card">
          <div className="flow-heading">
            <div><span className="section-kicker">之前</span><h2>原始问题</h2><small>Before</small></div>
          </div>
          <p>{rawQuestion}</p>
        </article>
        <CompiledQuestionPanel
          question={question}
          evidenceUsed={evidenceUsed}
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
