import type { KnowledgeGapItem } from "@ask-better/domain";

export function KnowledgeGap({ items }: { items: KnowledgeGapItem[] }) {
  return (
    <section className="knowledge-card gap-card">
      <div className="knowledge-heading"><div><h2>还值得继续问什么</h2><span>Knowledge Gap</span></div></div>
      <div className="gap-list">
        {items.map((item) => (
          <article className="gap-item" key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
        {items.length === 0 && (
          <p className="knowledge-empty">当前证据不足以稳定判断新的知识缺口，可以继续整理问题，但不要据此判断平台是否存在相关讨论。</p>
        )}
      </div>
    </section>
  );
}
