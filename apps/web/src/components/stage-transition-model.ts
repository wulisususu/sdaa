import { getStageIndex, type QuestionCompilerStage } from "@ask-better/domain";
import type { ReactNode } from "react";

export type SceneTransitionDirection = "forward" | "backward";

export interface SceneSnapshot {
  stage: QuestionCompilerStage;
  content: ReactNode;
}

export interface SceneTransitionPair {
  outgoing: SceneSnapshot;
  incoming: SceneSnapshot;
  direction: SceneTransitionDirection;
}

export function getSceneTransitionDirection(
  from: QuestionCompilerStage,
  to: QuestionCompilerStage
): SceneTransitionDirection {
  return getStageIndex(to) >= getStageIndex(from) ? "forward" : "backward";
}
