# P1.3 Five-Scene Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有五阶段问题编译流程升级为五个独立色彩场景，背景与内容整体切换，并完成按钮、文字、交互和 Mobile Web 的统一动效与响应式优化。

**Architecture:** 保留 `CompilerDemo` 的业务状态/API 调用和五个现有 Stage 组件，在外层新增 `StageSceneShell`/theme/motion 层。React 继续唯一控制 stage 和业务数据；GSAP 只读取 stage 变化执行 transition，不得反向驱动业务状态。

**Tech Stack:** Next.js 16.3.4, React 19.2, TypeScript 5.9, Tailwind 4, GSAP, `@gsap/react`, Vitest

**Spec:** `docs/superpowers/specs/2026-09-13-five-scene-experience-design.md`

## Global Constraints

- 第一项改动必须删除首屏长文案「不需要先组织好语言。把困惑原样写下来，我们会先识别意图、补齐关键条件，再判断知乎已有讨论覆盖了什么。」
- 第一项改动必须删除首屏 `Question Input` 标签，且不得在其他位置恢复。
- 不修改 AI 主链路、API 契约、Domain Schema、检索逻辑或编译逻辑。
- 五阶段仍是 `Input → Clarify → Diagnose → Coverage → Result`。
- 主业务阶段切换不得由 ScrollTrigger 驱动。
- React 管状态，GSAP 管表现。
- 优先 transform/opacity；不得用高频 width/height/top/left 动画。
- 必须支持 `prefers-reduced-motion: reduce`。
- 主 Mobile 验收宽度 390px；辅助 360px、430px。
- iPhone Safari / Android Chrome / Desktop Chrome-Edge 都必须通过。
- 不做 Companion Extension，不做 Expo Android 客户端。

---

## File Structure

### Create

- `apps/web/src/components/stage-scene-shell.tsx` — 五幕场景外壳、方向判断、GSAP timeline、reduced-motion fallback。
- `apps/web/src/components/stage-backdrop.tsx` — 每阶段纯视觉背景几何，不持有业务状态。
- `apps/web/src/lib/stage-visuals.ts` — Stage theme、色彩、文字明暗、motion tokens 的静态配置。
- `apps/web/src/components/stage-scene-shell.test.tsx` — 场景主题、ARIA、stage key、reduced-motion 可回退结构测试。
- `docs/design/p1.3-reference-board.md` — 20–30 个参考的采集板。

### Modify

- `apps/web/package.json` — 加入 `gsap`、`@gsap/react`。
- `pnpm-lock.yaml` — 锁定依赖。
- `apps/web/src/components/compiler-demo.tsx` — 用 StageSceneShell 包裹当前 Stage；不改 API/business state。
- `apps/web/src/components/input-stage.tsx` — 删除指定旧文案与 `Question Input`。
- `apps/web/src/components/stage-stepper.tsx` — 支持 scene theme 和简洁 progress 视觉。
- `apps/web/src/components/clarification-stage.tsx` — 增加稳定 motion hooks/data attributes；保持业务行为。
- `apps/web/src/components/diagnosis-stage.tsx` — 增加 stagger hooks；保持 severity text。
- `apps/web/src/components/coverage-stage.tsx` — 首批 evidence stagger hooks；展开区不做长串动画。
- `apps/web/src/components/result-stage.tsx` / `compiled-question-panel.tsx` — Before → After motion hooks、sticky mobile CTA 结构。
- `apps/web/src/app/globals.css` — 五幕色板、surface token、scene layout、button/input/typography/mobile/reduced-motion。
- `apps/web/src/components/pipeline-ui.test.tsx` — 前置删除和视觉结构回归。

---

### Task 1: 前置清理 + Reference Board

**Files:**
- Modify: `apps/web/src/components/input-stage.tsx`
- Modify: `apps/web/src/components/pipeline-ui.test.tsx`
- Create: `docs/design/p1.3-reference-board.md`

**Interfaces:**
- Consumes: 当前 `InputStage` props，不改签名。
- Produces: 干净的首屏文本基础；后续任务使用 reference board 的视觉决策。

