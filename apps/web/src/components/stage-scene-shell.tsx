import type { QuestionCompilerStage } from "@ask-better/domain";
import type { CSSProperties, ReactNode } from "react";

import { stageVisuals } from "../lib/stage-visuals";
import { StageBackdrop } from "./stage-backdrop";

export interface StageSceneShellProps {
  stage: QuestionCompilerStage;
  previousStage: QuestionCompilerStage | null;
  children: ReactNode;
}

export function StageSceneShell({ stage, children }: StageSceneShellProps) {
  const visual = stageVisuals[stage];
  const sceneStyle = {
    "--scene-background": visual.background,
    "--scene-foreground": visual.foreground === "light" ? "#FFFFFF" : "#2D2114",
    "--scene-accent": visual.accent,
    "--scene-surface": visual.surface
  } as CSSProperties;

  return (
    <section className="stage-scene-shell" data-stage={stage} style={sceneStyle}>
      <StageBackdrop stage={stage} />
      <div className="stage-scene-content">{children}</div>
    </section>
  );
}
