# Competition Productization / UX Polish Design

> Status: **Approved design direction / implementation freeze**  
> Scope: P1 Web competition productization only. Preserve the validated P0 pipeline and public API contracts.

## 1. Goal

Turn the already-working public Ask Better Question Compiler into a competition-ready product whose value is immediately understandable, visually memorable, responsive, accessible, and stable under real DeepSeek + Zhihu traffic.

The product must still feel like a **Question IDE / Question Compiler**, not a chatbot and not a generic SaaS dashboard.

## 2. Non-goals

This phase does **not** change:

- `POST /api/question/analyze`
- `POST /api/question/retrieve`
- `POST /api/question/compile`
- existing Domain/Zod contracts
- DeepSeek provider choice
- Zhihu official Search integration
- evidence-bounded Coverage / Gap semantics
- stale-request invalidation / re-optimize behavior
- no-mock-success rule
- OAuth
- Android / Expo
- auto-publishing to Zhihu
- database architecture

Any UI change that would require modifying these contracts is out of scope unless a separate design review is approved.

## 3. Design Direction

Chosen direction: **Light Technical / Question IDE**.

Keywords:

- precise
- intelligent
- calm
- evidence-driven
- compiler-like
- approachable

Avoid:

- cyberpunk / hacker terminal styling
- neon-on-black aesthetics
- heavy gradients everywhere
- generic blue-white admin dashboard appearance
- fake percentages or fake progress
- animation that is not tied to a real state transition

## 4. Visual System

### 4.1 Color semantics

Use semantic design tokens instead of hard-coded component colors.

Required token groups:

- `page`
- `surface`
- `surface-raised`
- `surface-muted`
- `text-primary`
- `text-secondary`
- `text-tertiary`
- `border`
- `border-strong`
- `accent`
- `accent-hover`
- `accent-soft`
- `focus-ring`
- `success`
- `success-soft`
- `warning`
- `warning-soft`
- `danger`
- `danger-soft`
- `evidence`
- `evidence-soft`

Primary visual language: warm white / very light cool gray background, dark gray typography, indigo/blue accent, restrained green for evidence/success, amber for warning, red only for high severity/error.

### 4.2 Typography

Use system Chinese font stack. Preserve high readability over decorative character.

Hierarchy:

- Display: competition hero only
- H1: page title
- H2: stage title
- H3: card title
- Body
- Small
- Label
- Mono Label: diagnostic code / technical metadata only

Do not use monospace for paragraphs.

### 4.3 Radius / shadow / borders

Cards use medium radius and subtle border-first separation. Shadows must be soft and low contrast. Important active surfaces may lift slightly on hover; static information cards should not float excessively.

## 5. Interaction System

All actionable controls must support explicit states:

- default
- hover
- pressed
- focus-visible
- disabled
- loading
- success when applicable
- error when applicable

### 5.1 Primary buttons

Behavior:

- hover: slight elevation / higher contrast
- pressed: returns down visually
- focus-visible: strong accessible ring
- loading: preserve width, show progress indicator and real stage copy
- disabled: lower contrast but remain readable

No fake loading timers.

### 5.2 Copy action

`复制问题` has three states:

- idle: `复制问题`
- success: `✓ 已复制`
- error: `复制失败，请重试`

Success state should be visually positive but not disruptive.

### 5.3 Option buttons

Clarification options must expose selected state clearly through more than color alone: border/weight/check indicator or filled state.

## 6. Stage Stepper

Desktop/tablet stepper states:

- future: neutral
- available/visited: enabled neutral
- completed: checkmark + subtle success/accent treatment
- active: strongest accent surface
- disabled: muted

Mobile does not compress the five-step desktop nav. It shows compact progress such as:

`3 / 5 · 问题体检`

The current stage must remain perceivable without horizontal scrolling.

## 7. Input Stage

The landing/input experience must communicate value before the first API call.

Required structure:

1. Eyebrow: `知乎 AI 提问编译器`
2. Hero: `你真正想问什么？`
3. Short value explanation
4. Large question input
5. Character count / validation feedback
6. Example chips
7. Primary CTA
8. Trust line: real AI + Zhihu Search, no automatic publishing

Example chips only fill the input; they never auto-submit.

The CTA should feel like a compile/run action without looking like developer tooling.

## 8. Clarification Stage

Clarification becomes a focused decision flow, not a wall of radio buttons.

Desktop:

- 2–4 cards may be shown together
- active/answered cards have visible completion state
- progress visible: `已回答 N / M`

Mobile:

- prioritize one question visually at a time
- next unanswered item should be obvious
- touch target >= 44 px

Helper copy answers “why this matters” in secondary hierarchy.

Skipping remains allowed when current product semantics permit it.

## 9. Diagnostics Stage

Diagnostics is one of the visual signature screens.

Layout should make three things instantly scannable:

- the original question
- interpreted intent
- lint findings

Diagnostic cards display:

- code, e.g. `W001`
- severity
- title
- short explanation

Severity is represented by icon/label + tone, not color only.

Avoid the word `error` for natural-language question quality.

## 10. Retrieval / Coverage Stage

This stage must reduce information overload while preserving all real Evidence.

### 10.1 Summary-first hierarchy

Above evidence list, show:

- retrieval status
- coverage summary
- knowledge gaps
- evidence count

### 10.2 Evidence progressive disclosure

When evidence is large (for example 24 items), default UI shows a small relevance-first subset (target: 4–6 items), then offers:

`查看全部 N 条参考来源`

Expanding must reveal the complete real Evidence already in client state. No additional network request is required solely for expansion.

Each Evidence item shows:

- title
- author
- upvotes
- comments
- concise summary
- link to original Zhihu content

### 10.3 Evidence boundary

Always retain wording equivalent to:

`基于本次检索到的知乎内容分析，不代表全站绝对不存在相关讨论。`

Knowledge Gap wording must remain evidence-bounded and avoid absolute whole-platform claims.

## 11. Result Stage

The Result stage is the strongest competition visual moment.

### 11.1 Completion header

Show:

- success state
- whether evidence was used
- compact evidence provenance summary

### 11.2 Before / After

Desktop: side-by-side.

Mobile: vertical.

The visual narrative should be obvious without reading every field:

`模糊问题 → 编译 → 可回答的问题`

No fabricated personal facts may appear in highlight treatment.

### 11.3 Question Package

Present final fields as a clear structured package:

- title
- background
- goal
- constraints
- core uncertainty
- expected answer

Primary actions:

- copy
- open Zhihu ask page

Secondary actions:

- re-optimize
- new question

`重新优化` must preserve the already-tested downstream invalidation behavior.

## 12. Loading / Progress

Every long operation must communicate the real current phase.

Analyze example:

- `正在理解你的问题…`

Retrieve example:

- `正在知乎已有讨论中查找相关内容…`

Compile example:

- `正在把信息编译成一个更清楚的问题…`

The UI may show a short checklist of conceptual substeps only when it does not falsely imply unavailable backend granularity. It must not use timers to simulate server progress.

## 13. Error / Partial Success

Preserve current product semantics:

- AI failure keeps user input
- Zhihu partial/quota-limited keeps any real evidence already obtained
- unavailable retrieval may still continue to compile without evidence
- no fake evidence

Errors should render inline near the affected stage and expose a clear retry path when the existing operation supports retry.

## 14. Responsive Layout

### Desktop >= 1280 px

Question IDE feel with strong information density and broad canvas. Coverage/Evidence has enough horizontal room to remain readable.

### Tablet 768–1279 px

Two-column layouts where useful, with Result / Evidence flowing below rather than squeezing desktop proportions.

### Mobile < 768 px

Single-column step flow:

- compact stage header
- one primary task per screen
- sticky primary CTA when useful
- no compressed desktop three-column UI
- touch targets >= 44 px

## 15. Accessibility

P1 acceptance requires:

- keyboard-focusable buttons and links
- visible `:focus-visible`
- labels for form fields
- `aria-current` for active stage
- `aria-pressed` for selectable options
- status/error semantics preserved
- warning/severity not expressed only by color
- ordinary text contrast appropriate for long reading
- reduced motion support for non-essential transitions

## 16. Motion

Motion is functional, restrained, and short.

Allowed examples:

- button hover/press
- card selection
- stage transition fade/slide
- expansion/collapse of Evidence
- copy success feedback

Avoid:

- constant ambient animations
- large parallax
- long spring animations
- animated counters disconnected from real state

Respect `prefers-reduced-motion`.

## 17. CSS / Component Structure

The current monolithic compressed `globals.css` should be converted into maintainable semantic sections or imported style files without changing the framework stack.

Do not introduce a heavy UI framework in this phase.

Preferred organization:

- tokens / reset
- shell / header
- buttons / interaction states
- stepper
- stage shared styles
- input
- clarification
- diagnostics
- coverage / evidence
- result
- responsive rules
- reduced motion

React components may be split only where the current file has a clear independent responsibility. Avoid unrelated refactors.

## 18. Figma Usage

Figma is the design-system companion, not a separate source of product truth.

Create/sync a P1 file containing:

- semantic color/token sheet
- typography hierarchy
- button states
- option states
- stepper states
- Evidence card
- Diagnostic card
- Before/After result composition
- desktop key screens
- mobile key screens

Code and Figma should use the same semantic naming where practical.

## 19. Reference Research

Mobbin may be used for references when account access permits. References are inspiration only; do not copy another product wholesale. The resulting visual language must remain specific to Ask Better's question-compilation flow.

## 20. Testing / Regression Gate

P1 is rejected if visual work breaks any validated P0 behavior.

Required regression coverage:

- analyze → clarify → diagnose → retrieve → compile
- clarification answer change invalidates stale downstream results
- back navigation during async operations is safe
- real Evidence remains clickable
- quota/partial/unavailable semantics remain intact
- `evidenceUsed` semantics remain intact
- copy action works
- re-optimize clears compiled result
- desktop and mobile critical path

Add focused component/state tests where new interaction logic is introduced.

Final verification:

```bash
pnpm smoke:test
pnpm --filter @ask-better/domain test
pnpm --filter @ask-better/domain typecheck
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web build
```

Then run the three public Golden Demo cases against production after deployment.

## 21. Success Criteria

This phase is complete when:

1. The first screen explains the product value within seconds.
2. Every primary action has polished and accessible interaction states.
3. Step progress is obvious on desktop and mobile.
4. Clarification selection is unambiguous.
5. Diagnostics feels like a deliberate product feature, not raw model output.
6. 24 Evidence items no longer overwhelm the initial Coverage view, while all remain accessible.
7. Result Before/After is the strongest visual story in the product.
8. The mobile flow is purpose-built, not a shrunken desktop layout.
9. No P0 pipeline behavior regresses.
10. CI, build, smoke, and Golden Demo remain green.