- [ ] **Step 1: 先写失败测试，锁死两项删除要求**

在 `pipeline-ui.test.tsx` 增加：

```tsx
test("input stage removes the retired explanatory copy and Question Input pill", () => {
  const html = renderToStaticMarkup(
    <InputStage
      rawQuestion="AI 应用开发应该怎么学？"
      ready
      onChange={() => undefined}
      onContinue={() => undefined}
    />
  );

  expect(html).not.toContain("不需要先组织好语言");
  expect(html).not.toContain("Question Input");
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
pnpm --filter web test -- pipeline-ui.test.tsx
```

Expected: 新测试失败，因为两个旧元素仍存在。

- [ ] **Step 3: 只删除指定两项，不写替代文案**

在 `input-stage.tsx` 删除整个旧 `stage-lead` 段落和 `compiler-state-pill`，保留 `知乎 AI 提问编译器`、`你真正想问什么？`、textarea、examples、CTA、trust line。

- [ ] **Step 4: 完成 Reference Board**

`docs/design/p1.3-reference-board.md` 必须有四组，每组至少 5 个参考：Scene Transition、Typography、Product Interaction、Editorial。每项固定格式：

```md
### [参考名称]
- 来源：<URL>
- 采：Push transition / mask reveal / button feedback 等
- 不采：scroll hijacking / 3D / WebGL 等
- 对应：Input / Clarify / Diagnose / Coverage / Result / Shared
```

至少包含用户指定的 GSAP ScrollTrigger horizontal panels 风格作为 Scene Transition 参考，但明确写“只采视觉语言，不用 ScrollTrigger 驱动主流程”。

- [ ] **Step 5: 跑测试并提交**

```bash
pnpm --filter web test -- pipeline-ui.test.tsx
git add apps/web/src/components/input-stage.tsx apps/web/src/components/pipeline-ui.test.tsx docs/design/p1.3-reference-board.md
git commit -m "docs: prepare P1.3 visual direction"
```

---

### Task 2: 安装 GSAP 并建立 Stage Visual Tokens

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/src/lib/stage-visuals.ts`
- Test: `apps/web/src/components/stage-scene-shell.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface StageVisual {
  background: string;
  foreground: "light" | "dark";
  accent: string;
  surface: string;
}

export const stageVisuals: Record<QuestionCompilerStage, StageVisual>;
export const motionTokens: {
  micro: number;
  fast: number;
  standard: number;
  scene: number;
  staggerXs: number;
  staggerSm: number;
};
```

- [ ] **Step 1: 安装依赖**

```bash
pnpm --filter web add gsap @gsap/react
```

- [ ] **Step 2: 新建 token 测试**

```tsx
import { describe, expect, test } from "vitest";
import { motionTokens, stageVisuals } from "../lib/stage-visuals";

describe("stage visuals", () => {
  test("defines a visual theme for all five stages", () => {
    expect(Object.keys(stageVisuals)).toEqual([
      "input", "clarify", "diagnose", "coverage", "result"
    ]);
  });

  test("keeps the scene motion budget below one second", () => {
    expect(motionTokens.scene).toBe(0.76);
  });
});
```

- [ ] **Step 3: 实现 `stage-visuals.ts`**

使用设计 spec 的五个主色方向；`scene` 单位使用 GSAP 秒：`0.76`，stagger `0.04` / `0.07`。

- [ ] **Step 4: 测试 + typecheck + commit**

```bash
pnpm --filter web test -- stage-scene-shell.test.tsx
pnpm --filter web typecheck
git add apps/web/package.json pnpm-lock.yaml apps/web/src/lib/stage-visuals.ts apps/web/src/components/stage-scene-shell.test.tsx
git commit -m "feat: add P1.3 stage visual tokens"
```

---

### Task 3: 建立 StageBackdrop 与 Scene Shell

**Files:**
- Create: `apps/web/src/components/stage-backdrop.tsx`
- Create: `apps/web/src/components/stage-scene-shell.tsx`
- Modify: `apps/web/src/components/stage-scene-shell.test.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**

```ts
interface StageSceneShellProps {
  stage: QuestionCompilerStage;
  previousStage: QuestionCompilerStage | null;
  children: React.ReactNode;
}
```

