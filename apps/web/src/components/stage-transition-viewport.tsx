"use client";

import { useGSAP } from "@gsap/react";
import type { QuestionCompilerStage } from "@ask-better/domain";
import { gsap } from "gsap";
import { useCallback, useRef, useState, type ReactNode } from "react";

import { SceneCanvas } from "./scene-canvas";
import { getSceneTransitionDirection, type SceneTransitionDirection } from "./stage-transition-model";

gsap.registerPlugin(useGSAP);

export const SCENE_HANDOFF_DURATION = 0.68;
export const SCENE_HEADLINE_DURATION = 0.28;
export const SCENE_HEADLINE_POSITION = 0.4;
/** Full-canvas travel on desktop; mobile uses a shorter distance that still reads as a handoff. */
export const SCENE_TRAVEL_DESKTOP_PERCENT = 100;
export const SCENE_TRAVEL_MOBILE_PERCENT = 28;

export interface StageTransitionViewportProps {
  targetStage: QuestionCompilerStage;
  scene: ReactNode;
  resetEpoch: number;
}

/**
 * A mounted scene. `id` is the React key AND the reconciliation identity: the same scene
 * keeps the same id while its role changes, so React updates the existing
 * `SceneCanvas` element instead of remounting the stage subtree.
 *
 * This matters because the outgoing scene must preserve real component/DOM state (e.g. a
 * Clarify question index, an open `<details>`) for the whole exit animation. Rebuilding the
 * outgoing canvas from a re-rendered ReactNode would lose that state.
 */
export interface MountedScene {
  id: number;
  stage: QuestionCompilerStage;
  content: ReactNode;
}

export interface SceneTransitionLayersProps {
  scenes: { current: MountedScene; incoming: MountedScene | null };
  direction: SceneTransitionDirection;
  renderScene: (scene: MountedScene, role: "stable" | "outgoing" | "incoming") => ReactNode;
}

/**
 * Renders the mounted scene (plus the incoming sibling during a handoff). Kept as a pure
 * function so the coexistence contract and scene identity are testable without GSAP.
 */
export function SceneTransitionLayers({
  scenes,
  direction,
  renderScene
}: SceneTransitionLayersProps) {
  if (scenes.incoming === null) {
    return (
      <div className="scene-transition-layers" data-transition-direction="idle">
        {renderScene(scenes.current, "stable")}
      </div>
    );
  }

  return (
    <div className="scene-transition-layers" data-transition-direction={direction}>
      {renderScene(scenes.current, "outgoing")}
      {renderScene(scenes.incoming, "incoming")}
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
  // Monotonic id source; each mounted scene keeps its id for as long as it is mounted.
  const nextSceneId = useRef(1);
  const [scenes, setScenes] = useState<{ current: MountedScene; incoming: MountedScene | null }>(
    () => ({
      current: { id: 0, stage: targetStage, content: scene },
      incoming: null
    })
  );

  const isTransitioning = scenes.incoming !== null;

  if (!isTransitioning && targetStage !== scenes.current.stage) {
    // Entering a handoff: the currently mounted scene becomes the outgoing scene by keeping
    // its id and therefore its identity; the incoming scene is added as a sibling.
    setScenes({
      current: {
        id: scenes.current.id,
        stage: scenes.current.stage,
        // Freeze the exact element React already reconciled for this scene.
        content: scenes.current.content
      },
      incoming: {
        id: nextSceneId.current++,
        stage: targetStage,
        content: scene
      }
    });
  } else if (!isTransitioning && targetStage === scenes.current.stage) {
    // Stable: keep rendering live content so typing, selection and copy status stay current.
    const nextContent = scene;
    if (scenes.current.content !== nextContent || scenes.current.stage !== targetStage) {
      setScenes({
        current: { id: scenes.current.id, stage: targetStage, content: nextContent },
        incoming: null
      });
    }
  }

  const handleHandoffComplete = useCallback(() => {
    setScenes((previous) => {
      if (previous.incoming === null) return previous;
      // The incoming scene becomes the new stable scene with the SAME id, so React keeps its
      // DOM node and local state instead of remounting it.
      return { current: previous.incoming, incoming: null };
    });
  }, []);

  const direction = scenes.incoming
    ? getSceneTransitionDirection(scenes.current.stage, scenes.incoming.stage)
    : "forward";

  useGSAP(
    () => {
      if (scenes.incoming === null) return;

      const outgoing = rootRef.current?.querySelector<HTMLElement>(
        '[data-scene-role="outgoing"]'
      );
      const incoming = rootRef.current?.querySelector<HTMLElement>(
        '[data-scene-role="incoming"]'
      );

      if (!outgoing || !incoming) return;

      const headlines = incoming.querySelectorAll<HTMLElement>('[data-motion="headline"]');
      const sign = direction === "forward" ? 1 : -1;
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        // Mobile keeps a shorter travel so the handoff reads as a scene change without
        // a full-width sweep on a narrow viewport.
        const travelPercent = window.matchMedia("(max-width: 767px)").matches
          ? SCENE_TRAVEL_MOBILE_PERCENT
          : SCENE_TRAVEL_DESKTOP_PERCENT;

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
          { xPercent: -travelPercent * sign, duration: SCENE_HANDOFF_DURATION },
          0
        );

        timeline.fromTo(
          incoming,
          { xPercent: travelPercent * sign },
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
    { scope: rootRef, dependencies: [scenes], revertOnUpdate: true }
  );

  return (
    <div className="scene-transition-viewport" ref={rootRef} data-reset-epoch={resetEpoch}>
      <SceneTransitionLayers
        scenes={scenes}
        direction={direction}
        renderScene={(mounted, role) => (
          <SceneCanvas key={mounted.id} stage={mounted.stage} role={role} hidden={role === "outgoing"}>
            {mounted.content}
          </SceneCanvas>
        )}
      />
    </div>
  );
}
