# 「问得更好」前端设计与响应式规范

> Status: **Pre-implementation frontend spec**  
> Goal: 先实现 Web，但移动端布局必须直接作为未来 Expo Android 客户端的界面参考。

## 1. 前端目标

前端不是聊天机器人界面，而是一个“Question IDE / Question Compiler”。

用户要明显感受到：

- 原始问题正在被“理解”
- 问题结构正在被“诊断”
- 知乎已有知识正在被“检索”
- 知识缺口正在被“识别”
- 最终问题正在被“编译”

UI 的核心任务不是炫技，而是把这个过程解释清楚。

## 2. Web 与 Android 的关系

采用：

> **Shared Product Model + Platform-specific Layout**

共享：

- 页面流程
- 文案语义
- 状态机
- 数据结构
- 组件语义
- Design Tokens

不强制共享：

- PC 三栏布局
- Android 导航方式
- Android 原生触摸组件
- 大屏特有交互

Web Mobile Layout 将作为 Expo Android 第一版的主要视觉参考。

## 3. 页面流程

```text
/                 Landing + Raw Question
/compile          Question Compiler Workspace
```

MVP 不需要复杂多路由。

`/compile` 内部根据状态机切换：

```text
Analyze
→ Clarify
→ Diagnose
→ Coverage
→ Result
```

这样用户不会因为跳转页面而丢失上下文。

## 4. Desktop Layout

适用：`>= 1280px`

最大内容宽度：约 1440px。

Workspace：

```text
┌──────────────────────────────────────────────────────────────┐
│ Header                                                       │
│ Ask Better / Stepper / Status                               │
├────────────────┬───────────────────┬─────────────────────────┤
│ Draft          │ Diagnostics       │ Compiled Question       │
│                │                   │                         │
│ Raw Question   │ Intent            │ Live / Final Result     │
│ Context        │ Warnings          │                         │
│ Answers        │ Missing Context   │                         │
├────────────────┴───────────────────┴─────────────────────────┤
│ Zhihu Knowledge Coverage                                    │
│ Similar Questions | Covered | Knowledge Gap                 │
└──────────────────────────────────────────────────────────────┘
```

建议比例：

- Draft：28%
- Diagnostics：32%
- Compiled：40%

Coverage 在桌面端独占整行，避免把来源证据挤进窄栏。

## 5. Tablet Layout

适用：`768px–1279px`

采用两列 + 结果下移：

```text
┌─────────────────────────────┐
│ Header / Stepper            │
├──────────────┬──────────────┤
│ Draft        │ Diagnostics  │
├──────────────┴──────────────┤
│ Coverage                    │
├─────────────────────────────┤
│ Compiled Question           │
└─────────────────────────────┘
```

避免缩小桌面三栏导致可读性下降。

## 6. Mobile / Android Reference Layout

适用：`< 768px`

移动端不缩放桌面 IDE，而改为步骤式单列。

```text
Header
  ↓
Stepper
  ↓
Current Stage Card
  ↓
Supporting Evidence
  ↓
Sticky Primary CTA
```

流程：

1. 输入问题
2. 理解你的问题
3. 补充关键信息
4. 问题诊断
5. 查看知乎已有讨论
6. 发现知识缺口
7. 查看编译结果

移动端 Result 页面：

```text
Compiled Question

[最终标题]
[背景]
[目标]
[限制]
[核心困惑]
[期待回答]

Before / After

[复制问题]
[打开知乎]
```

这个单列设计直接作为未来 Expo Android Client 的第一版信息架构。

## 7. Navigation

MVP 不使用复杂侧边栏。

顶部 Header：

- Logo / 问得更好
- 当前阶段
- 新建问题

Desktop 可显示完整 Stepper：

```text
理解 → 澄清 → 诊断 → 检索 → 编译
```

Mobile 使用：

```text
3 / 5 · 问题诊断
```

防止顶部过宽。

## 8. Screen 01 — Landing

### Hero

主标题：

> **你真正想问什么？**

副标题：

> 不需要提前组织好语言。把你的困惑告诉我们，我们先帮你把问题问清楚。

输入框：

- 多行 textarea
- 默认高度约 160px Desktop / 140px Mobile
- 字符数 5–1000

主 CTA：

> **开始编译问题**

辅助示例 Chips：

- 现在转码还有前途吗？
- 考研还是就业？
- AI 应用开发应该怎么学？

点击示例只填入输入框，不自动提交。

## 9. Screen 02 — Analyze / Understanding

