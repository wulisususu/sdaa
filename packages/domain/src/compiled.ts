import type { CompiledQuestion } from "./question";

export function formatCompiledQuestion(question: CompiledQuestion): string {
  const lines = [
    question.title,
    "",
    `背景：${question.background}`,
    `目标：${question.goal}`,
    `限制：${question.constraints.join("；")}`,
    `真正困惑：${question.coreUncertainty}`,
    `希望回答重点：${question.expectedAnswer.join("；")}`
  ];

  return lines.join("\n");
}