`StageBackdrop` 只接收 `stage`。

- [ ] **Step 1: 写静态结构失败测试**

```tsx
test("scene shell exposes stage identity without changing content semantics", () => {
  const html = renderToStaticMarkup(
    <StageSceneShell stage="coverage" previousStage="diagnose">
      <div>Evidence content</div>
    </StageSceneShell>
  );
  expect(html).toContain('data-stage="coverage"');
  expect(html).toContain("stage-backdrop");
  expect(html).toContain("Evidence content");
});
```

- [ ] **Step 2: RED**

```bash
pnpm --filter web test -- stage-scene-shell.test.tsx
```

- [ ] **Step 3: 实现静态 Scene Shell**

第一步只做 DOM/Theme，不写 timeline：`section.stage-scene-shell` → backdrop → content。利用 CSS custom properties 把 `background/accent/surface/text` 注入根节点。

- [ ] **Step 4: 在 CSS 中完成 scene layout**

要求：

```css
.stage-scene-shell { min-height: calc(100dvh - var(--app-header-height)); overflow: clip; }
.stage-scene-content { position: relative; z-index: 2; }
.stage-backdrop { position: absolute; inset: 0; pointer-events: none; }
```

背景几何只用伪元素/CSS gradients/SVG-like CSS shapes；不得引入大图片。

- [ ] **Step 5: GREEN + commit**

```bash
pnpm --filter web test -- stage-scene-shell.test.tsx
pnpm --filter web typecheck
git add apps/web/src/components/stage-backdrop.tsx apps/web/src/components/stage-scene-shell.tsx apps/web/src/components/stage-scene-shell.test.tsx apps/web/src/app/globals.css
git commit -m "feat: add five-stage scene shell"
```

---

### Task 4: 把现有业务 Stage 接入 Scene Shell，业务逻辑零改动

**Files:**
- Modify: `apps/web/src/components/compiler-demo.tsx`
- Modify: `apps/web/src/components/pipeline-ui.test.tsx`

**Interfaces:**
- Consumes: 现有 `stage`, `markVisited`, `visit`, `back`。
- Produces: `previousStage` 仅用于动画方向，不用于业务判断。

- [ ] **Step 1: 写回归测试**

新增断言初始 SSR 同时包含：

```tsx
expect(html).toContain('data-stage="input"');
expect(html).toContain("知乎 AI 提问编译器");
expect(html).not.toContain("Mock Data");
```

- [ ] **Step 2: 增加 previous stage ref/state**

只在真正 stage change 前记录旧 stage，不能改变 `maxVisited`、requestVersion、cancelPending 行为。

- [ ] **Step 3: 用 Scene Shell 包裹现有条件渲染**

AppHeader 可以持久化；StageStepper 与 Stage 内容进入场景区域。不得移动 API handler 的执行顺序。

- [ ] **Step 4: 回归测试**

```bash
pnpm --filter web test -- pipeline-ui.test.tsx compiler-flow-state.test.ts
pnpm --filter web typecheck
```

- [ ] **Step 5: commit**

```bash
git add apps/web/src/components/compiler-demo.tsx apps/web/src/components/pipeline-ui.test.tsx
git commit -m "refactor: mount pipeline inside scene shell"
```

---

### Task 5: GSAP Push + Reveal Timeline

