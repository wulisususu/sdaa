# P1.3 Five-Scene Experience Design

## 实施前置清理

在开始任何 P1.3 五幕场景、背景板、GSAP 动画、按钮和交互改造之前，先删除当前首屏中的以下内容：

1. 删除文案：
   「不需要先组织好语言。把困惑原样写下来，我们会先识别意图、补齐关键条件，再判断知乎已有讨论覆盖了什么。」
2. 删除首屏中的英文标签：
   `Question Input`

这两项删除属于本轮视觉改造的前置清理，不需要寻找替代文案，也不要在其他位置重新出现。

完成后，再按照本设计继续进行五阶段场景化设计：

`Input → Clarify → Diagnose → Coverage → Result`

本轮不得修改 AI 主链路、API 契约、Domain Schema、检索逻辑或编译逻辑，仅处理前端视觉、交互、动效与响应式体验。

---

## 1. 目标

把当前“单一浅色页面中切换五个组件”的体验，升级为一套连续的五幕 Question Compiler 场景系统。每个阶段都有独立的背景色、背景图形、文字层级和入场/退场节奏；阶段切换时背景与内容作为一个完整场景整体切换，而不是仅替换卡片内容。

用户应明显感受到：问题正在被一步步“编译”。

## 2. 设计原则

- 五个阶段必须一眼可区分，但仍属于同一品牌系统。
- 主流程是交互式业务流程，不使用 ScrollTrigger 驱动阶段状态。
- React 管理真实业务状态；GSAP 只负责视觉表现和过渡。
- 动效必须服务信息层级，不做无意义炫技。
- 优先使用 `transform` 与 `opacity`；避免高频 layout reflow。
- Desktop 与 Mobile 同时设计；移动端不是桌面缩小版。
- 必须支持 `prefers-reduced-motion: reduce`。
- 所有 API loading、error、disabled、back/revisit 行为必须保留。

## 3. 五幕视觉系统

| Stage | 主色方向 | 情绪 | 背景图形语义 |
| --- | --- | --- | --- |
| 01 Input | 暖奶油黄 `#F2C96D` | 开放、提问、开始 | 抽象问号 / 圆弧 / 大尺度几何 |
| 02 Clarify | 珊瑚橙 `#E97951` | 对话、推进 | 对话气泡 / 重叠圆形 |
| 03 Diagnose | 深莓紫 `#A85A76` | 检查、判断 | 网格 / 扫描线 / issue markers |
| 04 Coverage | 蓝紫 `#665BC6` | 知识、检索 | 节点网络 / evidence connections |
| 05 Result | 深青绿 `#287B6C` | 完成、可信 | 聚合线条 / 收束矩形 / check-like composition |

以上 HEX 是第一版视觉方向，实施前必须进行 WCAG 对比度检查并允许在同色相内微调明度/饱和度。

### 背景板结构

每一幕背景由三层组成：

1. Base Color：阶段主色。
2. Soft Geometry：4%–8% 透明度的大尺度矢量/纯 CSS 几何形态。
3. Ambient Layer：极轻的渐变、grain 或 glow，用于消除纯色平面感。

禁止：高频噪点、WebGL、3D、大面积重 blur、复杂视频背景。

## 4. 场景架构

现有 `CompilerDemo` 继续管理：

- `stage`
- `maxVisited`
- `rawQuestion`
- clarification answers
- analysis / retrieval / compiled
- loading / error / copy status
- API 调用和 requestVersion 取消逻辑

新增视觉层只包裹现有 Stage：

```text
CompilerDemo
├─ AppHeader
├─ StageSceneShell
│  ├─ StageBackdrop
│  ├─ StageProgress
│  └─ StageSceneViewport
│     ├─ outgoing scene
│     └─ incoming scene
│
├─ InputStage
├─ ClarificationStage
├─ DiagnosisStage
├─ CoverageStage
└─ ResultStage
```

业务 Stage 不负责决定场景切换时间。`StageSceneShell` 根据外部传入的 `stage` 和方向执行动画。

## 5. GSAP 技能与职责

### 必用

#### `gsap-core`
用于：按钮 press/hover、卡片进入、选项选中、文字/图形的 transform 与 opacity。

#### `gsap-react`
用于：`useGSAP()`、scope/ref 管理、React 生命周期清理、Strict Mode 与 SSR 安全。

#### `gsap-timeline`
用于：五幕场景 Push + Reveal 编排、文字 reveal、结果页 Before → After 视觉高潮。

