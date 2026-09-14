import type { QuestionCompilerStage } from "@ask-better/domain";
import type { CSSProperties, ReactNode } from "react";
import { stageVisuals } from "../lib/stage-visuals";
import { StageBackdrop } from "./stage-backdrop";

export interface SceneCanvasProps {
  stage: QuestionCompilerStage;
  role: "stable" | "outgoing" | "incoming";
  hidden?: boolean;
  children: ReactNode;
}

export function SceneCanvas({ stage, role, hidden = false, children }: SceneCanvasProps) {
  const visual = stageVisuals[stage];
  const style = {
    "--scene-background": visual.background,
    "--scene-foreground": visual.foreground === "light" ? "#FFFFFF" : "#2D2114",
    "--scene-accent": visual.accent,
    "--scene-surface": visual.surface
  } as CSSProperties;

  return (
    <section
      className="scene-canvas"
      data-stage={stage}
      data-scene-role={role}
      aria-hidden={hidden || undefined}
      style={style}
    >
      <StageBackdrop stage={stage} />
      <div className="scene-safe-frame">
        <div className="scene-content">{children}</div>
      </div>
    </section>
  );
}