**Files:**
- Modify: `apps/web/src/components/stage-scene-shell.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Scene direction = compare `getStageIndex(stage)` with `getStageIndex(previousStage)`。
- Forward: incoming from right; backward: incoming from left。

- [ ] **Step 1: 注册 `useGSAP` 并 scope 到 scene root**

只允许使用组件内 refs / `scope`，禁止对 document 做全局 selector。

- [ ] **Step 2: 实现 timeline**

时间预算：

```ts
const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
tl.fromTo(backdrop, { xPercent: direction * 100 }, { xPercent: 0, duration: 0.76, ease: "power3.inOut" }, 0);
tl.fromTo(stageNumber, { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.42 }, 0.34);
tl.fromTo(headline, { yPercent: 45, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.42 }, 0.39);
tl.fromTo(mainContent, { x: direction * 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.42 }, 0.46);
```

退出场景如果 DOM 模型不保留上一屏副本，则不要伪造双 DOM；用 root/backdrop 的 wipe/push 视觉模拟。避免为了“真双屏”复制业务组件导致表单/ARIA 重复。

- [ ] **Step 3: reduced motion**

通过 `gsap.matchMedia()` 或 `window.matchMedia`：reduce 时仅 `opacity: 0 → 1, duration <= 0.16`，不横移、不 stagger。

- [ ] **Step 4: cleanup**

确保 timeline 在 stage change/unmount 自动 revert/kill，React Strict Mode 不重复遗留。

- [ ] **Step 5: typecheck/build**

```bash
pnpm --filter web typecheck
NODE_OPTIONS=--max-old-space-size=1024 pnpm --filter web build
```

- [ ] **Step 6: commit**

```bash
git add apps/web/src/components/stage-scene-shell.tsx apps/web/src/app/globals.css
git commit -m "feat: animate five-stage scene transitions"
```

---

### Task 6: Stage Typography + Stepper Theme

**Files:**
- Modify: `apps/web/src/components/stage-stepper.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/pipeline-ui.test.tsx`

**Interfaces:**
- `StageStepper` 继续接收 `stage/maxVisited/onChange`；可新增 `tone?: "light" | "dark"`，默认根据 stage visual 推导。

- [ ] **Step 1: 保留 a11y 测试**

现有 `aria-current="step"`, `3 / 5`, 中文阶段名测试必须继续通过。

- [ ] **Step 2: 将桌面 Stepper 从独立白色卡片改成场景内导航**

保留五阶段可访问按钮，不删除 visited navigation。

- [ ] **Step 3: 标题使用 mask hook**

统一给 stage number / headline 增加 `data-motion="stage-number|headline"`，由 Scene Shell scope 动画；不要在每个子组件各建 timeline。

- [ ] **Step 4: Mobile progress**

移动端显示 `N / 5 · 中文阶段名` + 细进度线，不显示压缩的五列按钮。

- [ ] **Step 5: test + commit**

```bash
pnpm --filter web test -- pipeline-ui.test.tsx
pnpm --filter web typecheck
git add apps/web/src/components/stage-stepper.tsx apps/web/src/app/globals.css apps/web/src/components/pipeline-ui.test.tsx
git commit -m "feat: theme progress navigation for five scenes"
```

---

### Task 7: Button / Input / Clarification Micro-interactions

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/input-stage.tsx`
- Modify: `apps/web/src/components/clarification-stage.tsx`
- Modify: `apps/web/src/components/pipeline-ui.test.tsx`

**Interfaces:**
- 不改变现有 props。
- selected option 继续保留 `option-check` 和非颜色 ✓。

- [ ] **Step 1: Button tokens**

统一 Primary / Secondary / Ghost：hover `translateY(-2px)`，press `scale(.975)`；loading 时按钮尺寸不跳。

- [ ] **Step 2: Input focus**

textarea focus 只做 border/surface/shadow + 极轻 transform；不得在移动端 focus 时 scale 导致 Safari viewport 抖动，mobile 下禁用 scale。

- [ ] **Step 3: Clarification option feedback**

selected 状态允许 `scale(.985) → 1`/check reveal，但 React answer 写入必须先发生；动画不能阻止 change。

- [ ] **Step 4: 测试现有非颜色状态和 loading 文案**

```bash
pnpm --filter web test -- pipeline-ui.test.tsx
```

Expected: `option-check`, `✓`, `正在理解你的问题…`, trust line 全部仍通过。

