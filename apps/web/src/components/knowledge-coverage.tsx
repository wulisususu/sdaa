import type { KnowledgeCoverageItem } from "@ask-better/domain";

export function KnowledgeCoverage({ items }: { items: KnowledgeCoverageItem[] }) {
  return (
    <section className="knowledge-card">
      <div className="knowledge-heading"><div><h2>已有讨论</h2><span>Existing Knowledge</span></div><span className="panel-badge">知乎检索结果</span></div>
      <div className="coverage-list">{items.map((item) => <article className="coverage-item" key={item.id}><div><h3>{item.title}</h3><p>{item.detail}</p></div><span className={`coverage-strength strength-${item.strength}`}>{item.strength === "high" ? "较充分" : item.strength === "medium" ? "部分覆盖" : "较少"}</span></article>)}</div>
    </section>
  );
}
