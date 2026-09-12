interface InputStageProps {
  rawQuestion: string;
  ready: boolean;
  loading?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
  onContinue: () => void;
}

const examples = [
  "现在转码还有前途吗？",
  "考研还是直接就业更适合我？",
  "AI 应用开发应该怎么学？"
];

export function InputStage({
  rawQuestion,
  ready,
  loading = false,
  error = null,
  onChange,
  onContinue
}: InputStageProps) {
  return (
    <section className="flow-stage flow-stage-narrow">
      <div className="flow-card input-stage-card">
        <div className="flow-heading">
          <div>
            <span className="section-kicker">原始问题</span>
            <h2>你真正想问什么？</h2>
            <small>Raw Question</small>
          </div>
        </div>
        <textarea
          id="flow-question"
          value={rawQuestion}
          onChange={(event) => onChange(event.target.value)}
          placeholder="随便说，我们帮你理清。"
          rows={7}
          autoFocus
        />
        <div className="input-meta">
          <span>{rawQuestion.trim().length} / 1000</span>
          {!ready && rawQuestion.length > 0 && <span className="input-warning">至少输入 5 个字</span>}
        </div>
        {error && <p className="pipeline-error" role="alert">{error}</p>}
        <div className="example-block">
          <span className="example-label">试试这些问题</span>
          <div className="example-list">
            {examples.map((example) => (
              <button key={example} type="button" className="example-chip" onClick={() => onChange(example)}>
                {example}
              </button>
            ))}
          </div>
        </div>
        <button
          className="primary-button stage-primary-action"
          type="button"
          onClick={onContinue}
          disabled={!ready || loading}
        >
          {loading ? "正在理解你的问题…" : "开始整理问题"}
        </button>
      </div>
    </section>
  );
}