- [ ] **Step 5: commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/input-stage.tsx apps/web/src/components/clarification-stage.tsx apps/web/src/components/pipeline-ui.test.tsx
git commit -m "feat: refine input and clarification interactions"
```

---

### Task 8: Diagnose + Coverage Information Motion

**Files:**
- Modify: `apps/web/src/components/diagnosis-stage.tsx`
- Modify: `apps/web/src/components/coverage-stage.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/pipeline-ui.test.tsx`

**Interfaces:**
- diagnostics 保留 severity text。
- evidence links 保留 `target="_blank"` 及现有 URL。

- [ ] **Step 1: 增加稳定 motion hooks**

diagnostics item：`data-motion-item="diagnostic"`；首批 evidence：`data-motion-item="evidence"`。不要依赖 nth-child selector。

- [ ] **Step 2: stagger 控制**

只对初始可见项执行 `0.07s` stagger；Evidence 展开全部时禁止 24 张逐个长动画，后续项最多使用短 fade。

- [ ] **Step 3: 保留 evidence/status/error 语义**

现有以下测试必须继续通过：真实知乎链接、空 evidence 不声称已有知乎结果、compile loading。

- [ ] **Step 4: regression + commit**

```bash
pnpm --filter web test -- pipeline-ui.test.tsx knowledge-coverage.test.ts
pnpm --filter web typecheck
git add apps/web/src/components/diagnosis-stage.tsx apps/web/src/components/coverage-stage.tsx apps/web/src/app/globals.css apps/web/src/components/pipeline-ui.test.tsx
git commit -m "feat: animate diagnostics and evidence hierarchy"
```

---

### Task 9: Result Before → After Visual Climax

**Files:**
- Modify: `apps/web/src/components/result-stage.tsx`
- Modify: `apps/web/src/components/compiled-question-panel.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/publishable-cta.test.tsx`
- Modify: `apps/web/src/components/pipeline-ui.test.tsx`

**Interfaces:**
- Copy 仍只复制 `publishableQuestion`。
- `前往知乎` 仍只能打开 `https://www.zhihu.com/`。
- 绝不恢复 `/question/ask`。

- [ ] **Step 1: 锁死 CTA 回归**

确保测试继续断言：

```tsx
expect(html).toContain("复制知乎版问题");
expect(html).toContain("前往知乎");
expect(html).not.toContain("/question/ask");
```

- [ ] **Step 2: 增加 Before/After motion hooks**

Before card `data-motion="before"`；publishable result `data-motion="after"`；CTA `data-motion="result-actions"`。

- [ ] **Step 3: Timeline**

进入 Result 时：Before `scale 1 → .94`, `opacity 1 → .38`，随后 After `y 24 → 0`, `opacity 0 → 1`。整个结果入场不得超过 950ms。

- [ ] **Step 4: copy feedback**

继续使用 `✓ 已复制`，不要额外引入大型 toast。

- [ ] **Step 5: tests + commit**

```bash
pnpm --filter web test -- publishable-cta.test.tsx pipeline-ui.test.tsx
pnpm --filter web typecheck
git add apps/web/src/components/result-stage.tsx apps/web/src/components/compiled-question-panel.tsx apps/web/src/app/globals.css apps/web/src/components/publishable-cta.test.tsx apps/web/src/components/pipeline-ui.test.tsx
git commit -m "feat: stage the before-after result reveal"
```

---

### Task 10: Mobile Web / iPhone Safari / Android Chrome

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/stage-scene-shell.tsx`
- Modify: `apps/web/src/components/result-stage.tsx`

**Interfaces:**
- Mobile 不改变业务 flow，只改变 layout/motion parameters。

- [ ] **Step 1: 视口与 safe area**

使用：

```css
.stage-scene-shell { min-height: calc(100dvh - var(--app-header-height)); }
.mobile-sticky-actions { padding-bottom: max(12px, env(safe-area-inset-bottom)); }
```

- [ ] **Step 2: Mobile scene motion**

`max-width: 767px` 时横移缩短到 12–20vw，scene duration 约 0.56s；重 blur/backdrop 动画关闭。

- [ ] **Step 3: 键盘场景**

Input stage 不使用固定 `height: 100dvh` 锁死；textarea focus 后 CTA 允许自然下推/滚动，不被 absolute bottom 遮挡。

- [ ] **Step 4: Result sticky action**

长结果页在手机上让主要 Copy CTA 可 sticky，但不得遮住正文最后一段；底部留足 safe-area spacer。

- [ ] **Step 5: 手动 viewport 验收**

依次检查：360×800、390×844、430×932、768、1024、1440。每个尺寸确认：无 horizontal scroll、header/stepper 不截断、textarea 可输入、coverage 可展开、result 可完整复制。

- [ ] **Step 6: commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/stage-scene-shell.tsx apps/web/src/components/result-stage.tsx
git commit -m "feat: optimize five-scene flow for mobile web"
```

