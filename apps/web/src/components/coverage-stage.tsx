import type { KnowledgeCoverageItem, KnowledgeGapItem } from "@ask-better/domain";
import { KnowledgeCoverage } from "./knowledge-coverage";
import { KnowledgeGap } from "./knowledge-gap";

interface CoverageStageProps {
  coverage: KnowledgeCoverageItem[];
  gaps: KnowledgeGapItem[];
  onBack: () => void;
  onContinue: () => void;
}

export function CoverageStage({ coverage, gaps, onBack, onContinue }: CoverageStageProps) {
  return (
    <section className="flow-stage flow-stage-wide">
      <div className="flow-heading stage-section-heading">
        <div>
          <span className="section-kicker">知乎知识覆盖</span>
          <h2>先看已经讨论过什么，再决定还值不值得问</h2>
          <small>Knowledge Coverage</small>
        </div>
      </div>
      <div className="knowledge-grid stage-knowledge-grid">
        <KnowledgeCoverage items={coverage} />
        <KnowledgeGap items={gaps} />
      </div>
      <p className="evidence-note">当前为交互原型，下一阶段会用知乎官方搜索结果替换这些演示数据。</p>
      <div className="stage-action-bar detached-actions">
        <button className="secondary-button" type="button" onClick={onBack}>返回问题体检</button>
        <button className="primary-button" type="button" onClick={onContinue}>编译我的问题</button>
      </div>
    </section>
  );
}
