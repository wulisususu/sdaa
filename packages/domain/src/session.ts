import type { ClarificationQuestion, QuestionCompilerStage } from "./question";
import { questionCompilerStages } from "./question";

export type ClarificationAnswers = Record<string, string>;

export function getStageIndex(stage: QuestionCompilerStage): number {
  return questionCompilerStages.indexOf(stage);
}

export function getPreviousStage(stage: QuestionCompilerStage): QuestionCompilerStage {
  const index = getStageIndex(stage);
  if (index <= 0) return "input";
  return questionCompilerStages[index - 1];
}

export function canVisitStage(
  target: QuestionCompilerStage,
  maxVisited: QuestionCompilerStage
): boolean {
  return getStageIndex(target) <= getStageIndex(maxVisited);
}

export function isRawQuestionReady(rawQuestion: string): boolean {
  return rawQuestion.trim().length >= 5;
}

export function setClarificationAnswer(
  answers: ClarificationAnswers,
  questionId: string,
  option: string
): ClarificationAnswers {
  return { ...answers, [questionId]: option };
}

export function countAnsweredClarifications(
  questions: ClarificationQuestion[],
  answers: ClarificationAnswers
): number {
  const knownIds = new Set(questions.map((question) => question.id));
  return Object.entries(answers).filter(
    ([questionId, answer]) => knownIds.has(questionId) && answer.trim().length > 0
  ).length;
}