进入 Workspace 后先显示可见过程，而不是空白 Loading。

状态文案：

```text
正在理解你的真实意图…
正在检查问题范围…
正在寻找可能缺失的条件…
```

分析完成后显示：

### Intent Card

> 我理解你主要想判断：

最多 4 条。

### Missing Context Preview

显示：

- 缺失字段
- 为什么重要

主 CTA：

> **补充 3 个关键条件**

如果系统判断无需追问：

> **直接检查问题**

## 10. Screen 03 — Clarification

原则：一次只把一个问题作为视觉焦点。

Desktop 可在同一卡片中显示 2–4 项；Mobile 建议逐项前进。

Question Types：

- Single Select
- Multi Select
- Short Text

每道题可有：

> 为什么要问这个？

展开后显示原因。

用户可：

- 回答
- 跳过
- 返回修改

主 CTA：

> **继续诊断**

## 11. Screen 04 — Diagnostics

这是视觉记忆点之一。

### Question Lint Header

```text
Question Diagnostics
发现 4 个需要改进的地方
```

Lint Item：

```text
W001 · Scope Too Broad
问题范围过宽

“转码”可能包含前端、后端、AI 应用等不同方向。

为什么重要
不同方向的就业机会与学习成本不同。
```

Severity 语义：

- info
- warning
- high

不要使用“error”吓用户，因为自然语言问题不存在编译失败意义上的语法错误。

### Intent Panel

同时显示系统理解到的 Intent。

### User Control

用户必须可以：

> “这个理解不对”

返回上一阶段修正。

## 12. Screen 05 — Retrieval / Coverage

### Loading

不要显示纯 Spinner。

显示：

```text
正在搜索知乎已有讨论…
正在比较相似问题…
正在分析哪些内容已经被回答…
```

### Similar Questions

每项至少显示：

- 标题
- 来源
- 相关性信号（若 API 有）
- 发布时间
- 原文链接

不要伪造“92%”等数字；仅在后端真实提供可解释的相关性值时展示。

### Existing Coverage

标题：

> **知乎已经讨论过什么？**

展示 3–5 条。

### Knowledge Gap

标题：

> **真正还值得继续问什么？**

展示当前检索结果较少覆盖的条件。

必须加来源边界说明：

> 基于本次检索到的知乎内容分析，不代表全站绝对不存在相关讨论。

## 13. Screen 06 — Compile Result

Header：

```text
Question Successfully Compiled
```

中文主状态：

> **问题已编译完成**

### Final Question Package

包含：

- 标题
- 背景
- 目标
- 限制
- 已尝试
- 核心困惑
- 希望回答者重点讨论

所有字段可进入编辑模式。

### Primary Actions

P0：

- **复制问题**
- **重新编译**

P1：

- **打开知乎提问页**

如果未来存在官方发布接口，再增加 Publisher Adapter；当前不显示“已发布成功”等误导状态。

## 14. Before / After

必须是最终页主视觉之一。

Desktop：左右并排。

Mobile：上下排列。

```text
Before
现在转码还有前途吗？

After
27 届通信工程本科生，在 AI Coding 工具普及后……
```

新增的信息可以做语义高亮，但不做复杂字符级 diff 动画。

## 15. Question Quality Estimate

P1 才实现。

如果实现，必须写：

> **AI Estimate**

而不是知乎官方评分。

推荐显示 4 个以内维度，避免雷达图堆信息。

## 16. Design Language

关键词：

- precise
- intelligent
- calm
- technical but accessible
- evidence-driven

视觉上借用 IDE / compiler 语言，但不把普通用户变成程序员。

可以使用：

- Diagnostic Code
- Compile
- Coverage
- Evidence
- Diff

避免：

- 黑客终端风
- 大量代码字体
- 满屏霓虹
- 复杂命令行视觉

## 17. Design Tokens

建立共享语义 Token，不直接让业务组件依赖硬编码色值。

至少包含：

- background
- surface
- surface-muted
- text-primary
- text-secondary
- border
- accent
- diagnostic-info
- diagnostic-warning
- diagnostic-high
- success

Android Expo 后续映射同一语义 Token。

## 18. Typography

优先系统中文字体栈。

层级：

- Display
- H1
- H2
- Body
- Small
- Label
- Mono Label（仅 Code / Lint ID）

正文不使用 Mono。

## 19. Spacing

采用 4px 基础栅格、8px 主节奏。

常用：

- 4
- 8
- 12
- 16
- 24
- 32
- 48

