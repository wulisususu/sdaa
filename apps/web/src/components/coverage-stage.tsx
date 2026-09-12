import type {
  KnowledgeCoverageItem,
  KnowledgeGapItem,
  RetrievalStatus,
  SearchEvidenceItem
} from "@ask-better/domain";
import { KnowledgeCoverage } from "./knowledge-coverage";
import { KnowledgeGap } from "./knowledge-gap";

interface CoverageStageProps {
  coverage: KnowledgeCoverageItem[];
  gaps: KnowledgeGapItem[];
  evidence: SearchEvidenceItem[];
  status: RetrievalStatus;
  loading?: boolean;
  error?: string | null;
  onBack: () => void;
  onContinue: () => void;
}

const statusCopy: Record<RetrievalStatus, string> = {
  success: "已基于知乎检索结果分析",
  partial: "已拿到部分结果，可以继续编译",
  quota_limited: "知乎检索额度暂时受限，以下为已获取结果",
  unavailable: "本次未加入知乎已有讨论证据，仍可继续整理问题"
};

export function CoverageStage({
  coverage,
  gaps,
  evidence,
  status,
  loading = false,
  error = null,
  onBack,
  onContinue
}: CoverageStageProps) {
  return (
    <section className="flow-stage flow-stage-wide">
      <div className="flow-heading stage-section-heading">
        <div>
          <span className="section-kicker">知乎知识覆盖</span>
          <h2>先看已经讨论过什么，再决定还值不值得问</h2>
          <small>Knowledge Coverage</small>
        </div>
      </div>
      <p className={`retrieval-status retrieval-status-${status}`}>{statusCopy[status]}</p>
      <div className="knowledge-grid stage-knowledge-grid">
        <KnowledgeCoverage items={coverage} evidence={evidence} />
        <KnowledgeGap items={gaps} />
      </div>
      {error && <p className="pipeline-error" role="alert">{error}</p>}
      <div className="stage-action-bar detached-actions">
        <button className="secondary-button" type="button" onClick={onBack}>返回问题体检</button>
        <button className="primary-button" type="button" onClick={onContinue} disabled={loading}>
          {loading ? "正在把信息编译成一个更清楚的问题…" : "编译我的问题"}
        </button>
      </div>
    </section>
  );
}