#### `gsap-performance`
作为工程约束：优先 transform/opacity，限制 blur/filter/layout 动画，移动端降低位移和同时运动元素数量。

### 可选

#### `gsap-utils`
仅用于 clamp、mapRange、selector helper 等小型辅助。

### 本轮不进入主流程

#### `gsap-scrolltrigger`
不负责五阶段业务切换。未来可用于首页下方 “How Ask Better Works” 的滚动叙事区。

#### `gsap-plugins`
本轮默认不引入 Flip/SplitText 等额外复杂度。若最终文字 Mask Reveal 用纯 CSS overflow + timeline 足够，则不增加插件依赖。

## 6. 主场景切换：Push + Reveal

阶段 N → N+1 的统一节奏：

| 时间 | outgoing scene | incoming scene |
| ---: | --- | --- |
| 0ms | 当前可交互 | 屏幕右外 / 隐藏 |
| 0–120ms | CTA press feedback | — |
| 120–260ms | 内容轻微缩小、opacity 下降 | 新背景开始进入 |
| 180–720ms | Scene 向左退出 | Scene 从右进入并接管背景 |
| 480–820ms | 完成退出 | Stage number / headline / card 分层 reveal |
| 820–950ms | — | 恢复交互 |

标准场景时长：`760ms`，总感知时长不超过 `950ms`。

### 层次差

同一场景内部采用轻微时间差：

- Backdrop 先完成接管。
- Stage number 延迟约 40–60ms。
- Headline 延迟约 70ms。
- Main card / workspace 延迟约 70ms。

禁止所有元素以完全相同速度、相同方向整体平移，否则会出现 PPT 感。

### 反向导航

用户返回上一阶段时方向反转：

- outgoing 向右退出；
- incoming 从左进入。

已访问 Stepper 跳转同样根据阶段 index 比较决定方向。

## 7. Typography Motion

### Mask Reveal

阶段编号、主标题和结果页标题采用 `overflow: hidden` 容器 + yPercent reveal；不要求 SplitText。

### Line Stagger

两行文案按 60–90ms stagger 依次进入。

### Word Emphasis

仅少量强调词允许 `opacity + scale + letter-spacing` 的轻度变化；不做逐字弹跳。

文字动画必须在用户可以阅读之前迅速完成，不能为了动画延迟内容可见性。

## 8. 各阶段设计

### 01 Input

重点：最大留白、最大标题、最大输入区域。

结构：

- `01 / 05`
- `INPUT`
- 主标题
- 大型 textarea
- 示例问题 chips
- 主 CTA：开始编译问题
- 可信说明：真实 AI + 知乎检索 / 不会自动发布

前置删除后的旧长说明与 `Question Input` pill 不再出现。

### 02 Clarify

重点：一次突出一个澄清问题，而不是让用户视觉上同时处理所有问卷。

- 当前问题为主视觉中心。
- options 做 selected / answered 状态。
- 答题后当前问题轻退场，下一题轻进入。
- 必须保留用户回看和修改已答问题的能力。

### 03 Diagnose

重点：把“问题有什么毛病”讲清楚，但避免警报式红色后台感。

- intent 与 diagnostics 分层展示。
- issue items 采用 60–80ms stagger。
- severity 用图标/标签/边框辅助，不依赖颜色单独表达。

### 04 Coverage

重点：最强的信息密度场景。

- Existing Coverage 与 Knowledge Gap 有明确分区。
- Evidence 首批少量展示，保留现有 progressive disclosure。
- Evidence cards stagger reveal，但数量多时只动画可见首批，展开时不逐张长时间动画。
- 知乎真实来源链接保留。

### 05 Result

重点：整个产品的视觉高潮。

- BEFORE：原始问题。
- COMPILE transition：简短视觉过渡。
- AFTER：知乎可发布版本。
- 主 CTA：复制知乎版问题。
- Secondary：前往知乎。
- 重新优化 / 新问题保留。

Before 先轻微收缩和降 opacity，After 再进入；不能让最终内容被动画遮挡太久。

## 9. Stepper / Progress

Desktop 保留五阶段导航，但视觉上融入背景，不再像独立白色 SaaS 卡片。

Mobile 使用：

`2 / 5 · 补充信息`

搭配细进度线。

Stepper 文本/图标颜色根据当前 Stage theme 自动切换为浅色或深色高对比版本。

## 10. Button / Interactive System

只保留三类：

- Primary
- Secondary
- Ghost

统一交互：