移动端左右边距默认 16px。

桌面 Workspace 内边距默认 24px。

## 20. Components

前端组件按产品语义拆，而不是按页面复制。

```text
QuestionInput
IntentSummary
ClarificationCard
LintList
LintItem
RetrievalProgress
SimilarQuestionList
SimilarQuestionItem
CoverageSummary
KnowledgeGapCard
CompiledQuestionEditor
BeforeAfterDiff
PrimaryActionBar
StageStepper
```

复杂组件应该保持单一责任。

## 21. Shared vs Platform UI

未来 `apps/mobile` 不直接 import Web DOM 组件。

共享：

```text
packages/core
packages/schemas
packages/api-client
packages/design-tokens
```

Web 组件：

```text
apps/web/src/components/*
```

Mobile 组件：

```text
apps/mobile/components/*
```

这样不会为了 100% UI 复用牺牲平台体验。

## 22. Loading States

每个长阶段都显示真实阶段进度。

禁止：

> 一个 Spinner 转 15 秒。

建议：

```text
✓ 已理解问题主题
✓ 已识别 3 个缺失条件
● 正在检索知乎讨论
○ 正在寻找知识缺口
```

状态只能由真实后端阶段驱动，不能用纯定时器假装完成。

## 23. Error States

### AI Analyze Failed

> 暂时没能理解这个问题，请重试；你的原始输入仍然保留。

### Zhihu Retrieval Failed

允许降级：

> 知乎检索暂时不可用。你仍然可以继续进行问题结构优化，但 Knowledge Coverage 本次不可用。

### Quota Limited

> 今日知乎接口额度暂时不足，本次将跳过站内覆盖分析。

禁止无限自动重试。

## 24. Empty States

如果没有找到足够相似结果：

> 当前检索没有找到足够相似的知乎讨论。

不能写：

> “知乎从来没人问过。”

## 25. Accessibility

P0 至少保证：

- 所有按钮键盘可聚焦
- 明确 Focus State
- 表单都有 Label
- Warning 不仅依赖颜色
- 对比度满足常规可读性
- Mobile Touch Target 不小于约 44px

## 26. Responsive Acceptance Criteria

### Desktop 1440px

- 三栏 Workspace 同时可见
- Coverage 独占下方区域
- 不产生横向滚动

### Laptop 1024px

- 两栏布局
- Result / Coverage 可自然下移
- 不压缩正文到难以阅读

### Mobile 390px

- 单栏步骤式布局
- 无横向滚动
- 主 CTA Sticky 可达
- Lint / Similar Question 卡片完整阅读
- Result 可直接复制

### Small Mobile 360px

- 主交互不溢出
- Chips 可换行
- 标题不截断核心语义

## 27. Performance Targets

前端目标：

- Landing 首屏不依赖知乎 API
- 页面 Skeleton 即时出现
- Client JS 保持克制
- 搜索结果列表默认限制数量
- 不在浏览器加载完整知乎长文本

## 28. Golden Demo UX

Golden Input：

> 现在转码还有前途吗？

Demo 必须清晰出现以下瞬间：

1. AI 明确指出问题过宽
2. 只追问 2–4 个关键条件
3. 显示真实知乎 Similar Questions
4. 显示 Existing Coverage
5. 突出 Knowledge Gap
6. Before / After 强对比
7. 一键复制最终问题

任何不服务这七个瞬间的视觉功能均为次要。

## 29. Frontend P0

必须实现：

- Landing
- Responsive Workspace
- Analyze State
- Clarification
- Diagnostics
- Retrieval / Coverage
- Knowledge Gap
- Compile Result
- Before / After
- Copy
- Loading / Error / Empty

## 30. Frontend Non-goals

第一阶段不实现：

- 登录注册 UI
- 收藏夹页面
- 用户中心
- Dashboard
- 社交
- Feed
- AI 完整回答聊天页
- 复杂主题切换
- Android 原生页面

Android 当前只要求 Web Mobile Layout 成为可直接参考的产品规范。

## 31. 实现顺序

前端代码实现时按：

```text
1. Monorepo + Web scaffold
2. Design Tokens / Layout Shell
3. Landing
4. Static Compiler Workspace
5. Responsive Mobile Layout
6. State Machine + Mock Data
7. Loading / Error / Empty
8. Connect Real API
9. Polish Golden Demo
```

先用 Mock Contract 完成稳定 UI，再连接真实 AI / Zhihu API，避免前端开发被后端接口进度阻塞。
