import type { QuestionCompilerState } from "@ask-better/domain";
import { CompiledQuestionPanel } from "./compiled-question-panel";
import { KnowledgeCoverage } from "./knowledge-coverage";
import { KnowledgeGap } from "./knowledge-gap";
import { QuestionDiagnosticsPanel } from "./question-diagnostics-panel";
import { QuestionDraftPanel } from "./question-draft-panel";

interface QuestionIdeProps {
  state: QuestionCompilerState;
  rawQuestion: string;
  onRawQuestionChange: (value: string) => void;
}

export function QuestionIde({ state, rawQuestion, onRawQuestionChange }: QuestionIdeProps) {
  return <><div className="desktop-workspace"><QuestionDraftPanel value={rawQuestion} onChange={onRawQuestionChange} /><QuestionDiagnosticsPanel intent={state.intent} diagnostics={state.diagnostics} /><CompiledQuestionPanel question={state.compiledQuestion} /></div><div className="knowledge-grid"><KnowledgeCoverage items={state.existingCoverage} /><KnowledgeGap items={state.knowledgeGaps} /></div></>;
}
