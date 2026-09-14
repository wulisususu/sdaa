import type { KnowledgeGapItem } from "@ask-better/domain";
import styles from "./coverage-stage.module.css";
import { CoverageScrollRegion } from "./coverage-scroll-region";

export function KnowledgeGap({ items }: { items: KnowledgeGapItem[] }) {
  return (
    <section className={`knowledge-card gap-card ${styles.scrollCard}`}>
      <div className={`knowledge-heading ${styles.cardHeader}`}>
        <div>
          <h2>还值得继续问什么</h2>
          <span>Knowledge Gap</span>
        </div>
      </div>

      <CoverageScrollRegion ariaLabel="还值得继续问什么">
        <div className={`gap-list ${styles.cardScrollContent}`}>
          {items.map((item) => (
            <article className="gap-item" key={item.id}>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
          {items.length === 0 && (
            <p className="knowledge-empty">
              当前证据不足以稳定判断新的知识缺口，可以继续整理问题，但不要据此判断平台是否存在相关讨论。
            </p>
          )}
        </div>
      </CoverageScrollRegion>
    </section>
  );
}