- hover：`translateY(-2px)` 左右；
- press：`scale(.975)`；
- loading：尺寸不跳变，spinner 替换图标；
- success：copy 时用 check 状态替代额外大型 Toast；
- disabled：视觉明显但仍可辨认文字。

键盘 focus 必须始终明显。

## 11. Motion Tokens

统一 token：

- `micro`: 160ms
- `fast`: 240ms
- `standard`: 420ms
- `scene`: 760ms
- `stagger-xs`: 40ms
- `stagger-sm`: 70ms

Ease 不超过三套：

- standard: `power3.out`
- scene: `power3.inOut`
- press: `power2.out`

## 12. Visual Reference Collection / 背景板采集

开发前先完成参考采集，而不是直接凭感觉写 CSS。

### 采集数量

20–30 个参考，四类各 5–8 个。

### A. Scene Transition

关键词：

- GSAP horizontal panels
- full screen panel transition
- scene transition web
- pinned panel animation

记录：切屏方向、边界、时长、是否 overshoot、背景与内容是否同速。

### B. Typography

关键词：

- GSAP typography reveal
- mask text reveal
- editorial web typography

记录：行距、字号比例、mask 方向、stagger 节奏。

### C. Product Interaction

参考 Linear / Vercel / Raycast / Arc / Notion / Perplexity 等产品，只采：按钮反馈、输入、loading、disabled、selection、progress。

### D. Editorial / Award Sites

只采：大字体、留白、色块、Panel、节奏；禁止照搬滚动劫持、3D、WebGL。

### Reference Board 交付格式

创建：`docs/design/p1.3-reference-board.md`

每个参考必须写：

- 来源/链接
- 截图或描述
- `采：...`
- `不采：...`
- 对应 Stage/Component

## 13. Mobile Web

Mobile 从设计开始就参与，不是收尾响应式。

主验收宽度：390px；辅助：360px、430px。

- 使用 `100dvh` / `min-height: 100dvh`，处理 Safari 地址栏。
- 使用 `env(safe-area-inset-bottom)` 保护底部操作区域。
- Scene 横移距离比 Desktop 短，推荐 12–20vw + fade，而不是完整 100vw。
- Scene 时长缩短到约 500–600ms。
- 键盘弹出后 textarea 与 CTA 不应被强制锁在错误 viewport 高度。
- Result 的主要复制 CTA 在长内容场景允许 sticky action bar。
- 禁止横向 overflow。

目标浏览器：

- iPhone Safari
- Android Chrome
- 桌面 Chrome/Edge

## 14. Reduced Motion

`prefers-reduced-motion: reduce` 时：

- Scene push → 短 fade；
- mask reveal → 直接显示或轻 fade；
- stagger → 关闭；
- 功能、导航、API 状态完全一致。

## 15. 性能边界

- 高频动画只用 transform / opacity。
- 背景图形优先 CSS/SVG 静态图形，不做持续复杂动画。
- 同时活动的 GSAP timeline 必须在 stage change/unmount 时清理。
- 禁止全局 querySelector 无 scope 绑定大量节点。
- 不为了动效引入额外图片大资源。
- iPhone Safari 上关闭重 blur、大范围 backdrop-filter 动画。

## 16. 测试与验收

### Functional regression

五阶段 API 主链路行为必须和 P1.2 一致：Analyze → Clarify → Diagnose → Retrieve → Coverage → Compile → Result。

### UI state

- forward / back / visited step navigation 正常；
- operation 中途切换能正确 cancel；
- 修改答案会 invalidate retrieval / compiled；
- copy / reoptimize / new question 正常；
- loading/error 状态不会被动画吞掉。

### Responsive

至少验收：360、390、430、768、1024、1440 宽度。

### Accessibility

- WCAG 对比度；
- focus-visible；
- reduced motion；
- severity 非纯色传达；
- DOM 顺序与视觉顺序一致。

### Performance

- Desktop Chrome/Edge 主流程无明显 jank；
- iPhone Safari / Android Chrome 切屏流畅；
- 无横向 overflow；
- 动画不造成明显 CLS。

## 17. 非目标

本轮不做：

- Chrome Companion Extension
- Android Expo 原生客户端
- AI prompt / schema / provider 调整
- 知乎发布 API
- 新的后端能力
- ScrollTrigger 驱动主业务流程
- WebGL / 3D / 大型动效框架

Android Expo 客户端属于下一阶段；本轮先把 Mobile Web 打磨到可以在 iPhone Safari 和 Android Chrome 直接使用。
