export const questionCompilerStages = [
  "input",
  "clarify",
  "diagnose",
  "coverage",
  "result"
] as const;

export type QuestionCompilerStage = (typeof questionCompilerStages)[number];

export const stageLabels: Record<QuestionCompilerStage, string> = {
  input: "输入问题",
  clarify: "补充信息",
  diagnose: "问题体检",
  coverage: "已有讨论",
  result: "编译结果"
};

export const stageEnglishLabels: Record<QuestionCompilerStage, string> = {
  input: "Input",
  clarify: "Clarify",
  diagnose: "Diagnostics",
  coverage: "Existing Knowledge",
  result: "Compiled"
};

export type DiagnosticLevel = "info" | "warning" | "high";

export interface QuestionDiagnostic {
  code: string;
  title: string;
  summary: string;
  level: DiagnosticLevel;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  helper?: string;
  options: string[];
}

export interface KnowledgeCoverageItem {
  id: string;
  title: string;
  detail: string;
  strength: "high" | "medium" | "low";
  evidenceIds?: string[];
}

export interface KnowledgeGapItem {
  id: string;
  title: string;
  detail: string;
  evidenceIds?: string[];
}

/** Internal Question IR used for explainability and compilation. */
export interface CompiledQuestion {
  title: string;
  background: string;
  goal: string;
  constraints: string[];
  coreUncertainty: string;
  expectedAnswer: string[];
}

/** Human-facing artifact intended to be copied into Zhihu. */
export interface PublishableQuestion {
  title: string;
  context: string;
  questions: string[];
}

export interface QuestionCompilerState {
  stage: QuestionCompilerStage;
  rawQuestion: string;
  intent: string[];
  clarificationQuestions: ClarificationQuestion[];
  diagnostics: QuestionDiagnostic[];
  existingCoverage: KnowledgeCoverageItem[];
  knowledgeGaps: KnowledgeGapItem[];
  compiledQuestion: CompiledQuestion;
  publishableQuestion?: PublishableQuestion;
}

export function getNextStage(stage: QuestionCompilerStage): QuestionCompilerStage {
  const index = questionCompilerStages.indexOf(stage);
  if (index === questionCompilerStages.length - 1) {
    return stage;
  }
  return questionCompilerStages[index + 1];
}