---

### Task 11: Reduced Motion + Accessibility + Performance Guard

**Files:**
- Modify: `apps/web/src/components/stage-scene-shell.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/pipeline-ui.test.tsx`

**Interfaces:**
- reduced motion 只能改变表现，不能改变 DOM 功能和 stage 行为。

- [ ] **Step 1: reduced-motion CSS**

所有 CSS transition/animation 在 reduce 下缩短或关闭；spinner 可保留必要 loading 表意，但避免复杂 scene motion。

- [ ] **Step 2: GSAP matchMedia fallback**

reduce 时不做 xPercent/yPercent 大位移，仅快速 opacity reveal。

- [ ] **Step 3: Contrast/focus 检查**

五个 Stage foreground/surface/border 对比度人工核验；focus-visible 不得因为深色背景消失。

- [ ] **Step 4: Performance review**

检查 GSAP 目标属性只以 transform/opacity 为主；禁止每帧 animate box-shadow/filter/height。确认每个 `useGSAP` 都有 scope/cleanup。

- [ ] **Step 5: tests + commit**

```bash
pnpm --filter web test
pnpm --filter web typecheck
git add apps/web/src/components/stage-scene-shell.tsx apps/web/src/app/globals.css apps/web/src/components/pipeline-ui.test.tsx
git commit -m "fix: harden motion accessibility and performance"
```

---

### Task 12: Full Regression / Build / Production Readiness

**Files:**
- No new functional files unless a verified regression requires a focused fix.

- [ ] **Step 1: Full web tests**

```bash
pnpm --filter web test
```

Expected: 全绿，不接受 snapshot/断言删除来“修”测试。

- [ ] **Step 2: Domain regression**

```bash
pnpm --filter @ask-better/domain test
```

Expected: P1.2 Domain 行为无改动。

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @ask-better/domain typecheck
pnpm --filter web typecheck
```

- [ ] **Step 4: Production build**

```bash
NODE_OPTIONS=--max-old-space-size=1024 pnpm --filter web build
```

- [ ] **Step 5: Golden Flow 浏览器验收**

至少跑：

1. `现在转码还有前途吗？`
2. `考研还是直接就业？`
3. `AI 应用开发应该怎么学？`

检查：五幕都正确切换、API loading 正常、返回/重访正常、Evidence 真链接正常、Result publishable 优先、copy 正常、前往知乎仍为根 URL。

- [ ] **Step 6: Mobile 真机/设备模拟验收**

至少：iPhone Safari 390 宽、Android Chrome 412/430 宽。重点：地址栏变化、键盘、safe area、sticky CTA、无横向 overflow。

- [ ] **Step 7: 最终代码审计**

确认：

```text
/question/ask            0
ScrollTrigger 主流程      0
AI/API/Domain 修改         0（除非仅类型导入无语义变化）
旧长说明文案              0
Question Input            0
```

- [ ] **Step 8: 最终提交**

```bash
git status
git log --oneline -12
```

工作区 clean 后进入 review / PR / deploy 流程。

---

## Recommended Execution Order

严格按以下顺序，不允许一上来先写大量动画：

`前置清理 → Reference Board → Stage tokens → 静态 Scene Shell → 接业务 Stage → Scene timeline → Stepper/Typography → Buttons/Input → Diagnose/Coverage → Result → Mobile → A11y/Performance → Full Regression`

## Acceptance Summary

最终用户应感受到五个连续的“编译场景”，而不是五张换颜色的卡片：

- 背景与内容一起切换；
- 文字采用 mask/line reveal 的高级但克制的进入方式；
- 每幕有独立色彩和几何语义；
- 按钮、loading、selected、copy 状态统一；
- Desktop 与 Mobile 都流畅；
- P1.2 的真实 AI + 知乎链路完全不受影响。
