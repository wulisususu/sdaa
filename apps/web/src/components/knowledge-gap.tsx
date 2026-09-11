import type { KnowledgeGapItem } from "@ask-better/domain";

export function KnowledgeGap({ items }: { items: KnowledgeGapItem[] }) {
  return (
    <section className="knowledge-card gap-card">
      <div className="knowledge-heading"><div><h2>还值得继续问什么</h2><span>Knowledge Gap</span></div></div>
      <div className="gap-list">{items.map((item) => <article className="gap-item" key={item.id}><h3>{item.title}</h3><p>{item.detail}</p></article>)}</div>
    </section>
  );
}
