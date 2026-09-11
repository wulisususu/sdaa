import type { QuestionDiagnostic } from "@ask-better/domain";

interface QuestionDiagnosticsPanelProps {
  intent: string[];
  diagnostics: QuestionDiagnostic[];
}

export function QuestionDiagnosticsPanel({ intent, diagnostics }: QuestionDiagnosticsPanelProps) {
  return (
    <section className="workspace-panel diagnostics-panel">
      <div className="panel-heading"><div><h2>问题体检</h2><span>Diagnostics</span></div><span className="panel-badge">{diagnostics.length} 项</span></div>
      <div className="panel-content panel-stack">
        <div className="intent-box"><div className="section-kicker">我理解你主要在问</div><div className="chip-row">{intent.map((item) => <span className="chip" key={item}>{item}</span>)}</div></div>
        <div className="diagnostic-list">
          {diagnostics.map((item) => (
            <article className={`diagnostic-card diagnostic-${item.level}`} key={item.code}>
              <div className="diagnostic-code">{item.code}</div><div><h3>{item.title}</h3><p>{item.summary}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
