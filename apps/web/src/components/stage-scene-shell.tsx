import { useGSAP } from "@gsap/react";
import { getStageIndex, type QuestionCompilerStage } from "@ask-better/domain";
import { gsap } from "gsap";
import type { CSSProperties, ReactNode } from "react";
import { useRef } from "react";

import { motionTokens, stageVisuals } from "../lib/stage-visuals";
import { StageBackdrop } from "./stage-backdrop";

gsap.registerPlugin(useGSAP);

export interface StageSceneShellProps {
  stage: QuestionCompilerStage;
  previousStage: QuestionCompilerStage | null;
  children: ReactNode;
}

export function StageSceneShell({ stage, previousStage, children }: StageSceneShellProps) {
  const sceneRoot = useRef<HTMLElement>(null);
  const visual = stageVisuals[stage];
  const direction =
    previousStage === null || getStageIndex(stage) >= getStageIndex(previousStage)
      ? "forward"
      : "backward";
  const directionMultiplier = direction === "forward" ? 1 : -1;
  const sceneStyle = {
    "--scene-background": visual.background,
    "--scene-foreground": visual.foreground === "light" ? "#FFFFFF" : "#2D2114",
    "--scene-accent": visual.accent,
    "--scene-surface": visual.surface
  } as CSSProperties;

  useGSAP(
    () => {
      const select = gsap.utils.selector(sceneRoot);
      const backdrop = select(".stage-backdrop");
      const stageNumber = select('[data-motion="stage-number"], .stage-index');
      const headline = select('[data-motion="headline"], .flow-stage h2');
      const mainContent = select('[data-motion="main-content"]');
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: reduce)", () => {
        gsap.fromTo(
          mainContent,
          { opacity: 0 },
          { opacity: 1, duration: motionTokens.micro, ease: "power1.out" }
        );
      });

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

        timeline.fromTo(
          backdrop,
          { xPercent: directionMultiplier * 100 },
          { xPercent: 0, duration: motionTokens.scene, ease: "power3.inOut" },
          0
        );
        if (stageNumber.length > 0) {
          timeline.fromTo(
            stageNumber,
            { yPercent: 70, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: motionTokens.standard },
            0.34
          );
        }
        if (headline.length > 0) {
          timeline.fromTo(
            headline,
            { yPercent: 45, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: motionTokens.standard },
            0.39
          );
        }
        timeline.fromTo(
          mainContent,
          { x: directionMultiplier * 30, opacity: 0 },
          { x: 0, opacity: 1, duration: motionTokens.standard },
          0.46
        );
      });

      return () => media.revert();
    },
    { scope: sceneRoot, dependencies: [stage, previousStage], revertOnUpdate: true }
  );

  return (
    <section
      ref={sceneRoot}
      className="stage-scene-shell"
      data-stage={stage}
      data-stage-direction={direction}
      style={sceneStyle}
    >
      <StageBackdrop stage={stage} />
      <div className="stage-scene-content" data-motion="main-content">{children}</div>
    </section>
  );
}
