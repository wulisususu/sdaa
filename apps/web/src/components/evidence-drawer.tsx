"use client";

import type { SearchEvidenceItem } from "@ask-better/domain";
import { useEffect } from "react";

interface EvidenceDrawerProps {
  open: boolean;
  items: SearchEvidenceItem[];
  onClose: () => void;
}

/**
 * Full evidence list in an internally scrolling overlay so the main scene canvas
 * can stay fixed to one viewport even when retrieval returns 20+ items.
 */
export function EvidenceDrawer({ open, items, onClose }: EvidenceDrawerProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="evidence-drawer-backdrop" onMouseDown={onClose}>
      <section
        className="evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="全部参考来源"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="evidence-drawer-header">
          <strong>全部参考来源</strong>
          <button type="button" className="ghost-button" onClick={onClose}>关闭</button>
        </header>
        <div className="evidence-drawer-scroll">
          {items.map((item) => (
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
      </section>
    </div>
  );
}
