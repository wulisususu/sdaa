"use client";

import type { KnowledgeCoverageItem, SearchEvidenceItem } from "@ask-better/domain";
import { useRef, useState, type CSSProperties } from "react";
import styles from "./coverage-stage.module.css";
import { CoverageScrollRegion } from "./coverage-scroll-region";
import { EvidenceDrawer } from "./evidence-drawer";

interface KnowledgeCoverageProps {
  items: KnowledgeCoverageItem[];
  evidence: SearchEvidenceItem[];
}

function strengthLabel(strength: KnowledgeCoverageItem["strength"]): string {
  if (strength === "high") return "较充分";
  if (strength === "medium") return "部分覆盖";
  return "较少";
}

/** Fixed preview size: the main scene stays inside one viewport. */
export const EVIDENCE_PREVIEW_LIMIT = 4;

export function KnowledgeCoverage({ items, evidence }: KnowledgeCoverageProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const previewEvidence = evidence.slice(0, EVIDENCE_PREVIEW_LIMIT);

  return (
    <section className={`knowledge-card ${styles.scrollCard}`}>
      <div className={`knowledge-heading ${styles.cardHeader}`}>
        <div>
          <h2>已有讨论</h2>
          <span>Existing Knowledge</span>
        </div>
        {evidence.length > 0 && (
          <span className="panel-badge">知乎检索 · {evidence.length} 条</span>
        )}
      </div>

      <CoverageScrollRegion ariaLabel="已有讨论与参考来源">
        <div className={styles.cardScrollContent}>
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
                {previewEvidence.map((item, index) => (
                  <article
                    className="evidence-source-item"
                    data-evidence-preview="true"
                    data-motion-item="evidence"
                    key={`${item.id}-${item.url}`}
                    style={{ "--motion-delay": `${index * 70}ms` } as CSSProperties}
                  >
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
              {evidence.length > EVIDENCE_PREVIEW_LIMIT && (
                <button
                  ref={toggleRef}
                  type="button"
                  className="evidence-toggle"
                  onClick={() => setDrawerOpen(true)}
                >
                  查看全部 {evidence.length} 条参考来源
                </button>
              )}
            </div>
          )}
        </div>
      </CoverageScrollRegion>

      <EvidenceDrawer
        open={drawerOpen}
        items={evidence}
        restoreFocusTo={toggleRef}
        onClose={() => setDrawerOpen(false)}
      />
    </section>
  );
}
