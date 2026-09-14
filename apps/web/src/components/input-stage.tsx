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
        <div className="flow-heading input-hero-heading">
          <div>
            <span className="section-kicker">01 / 05 · INPUT</span>
            <h2 data-motion="headline">你真正想问什么？</h2>
          </div>
        </div>
        <label className="sr-only" htmlFor="flow-question">你想整理的问题</label>
        <textarea
          id="flow-question"
          data-motion="input"
          value={rawQuestion}
          onChange={(event) => onChange(event.target.value)}
          placeholder="例如：现在转码还有前途吗？"
          rows={7}
          maxLength={1000}
          autoFocus
        />
        <div className="input-meta">
          <span>{rawQuestion.trim().length} / 1000</span>
          {!ready && rawQuestion.length > 0 && <span className="input-warning">至少输入 5 个字</span>}
        </div>
        {error && <p className="pipeline-error" role="alert">{error}</p>}
        <div className="example-block">
          <span className="example-label">不知道怎么开始？试试这些问题</span>
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
          data-motion="primary-action"
          type="button"
          onClick={onContinue}
          disabled={!ready || loading}
          aria-busy={loading}
        >
          {loading ? <><span className="button-spinner" aria-hidden="true" />正在理解你的问题…</> : <>开始编译问题 <span aria-hidden="true">→</span></>}
        </button>
      </div>
    </section>
  );
}
