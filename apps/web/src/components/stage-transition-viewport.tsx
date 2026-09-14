"use client";

import { useGSAP } from "@gsap/react";
import type { QuestionCompilerStage } from "@ask-better/domain";
import { gsap } from "gsap";
import { useCallback, useRef, useState, type ReactNode } from "react";

import { SceneCanvas } from "./scene-canvas";
import {
  getSceneTransitionDirection,
  type SceneSnapshot,
  type SceneTransitionPair
} from "./stage-transition-model";

gsap.registerPlugin(useGSAP);

export const SCENE_HANDOFF_DURATION = 0.68;
export const SCENE_HEADLINE_DURATION = 0.28;
export const SCENE_HEADLINE_POSITION = 0.4;

export interface StageTransitionViewportProps {
  targetStage: QuestionCompilerStage;
  scene: ReactNode;
  resetEpoch: number;
}

export interface SceneTransitionLayersProps {
  pair: SceneTransitionPair;
}

/**
 * Renders both complete canvases of a handoff. Kept as a pure function so the
 * outgoing/incoming coexistence contract is testable without GSAP.
 */
export function SceneTransitionLayers({ pair }: SceneTransitionLayersProps) {
  return (
    <div className="scene-transition-layers" data-transition-direction={pair.direction}>
      <SceneCanvas stage={pair.outgoing.stage} role="outgoing" hidden>
        {pair.outgoing.content}
      </SceneCanvas>
      <SceneCanvas stage={pair.incoming.stage} role="incoming">
        {pair.incoming.content}
      </SceneCanvas>
    </div>
  );
}

/**
 * Owns full-scene motion only. Product state stays in `CompilerDemo`; this
 * component decides how a stage change is presented, never which stage is valid.
 */
export function StageTransitionViewport({
  targetStage,
  scene,
  resetEpoch
}: StageTransitionViewportProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [displayedStage, setDisplayedStage] = useState(targetStage);
  const [pair, setPair] = useState<SceneTransitionPair | null>(null);
  const stableSnapshotRef = useRef<SceneSnapshot>({ stage: targetStage, content: scene });

  // Keep the previous rendered ReactNode so the outgoing canvas can outlive the
  // state that produced it (needed when Result reoptimizes into Clarify).
  if (pair === null) {
    stableSnapshotRef.current =
      targetStage === displayedStage
        ? { stage: targetStage, content: scene }
        : stableSnapshotRef.current;
  }

  if (pair === null && targetStage !== displayedStage) {
    setPair({
      outgoing: stableSnapshotRef.current,
      incoming: { stage: targetStage, content: scene },
      direction: getSceneTransitionDirection(displayedStage, targetStage)
    });
  }

  const handleHandoffComplete = useCallback(() => {
    setPair((currentPair) => {
      if (currentPair === null) return null;
      stableSnapshotRef.current = {
        stage: currentPair.incoming.stage,
        content: currentPair.incoming.content
      };
      setDisplayedStage(currentPair.incoming.stage);
      return null;
    });
  }, []);

  useGSAP(
    () => {
      if (pair === null) return;

      const outgoing = rootRef.current?.querySelector<HTMLElement>(
        '[data-scene-role="outgoing"]'
      );
      const incoming = rootRef.current?.querySelector<HTMLElement>(
        '[data-scene-role="incoming"]'
      );

      if (!outgoing || !incoming) return;

      const headlines = incoming.querySelectorAll<HTMLElement>('[data-motion="headline"]');
      const sign = pair.direction === "forward" ? 1 : -1;
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        // The incoming canvas is fully painted while it enters; only the complete
        // canvas travels, so no flat-background frame can appear.
        const timeline = gsap.timeline({
          defaults: { ease: "power3.inOut" },
          onComplete: () => {
            if (headlines.length === 0) handleHandoffComplete();
          }
        });

        timeline.fromTo(
          outgoing,
          { xPercent: 0 },
          { xPercent: -100 * sign, duration: SCENE_HANDOFF_DURATION },
          0
        );

        timeline.fromTo(
          incoming,
          { xPercent: 100 * sign },
          { xPercent: 0, duration: SCENE_HANDOFF_DURATION },
          0
        );

        if (headlines.length > 0) {
          timeline.fromTo(
            headlines,
            { y: 22, opacity: 0.65 },
            {
              y: 0,
              opacity: 1,
              duration: SCENE_HEADLINE_DURATION,
              ease: "power3.out",
              onComplete: handleHandoffComplete
            },
            SCENE_HEADLINE_POSITION
          );
        }
      });

      media.add("(prefers-reduced-motion: reduce)", () => {
        // A short full-canvas crossfade, never a background-only frame.
        gsap.set(outgoing, { xPercent: 0, opacity: 1 });
        gsap.set(incoming, { xPercent: 0, opacity: 0 });

        const timeline = gsap.timeline({ onComplete: handleHandoffComplete });

        timeline.to(outgoing, { opacity: 0, duration: 0.16 }, 0);
        timeline.to(incoming, { opacity: 1, duration: 0.16 }, 0);
      });

      return () => media.revert();
    },
    { scope: rootRef, dependencies: [pair], revertOnUpdate: true }
  );

  return (
    <div className="scene-transition-viewport" ref={rootRef} data-reset-epoch={resetEpoch}>
      {pair === null ? (
        <SceneCanvas stage={stableSnapshotRef.current.stage} role="stable">
          {stableSnapshotRef.current.content}
        </SceneCanvas>
      ) : (
        <SceneTransitionLayers pair={pair} />
      )}
    </div>
  );
}
