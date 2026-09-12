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
  const copyLabel = copyStatus === "copied" ? "已复制" : copyStatus === "error" ? "复制失败" : "复制问题";

  return (
    <section className="workspace-panel compiled-panel">
      <div className="panel-heading">
        <div><h2>编译结果</h2><span>Compiled</span></div>
        <span className="panel-badge panel-badge-success">
          {evidenceUsed ? "已参考检索证据" : "仅用户上下文"}
        </span>
      </div>
      <div className="panel-content">
        <article className="compiled-card">
          <h3>{question.title}</h3>
          <dl className="compiled-details">
            <div><dt>背景</dt><dd>{question.background}</dd></div>
            <div><dt>目标</dt><dd>{question.goal}</dd></div>
            <div><dt>限制</dt><dd>{question.constraints.join("；")}</dd></div>
            <div><dt>真正困惑</dt><dd>{question.coreUncertainty}</dd></div>
          </dl>
          <div className="expectation-row">{question.expectedAnswer.map((item) => <span key={item}>{item}</span>)}</div>
        </article>
        <div className="action-row">
          <button className="primary-button" type="button" onClick={onCopy}>{copyLabel}</button>
          <button className="secondary-button" type="button" onClick={onReoptimize}>重新优化</button>
          <button className="secondary-button" type="button" onClick={onOpenZhihu}>去知乎提问</button>
        </div>
      </div>
    </section>
  );
}
