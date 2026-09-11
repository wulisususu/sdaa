interface QuestionDraftPanelProps {
  value: string;
  onChange: (value: string) => void;
}

export function QuestionDraftPanel({ value, onChange }: QuestionDraftPanelProps) {
  return (
    <section className="workspace-panel draft-panel">
      <div className="panel-heading"><div><h2>问题草稿</h2><span>Draft</span></div><span className="panel-badge">原始问题</span></div>
      <div className="panel-content">
        <label className="field-label" htmlFor="raw-question">你想问什么？</label>
        <textarea id="raw-question" value={value} onChange={(event) => onChange(event.target.value)} placeholder="随便说，我们帮你理清。" rows={8} />
        <p className="micro-copy">不用先想好怎么表达，先把真实困惑写下来。</p>
      </div>
    </section>
  );
}
