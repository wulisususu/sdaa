import type { KnowledgeCoverageItem, SearchEvidenceItem } from "@ask-better/domain";

interface KnowledgeCoverageProps {
  items: KnowledgeCoverageItem[];
  evidence: SearchEvidenceItem[];
}

function strengthLabel(strength: KnowledgeCoverageItem["strength"]): string {
  if (strength === "high") return "较充分";
  if (strength === "medium") return "部分覆盖";
  return "较少";
}

export function KnowledgeCoverage({ items, evidence }: KnowledgeCoverageProps) {
  return (
    <section className="knowledge-card">
      <div className="knowledge-heading">
        <div><h2>已有讨论</h2><span>Existing Knowledge</span></div>
        {evidence.length > 0 && <span className="panel-badge">知乎检索结果</span>}
      </div>

      <div className="coverage-list">
        {items.map((item) => (
          <article className="coverage-item" key={item.id}>
            <div><h3>{item.title}</h3><p>{item.detail}</p></div>
            <span className={`coverage-strength strength-${item.strength}`}>{strengthLabel(item.strength)}</span>
          </article>
        ))}
        {items.length === 0 && (
          <p className="knowledge-empty">当前检索证据尚不足以归纳稳定的已有覆盖。</p>
        )}
      </div>

      {evidence.length > 0 && (
        <div className="evidence-source-section">
          <div className="evidence-source-heading">本次参考来源</div>
          <div className="evidence-source-list">
            {evidence.map((item) => (
              <article className="evidence-source-item" key={`${item.id}-${item.url}`}>
                <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
                {item.summary && <p>{item.summary}</p>}
                <div className="evidence-source-meta">
                  <span>{item.author || "知乎用户"}</span>
                  <span>赞同 {item.voteUpCount}</span>
                  <span>评论 {item.commentCount}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
