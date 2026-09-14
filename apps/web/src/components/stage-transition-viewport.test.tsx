import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { SceneCanvas } from "./scene-canvas";
import { getSceneTransitionDirection } from "./stage-transition-model";
import { SceneTransitionLayers } from "./stage-transition-viewport";

describe("scene transition system", () => {
  test("derives forward and backward direction", () => {
    expect(getSceneTransitionDirection("input", "clarify")).toBe("forward");
    expect(getSceneTransitionDirection("coverage", "diagnose")).toBe("backward");
  });

  test("scene canvas paints backdrop and content in one layer", () => {
    const html = renderToStaticMarkup(
      <SceneCanvas stage="coverage" role="incoming">
        <div>Coverage content</div>
      </SceneCanvas>
    );

    expect(html).toContain('data-scene-role="incoming"');
    expect(html).toContain('data-stage="coverage"');
    expect(html).toContain("stage-backdrop");
    expect(html).toContain("Coverage content");
  });

  test("scene canvas reset keeps light surfaces readable under dark backdrops", () => {
    const css = readFileSync("src/styles/scene-contrast.css", "utf8");

    expect(css).toContain(".scene-canvas");
    expect(css).toContain(".flow-card");
    expect(css).toContain(".workspace-panel");
    expect(css).toContain(".knowledge-card");
    expect(css).toContain(".before-card");
    expect(css).toContain(".result-status");
    expect(css).toContain("color: var(--text-primary)");
  });

  test("transition renders the outgoing and incoming scenes as two complete canvases", () => {
    const current = { id: 0, stage: "input" as const, content: <div>Old input</div> };
    const incoming = { id: 1, stage: "clarify" as const, content: <div>New clarify</div> };
    const html = renderToStaticMarkup(
      <SceneTransitionLayers
        scenes={{ current, incoming }}
        direction="forward"
        renderScene={(scene, role) => (
          <SceneCanvas key={scene.id} stage={scene.stage} role={role} hidden={role === "outgoing"}>
            {scene.content}
          </SceneCanvas>
        )}
      />
    );

    expect(html).toContain("Old input");
    expect(html).toContain("New clarify");
    expect(html).toContain('data-scene-role="outgoing"');
    expect(html).toContain('data-scene-role="incoming"');
    expect(html).toContain('data-transition-direction="forward"');
    expect(html).toContain('aria-hidden="true"');
    // Outgoing first so the incoming canvas paints above it.
    expect(html.indexOf('data-scene-role="outgoing"')).toBeLessThan(
      html.indexOf('data-scene-role="incoming"')
    );
  });

  test("a stable scene renders as a single canvas with no outgoing sibling", () => {
    const current = { id: 7, stage: "coverage" as const, content: <div>Stable coverage</div> };
    const html = renderToStaticMarkup(
      <SceneTransitionLayers
        scenes={{ current, incoming: null }}
        direction="forward"
        renderScene={(scene, role) => (
          <SceneCanvas key={scene.id} stage={scene.stage} role={role}>
            {scene.content}
          </SceneCanvas>
        )}
      />
    );

    expect(html).toContain('data-scene-role="stable"');
    expect(html).not.toContain('data-scene-role="outgoing"');
    expect(html).not.toContain('data-scene-role="incoming"');
    expect(html).toContain('data-transition-direction="idle"');
  });

  test("scene identity is keyed by a stable id, not by role", () => {
    // The same mounted scene must keep the same React key while its role changes
    // stable -> outgoing, otherwise the stage subtree remounts and loses local state.
    const source = readFileSync("src/components/stage-transition-viewport.tsx", "utf8");

    expect(source).toContain("const [scenes, setScenes] = useState");
    expect(source).toContain("id: scenes.current.id");
    expect(source).toContain("<SceneCanvas key={mounted.id}");
    // No ReactNode "snapshot" reconstruction of the outgoing scene.
    expect(source).not.toContain("stableSnapshotRef");
  });

  test("scene shell is one viewport and generic stage entrance is removed", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain("height: 100dvh");
    expect(css).toContain(".scene-transition-viewport");
    expect(css).toContain(".scene-canvas");
    expect(css).toContain("overflow: hidden");
    expect(css).not.toContain("animation: stage-enter 260ms");
  });

  test("scene system keeps reduced motion and mobile safe-area rules", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("100dvh");
  });

  test("transition canvases take no pointer events during the handoff", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain('.scene-canvas[data-scene-role="outgoing"]');
    expect(css).toContain('.scene-canvas[data-scene-role="incoming"]');
    expect(css).toContain("pointer-events: none");
  });

  test("viewport uses shorter mobile travel and keeps the full-scene crossfade for reduced motion", () => {
    const source = readFileSync("src/components/stage-transition-viewport.tsx", "utf8");

    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toMatch(/matchMedia/);
    expect(source).toContain("28");
  });

  test("scene geometry is role-independent and the frame never peep-holes the result", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    // Geometry must be identical for stable/outgoing/incoming: no role-scoped box metrics.
    expect(css).not.toMatch(/\.scene-canvas\[data-scene-role="stable"\]\s+\.scene-safe-frame\s*\{/);
    expect(css).not.toMatch(/\[data-scene-role="(stable|outgoing|incoming)"\][^{]*\{[^}]*padding/);
    expect(css).not.toMatch(/\[data-scene-role="(stable|outgoing|incoming)"\][^{]*\{[^}]*align-content/);

    // The canvas is the single scroll container; the safe frame centers via auto margins.
    const canvas = css.slice(css.indexOf(".scene-canvas{"));
    expect(canvas.slice(0, canvas.indexOf("}"))).toContain("overflow-y: auto");
    const frame = css.slice(css.indexOf(".scene-safe-frame{"));
    const frameRule = frame.slice(0, frame.indexOf("}"));
    expect(frameRule).toContain("min-height: 100%");
    expect(frameRule).toContain("margin: auto");
    // No definite height (which would break `margin: auto` centering on overflow).
    expect(frameRule).not.toMatch(/(^|[^-\w])height:\s*100%/);

    // Normal data must fit by compacting the composition, not by hiding it behind an
    // overflow box: the coverage grid sizes to content rather than scrolling internally.
    const gridRule = css.match(/\.knowledge-grid,\s*\.stage-knowledge-grid\{([^}]*)\}/);
    expect(gridRule).not.toBeNull();
    expect(gridRule![1]).toContain("overflow: visible");
    expect(gridRule![1]).not.toContain("max-height");

    // The Result comparison surface must not carry a peep-hole height budget.
    expect(css).not.toMatch(/\.scene-content > \.flow-stage-wide > \.before-after-grid\{[^}]*max-height/);
    // The compiled panel keeps its CTAs outside the scrolling body.
    expect(css).toContain(".compiled-panel-body{");
  });
});
