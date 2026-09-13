import type { CompiledQuestion, PublishableQuestion } from "./question";

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

export function formatPublishableQuestion(question: PublishableQuestion): string {
  const lines = [
    question.title,
    "",
    question.context,
    ...(question.questions.length > 0
      ? ["", "想请教：", ...question.questions.map((item) => `- ${item}`)]
      : [])
  ];

  return lines.join("\n");
}
