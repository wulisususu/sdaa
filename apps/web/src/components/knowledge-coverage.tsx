import type { KnowledgeCoverageItem, SearchEvidenceItem } from "@ask-better/domain";
import { useState } from "react";

interface KnowledgeCoverageProps {
  items: KnowledgeCoverageItem[];
  evidence: SearchEvidenceItem[];
}

function strengthLabel(strength: KnowledgeCoverageItem["strength"]): string {
  if (strength === "high") return "较充分";
  if (strength === "medium") return "部分覆盖";
  return "较少";
}

export function getVisibleEvidence<T>(
  items: T[],
  expanded: boolean,
  initialCount = 5
): T[] {
  return expanded || items.length <= initialCount
    ? items
    : items.slice(0, initialCount);
}

export function KnowledgeCoverage({ items, evidence }: KnowledgeCoverageProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleEvidence = getVisibleEvidence(evidence, expanded);
  const canExpand = evidence.length > 5;

  return (
    <section className="knowledge-card">
      <div className="knowledge-heading">
        <div>
          <h2>已有讨论</h2>
          <span>Existing Knowledge</span>
        </div>
        {evidence.length > 0 && (
          <span className="panel-badge">知乎检索 · {evidence.length} 条</span>
        )}
      </div>

      <div className="coverage-list">
        {items.map((item) => (
          <article className="coverage-item" key={item.id}>
            <div>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </div>
            <span className={`coverage-strength strength-${item.strength}`}>
              {strengthLabel(item.strength)}
            </span>
          </article>
        ))}
        {items.length === 0 && (
          <p className="knowledge-empty">当前检索证据尚不足以归纳稳定的已有覆盖。</p>
        )}
      </div>

      {evidence.length > 0 && (
        <div className="evidence-source-section">
          <div className="evidence-source-heading">
            <div>
              <strong>本次参考来源</strong>
              <span>基于本次检索结果，不代表知乎全站绝对不存在其他相关讨论。</span>
            </div>
            <span className="evidence-count">{evidence.length} 条 Evidence</span>
          </div>
          <div className="evidence-source-list">
            {visibleEvidence.map((item) => (
              <article className="evidence-source-item" key={`${item.id}-${item.url}`}>
                <a href={item.url} target="_blank" rel="noreferrer">
                  <span>{item.title}</span>
                  <span className="evidence-link-arrow" aria-hidden="true">↗</span>
                </a>
                {item.summary && <p>{item.summary}</p>}
                <div className="evidence-source-meta">
                  <span>{item.author || "知乎用户"}</span>
                  <span>赞同 {item.voteUpCount}</span>
                  <span>评论 {item.commentCount}</span>
                </div>
              </article>
            ))}
          </div>
          {canExpand && (
            <button
              type="button"
              className="evidence-toggle"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded
                ? "收起参考来源"
                : `查看全部 ${evidence.length} 条参考来源`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
