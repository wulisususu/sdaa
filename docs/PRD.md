# 「问得更好」Master PRD v2.0
## 知乎 AI Question Compiler / Ask Better

> **一句话定位**  
> 把用户尚未表达清楚的真实需求，编译成一个信息完整、边界明确、与已有知识有差异、值得知乎社区回答的问题。

> **Slogan**  
> **把模糊需求，编译成值得回答的问题。**

> **产品核心命题**  
> AI 已经越来越会回答问题。  
> 「问得更好」希望解决的是：**在答案产生之前，人到底有没有把真正的问题问出来。**

---

# 0. 文档信息

| 字段 | 内容 |
|---|---|
| 产品名称 | 问得更好 |
| 英文名称 | Ask Better |
| 产品代号 | Question Compiler |
| 文档版本 | Master PRD v2.0 |
| 文档用途 | 开发前冻结 / 产品设计 / 技术实现 / 比赛计划书母文档 |
| 所属赛事 | 知乎黑客松 2026 · 校园新锐季 |
| 所属赛道 | 📚 知识炼金场：社区 × 学习 |
| 主产品形态 | 公网 Web Application |
| 增强形态 | Zhihu Companion（浏览器插件 / Userscript，P2） |
| 开发周期 | 48 小时 |
| 核心用户 | 有真实问题，但不知道如何完整表达需求的知乎用户 |
| 产品阶段 | Hackathon MVP |

---

# 1. Executive Summary

知乎已经积累了十五年的问题、回答、专业讨论和真实经验。

过去的产品优化大多集中在问答链路的后半段：

- 搜索更准
- 推荐更准
- 回答排序更好
- AI 总结
- 观点聚合
- 知识图谱
- 学习路径
- 内容改写

但整个知识生产链路中，还有一个非常上游的问题长期被忽略：

> **进入系统的 Question，本身可能就是一个低质量 Query。**

例如：

> 「计算机怎么学？」

与：

> 「我是大四视觉传达专业、无计算机基础，希望 6 个月转向 AI 应用开发，每周可投入 15 小时，目标毕业后求职。Python、Web、LLM API、RAG 和 Agent 应该按照什么顺序学习，每一阶段达到什么程度才足够投递初级岗位？」

它们背后可能是同一个真实需求，但对平台、答主和搜索系统而言，是完全不同的信息质量。

如果一个模糊问题直接进入知乎：

```text
模糊需求
  ↓
低信息密度 Question
  ↓
系统难以准确理解 Intent
  ↓
检索 / 推荐 / 答主匹配偏差
  ↓
答非所问 / 泛泛回答 / 无人回答
  ↓
用户继续在大量噪音中筛选
  ↓
“知乎没有我需要的答案”
  ↓
“为什么不直接问 AI？”
```

因此，「问得更好」不是一个“AI 润色标题”的工具。

它要建立的是知乎提问端缺失的一层：

# Question Understanding Layer

完整链路：

```text
Raw Intent
  ↓
Intent Understanding
  ↓
Missing Context Detection
  ↓
Intent Clarification
  ↓
Question Lint
  ↓
Zhihu Retrieval
  ↓
Similar Question Analysis
  ↓
Knowledge Coverage
  ↓
Knowledge Gap Detection
  ↓
Question Compilation
```

最终得到：

> **一个机器容易理解、答主容易判断、与既有内容有明确差异、真正值得被回答的问题。**

---

# 2. 官方赛题与产品契合度

## 2.1 官方赛事目标

根据《知乎黑客松 2026｜校园新锐季 开发者手册》，赛事核心不是完成一道固定题，而是：

- 从知乎真实社区场景出发
- 将 AI 放入真实的人群、关系与内容流动中
- 探索下一代知识社区的新体验
- 做出真正有用、可讨论、值得被看见的产品

官方还明确提出：

> AI 不只是效率工具，也正在参与**问题的发现、思路的展开、方案的验证与表达的完成**。

「问得更好」直接切入“问题的发现与形成”。

---

## 2.2 三大赛道

官方要求作品提交时必须选择以下赛道之一：

1. 🧠 **灵魂匹配局：社区 × 社交**
2. 📚 **知识炼金场：社区 × 学习**
3. 🎮 **跨次元游乐场：社区 × 游戏**

「问得更好」选择：

# 📚 知识炼金场

原因不是它像“学习软件”，而是：

> 它改善知乎知识生产最上游的 **Question Formation / Question Quality**。

知识炼金场官方允许的方向包括：

- AI 学习助手
- 问答辅导
- 学习路径
- 观点对照
- 知识梳理
- 职业入门
- 自我提升
- 基于知乎内容的再次生产

「问得更好」属于更上游的知识生产基础设施。

---

# 3. 参赛竞争格局

## 3.1 赛道拥挤度

基于现有参赛队伍公开想法的清洗与人工归类，排除：

- 单纯写“知乎黑客松 2026”
- “加油”
- TBD / todo
- 占位
- 无法判断产品方向的极短文本

得到的工作估计为：

| 赛道 | 估计占比 | 竞争程度 |
|---|---:|---|
| 📚 知识炼金场 | 约 68%–70% | 极高 |
| 🎮 跨次元游乐场 | 约 17%–20% | 中等 |
| 🧠 灵魂匹配局 | 约 12%–14% | 相对最低 |

> 注：这是依据公开想法文本的产品方向分类，不是官方报名字段统计，因此应视为趋势判断，而非官方精确数据。

结论：

> **知识炼金场是最拥挤的赛道。**

但这并不意味着应该换赛道。

---

## 3.2 为什么不因为“赛道人多”而换方向

官方主奖项并非按赛道分别竞争。

初审核心权重：

| 指标 | 权重 |
|---|---:|
| AI 场景价值 | 40% |
| 创新度 | 25% |
| 完成度 | 25% |
| 产品体验与设计感 | 10% |

决赛：

| 指标 | 权重 |
|---|---:|
| AI 场景价值 | 35% |
| 创新度 | 25% |
| 完成度 | 25% |
| 产品体验与设计感 | 8% |
| 计划书和演示 | 7% |

因此：

> **赛道人少 ≠ 更容易拿总奖。**

产品必须优先保证：

1. 场景真实
2. AI 必要
3. 知乎原生
4. 新颖
5. Demo 跑得起来

---

# 4. Market / Community Problem

## 4.1 信息噪音

用户原始任务可能只是：

> “我想知道 X。”

但现实路径可能变成：

```text
搜索问题
  ↓
广告 / 推荐
  ↓
盐选 / 故事内容
  ↓
商业内容 / 软文
  ↓
低相关回答
  ↓
继续筛选
  ↓
真正相关答案
```

这造成一个更核心的问题：

# Question–Answer Semantic Fit

也就是：

> 最终展示给用户的内容，到底有没有真正解决他原来的问题？

---

## 4.2 平台大量优化 Answer，Question 端被忽视

大量产品工作集中在：

- Search Better
- Recommend Better
- Answer Better
- Summarize Better
- Rank Better

但这些能力都隐含一个前提：

> 用户输入的问题已经足够准确。

实际上，普通用户经常不知道：

- 哪些背景必须提供
- 哪些约束会改变答案
- 如何定义自己的目标
- 什么条件是决定性的
- 当前问题是否已经被大量讨论
- 自己真正缺的到底是哪一个知识点

因此，上游 Query 质量会直接影响下游所有环节。

---

# 5. Core Problem：提问冷启动

我们将核心问题定义为：

# Question Cold Start

用户知道：

> “我遇到了一个问题。”

但不知道：

> “怎样把它转化成一个别人真正能够回答的问题。”

典型表现：

- 问题范围过宽
- 背景缺失
- 关键参数缺失
- 时间范围缺失
- 目标不明确
- 成功标准不明确
- 概念歧义
- 多个问题混在一起
- 隐藏假设未暴露
- 与已有问题高度重复

传统链路：

```text
模糊需求
  ↓
用户自己组织语言
  ↓
一句模糊 Question
  ↓
系统难以理解
  ↓
答主无法判断真实需求
  ↓
泛回答 / 答非所问 / 无人回答
```

目标链路：

```text
模糊需求
  ↓
AI 理解 Intent
  ↓
识别缺失条件
  ↓
追问 2–4 个高价值问题
  ↓
Question Lint
  ↓
检索知乎既有内容
  ↓
分析 Existing Coverage
  ↓
识别 Knowledge Gap
  ↓
Compile
  ↓
高质量 Question
```

---

# 6. Product Hypothesis

核心假设：

> 相当一部分低质量问答，不是因为“没有答案”，而是因为用户没有把真实需求转化成一个可准确回答的 Question。

如果这个假设成立：

```text
Better Question
  ↓
Better Intent Understanding
  ↓
Better Retrieval
  ↓
Better Expert / Answer Matching
  ↓
Higher Answer Relevance
  ↓
Higher Community Content Quality
```

---

# 7. Product Definition

## 7.1 一句话定位

> **「问得更好」是一套面向知乎提问端的 AI Question Compiler，通过 Intent Clarification、Question Lint、知乎已有知识检索与 Knowledge Gap Analysis，将用户的模糊需求编译成真正值得社区回答的问题。**

---

## 7.2 我们不是什么

### 不是 AI 文案润色器

错误示例：

```text
原问题：
现在转码还有前途吗？

AI：
请问现在转码是否仍然具有良好的发展前景？
```

这种改写只是语言变漂亮，没有增加真正的信息。

---

### 不是 ChatBot

不做：

> “你好，我是 Ask Better，有什么可以帮助你？”

然后进入无限聊天。

---

### 不是 Answer Engine

MVP 核心原则：

> **Answer Less. Ask Better.**

系统的首要任务不是回答。

---

### 不是通用学习 Agent

我们不追求：

```text
问题
→ 找资料
→ 解释知识
→ 帮用户形成结论
→ 笔记 / 卡片 / 文章
```

我们的终点是：

```text
模糊 Intent
→ 高质量 Question
```

---

# 8. Competitive Positioning

## 8.1 「月初星明」

公开产品逻辑：

```text
模糊想法
→ 拆成问题
→ 找资料
→ 比较观点
→ 形成判断
→ 笔记 / 知识卡片 / 文章
```

本质：

> Thinking / Learning Agent

终点：

> 帮用户“想明白”。

---

## 8.2 「知隙」

逻辑：

```text
用户随想 / 收藏 / 创作
→ 理解个人知识轨迹
→ 找尚未探索的部分
→ 生成“下一问”
```

本质：

> Next Question Discovery

区别：

- 知隙：**发现你下一步应该问什么**
- 问得更好：**把你现在想问的这一问编译清楚**

---

## 8.3 xixi「问题说明书」

逻辑：

```text
已有 Question
→ 聚合大量回答
→ 正反观点
→ 时间线
→ 核心结论
→ 深度内容
→ 追问建议
```

本质：

> Question → Answers → Understanding

而我们：

> Intent → Question

发生在知识链更上游。

---

## 8.4 YMYC「知见」

逻辑：

```text
复杂问题
→ 多 Agent 拆解
→ 检索知乎内容
→ 识别不同立场
→ 共识 / 分歧
→ 观点地图
```

本质：

> 帮用户理解已有答案世界。

我们：

> 在答案世界形成之前，先确保 Question 本身有效。

---

# 9. Strategic Differentiator

真正创新点不能是：

> “AI 帮你问问题。”

因为该思想已经出现。

创新必须锁定在四个模块：

# 1. Question Lint

像代码 Linter 一样检查问题结构。

# 2. Existing Knowledge Coverage

分析知乎已经回答了什么。

# 3. Knowledge Gap Detection

识别哪些条件或角度还没有被充分覆盖。

# 4. Question Compilation

在证据基础上，重新生成一个值得进入知乎知识系统的问题。

因此核心不是：

> Generate Question

而是：

> **Diagnose → Retrieve → Compare → Find Gap → Compile**

---

# 10. Target Users

## Persona A：表达困难型提问者

特征：

- 有明确困惑
- 但表达高度笼统
- 不知道还需要补什么

示例：

> “大学应该怎么过？”

---

## Persona B：复杂决策用户

示例：

- 考研还是就业？
- 两个 Offer 怎么选？
- 要不要转码？
- 是否读研？
- 买 A 还是 B？

答案高度依赖：

- 用户背景
- 目标
- 成本
- 时间
- 风险偏好
- 成功标准

---

## Persona C：专业领域新人

特征：

- 不知道专业术语
- 不知道关键参数
- 不知道什么因素真正影响答案

例如：

> “怎么部署大模型？”

但没有：

- GPU
- 显存
- 模型规模
- 推理框架
- 目标吞吐
- 系统环境

---

# 11. Jobs To Be Done

## JTBD-01

当我知道自己有一个问题，但不知道怎样描述时：

> 帮我发现回答这个问题所必须知道的关键条件。

## JTBD-02

当我准备发问时：

> 告诉我这个问题是否已经有大量高度相似内容。

## JTBD-03

如果已有大量讨论：

> 告诉我它们已经回答了什么。

## JTBD-04

帮助我识别：

> 我真正还缺的答案是什么。

## JTBD-05

最终：

> 帮我形成一个别人看了就知道该回答什么的问题。

---

# 12. Product Principles

## P1. Answer Less

不要太早回答。

## P2. Clarify Before Generate

先理解，再生成。

## P3. Ask the Minimum Necessary

澄清问题默认控制在：

> **2–4 个**

## P4. High Information Gain

只问会显著改变最终问题结构的条件。

## P5. Evidence Before Rewrite

先检索已有知识，再编译问题。

## P6. Explain Why

每个重大修改都必须告诉用户：

> 为什么。

## P7. Human Owns the Question

AI 可以建议、诊断、重构。

最终问题归用户决定。

---

# 13. Product Form

## 13.1 Hackathon 主产品

# Web Question Compiler

理由：

- 官方要求“可运行体验链接”为必交
- Web 可直接提供公网 Demo
- 无安装门槛
- 最适合评委 3 分钟体验
- 更容易保证完成度

---

## 13.2 Long-term Surface

# Zhihu Question Copilot

长期应出现在：

> 知乎“提问题”工作流内部。

形式可为：

- 官方内嵌能力
- 浏览器插件
- Userscript
- Web Companion

---

# 14. Information Architecture

```text
Landing
  ↓
Raw Question
  ↓
Intent Understanding
  ↓
Clarification
  ↓
Diagnostics
  ↓
Zhihu Coverage
  ↓
Knowledge Gap
  ↓
Compiled Question
  ↓
Before / After
```

---

# 15. Core User Flow

```text
┌──────────────────────┐
│ 01 Raw Question      │
│ 用户输入真实困惑      │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 02 Intent Parser     │
│ 理解真正目标          │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 03 Context Gap       │
│ 缺什么关键信息        │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 04 Clarification     │
│ 追问 2–4 个条件       │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 05 Question Lint     │
│ 结构诊断              │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 06 Zhihu Retrieval   │
│ 检索已有知识          │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 07 Coverage          │
│ 已经回答了什么        │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 08 Knowledge Gap     │
│ 还缺什么              │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 09 Compile           │
│ 编译最终问题          │
└──────────────────────┘
```

---

# 16. Functional Requirements

## F01 — Raw Intent Input
**Priority：P0**

### 用户目标

快速把真实困惑输入系统，不要求提前组织成正式问题。

### UI

标题：

> **你真正想问什么？**

副标题：

> 不需要提前组织好语言，把你的困惑告诉我们。

### 输入

MVP：

- 文本
- 粘贴已有问题

不做：

- 图片
- PDF
- 文件
- 语音

### Acceptance Criteria

- 支持 5–1000 中文字符
- 空输入不可提交
- 输入后 3 秒内进入分析状态
- 不自动生成完整答案

---

## F02 — Intent Understanding
**Priority：P0**

### 系统需要理解

- domain
- primary goal
- decision type
- time sensitivity
- ambiguous concepts
- possible hidden assumptions

### 示例

输入：

> 现在转码还有前途吗？

系统内部：

```json
{
  "domain": "career",
  "primary_goal": "evaluate_career_transition",
  "time_sensitive": true,
  "ambiguities": [
    "转码具体技术方向未知",
    "有前途的评价指标未知"
  ]
}
```

### 用户可见

> 我理解你主要想判断：
>
> - 是否值得投入时间转向软件 / AI 岗位
> - AI 是否正在改变初级开发就业机会
> - 学习投入和就业回报是否匹配

### Acceptance Criteria

- 至少抽取 1 个主要 Intent
- 最多显示 4 个用户可理解的解释
- 不展示模型内部 JSON
- 用户可选择“理解不准确”

---

## F03 — Context Gap Detection
**Priority：P0**

### 目标

判断：

> 如果现在直接把问题交给答主，还缺什么信息？

### 可识别维度

- 身份
- 当前阶段
- 专业 / 经验
- 地区
- 时间
- 预算
- 目标
- 成功标准
- 已尝试方案
- 技术环境
- 风险偏好

### Acceptance Criteria

- 只识别与当前问题真正相关的字段
- 不机械要求所有字段
- 输出字段需带“为什么重要”的理由

---

## F04 — Clarification Engine
**Priority：P0**

### 原则

默认：

> **2–4 个问题**

### 优先选择

高信息增益问题。

例如：

> 你计划什么时候开始求职？

比：

> 你平时喜欢什么？

价值更高。

### 交互形式

优先：

- 单选
- 多选
- 简短文本

避免长表单。

### Acceptance Criteria

- 默认不超过 4 问
- 用户可跳过
- 用户答案立即进入最终 Question Context
- 问题应随用户前一答案动态变化

---

## F05 — Question Linter
**Priority：P0**

### 定位

产品标志性功能。

把 Question 当作“代码”进行静态检查。

### MVP Lint Codes

| Code | Rule |
|---|---|
| W001 | Scope Too Broad |
| W002 | Intent Ambiguous |
| W003 | Missing Context |
| W004 | Missing Time Condition |
| W005 | Undefined Success Metric |
| W006 | Ambiguous Terminology |
| W007 | Hidden Assumption |
| W008 | Multiple Questions Mixed |
| W009 | Leading / Biased Framing |
| W010 | Existing Question Overlap |

### 示例

```text
⚠ W001 Scope Too Broad

“转码”可能包括：
Web / 后端 / AI应用 / 算法 / 嵌入式等方向。

不同方向的就业状态与学习成本不同。
```

### Acceptance Criteria

- 每条 Warning 包含：
  - Code
  - 问题
  - 为什么重要
  - 建议
- 最多展示 5 条核心 Warning
- 不为了“显得聪明”强行制造错误

---

## F06 — Zhihu Search
**Priority：P0**

官方知乎搜索能力返回：

- 标题
- 摘要
- 作者
- 发布时间
- 相关性分数
- 权威度等级
- 点赞数
- 评论数
- 精选评论

### 用途

- 相似问题发现
- Existing Coverage
- 重复问题判断
- 时效性判断
- 权威信息筛选

### Similar Question UI

```text
92% 相似
非科班转码还有机会吗？

84% 相似
AI 时代前端开发还值得学吗？

78% 相似
2026 年程序员是不是越来越难找工作？
```

### Acceptance Criteria

- 返回至少 3 条相关结果时展示列表
- 每条结果需可追溯来源
- 没有足够结果时明确显示“未检索到足够证据”
- 不得假装已覆盖全知乎

---

## F07 — Existing Knowledge Coverage
**Priority：P0**

### 核心问题

> 已有内容已经回答了什么？

示例：

```text
已有讨论较充分覆盖：

✓ 非科班能否入门
✓ 前端 / 后端学习路线
✓ 常见转码学习周期
✓ Java / Python 入门选择
```

### Acceptance Criteria

- 每个 Coverage 必须来自已检索内容
- 不得使用无来源的模型想象
- 最多展示 5 个核心覆盖主题

---

## F08 — Knowledge Gap Detection
**Priority：P0**

### 定位

整个产品最重要的知乎原生能力。

核心问题：

> **既然已有这么多讨论，这个新问题为什么还值得被问？**

示例：

```text
Knowledge Gap

现有讨论大多集中于：
2022–2024 年非科班转开发。

当前检索内容较少覆盖：

• 2027 届毕业生
• AI Coding 普及后的初级岗位变化
• AI 应用开发 vs 传统 Web
• 通信专业背景的技能迁移
```

### Acceptance Criteria

- Gap 必须明确来自“当前检索结果未充分覆盖”
- 不使用绝对措辞：
  - ❌ “知乎没有讨论”
  - ✅ “当前检索结果较少覆盖”
- 至少给出 1 个可以转化为 Question 的知识缺口

---

## F09 — Question Compiler
**Priority：P0**

### 输出不是单独一句标题

应该生成：

# Question Package

包含：

1. Title
2. Background
3. Goal
4. Constraints
5. Attempts / Existing Knowledge
6. Core Uncertainty
7. Expected Answer

### 示例

#### 标题

> 27 届通信工程本科生，在 AI Coding 工具普及后，如果目标是转向 AI 应用开发，相比传统前后端，就业机会和学习投入分别如何？

#### 背景

本人 27 届通信工程本科，目前没有系统的软件工程基础。

#### 目标

毕业后进入 AI 应用开发或软件相关岗位。

#### 限制

未来 6 个月，每周约可投入 15 小时。

#### 已尝试

已接触 Python 和 LLM API。

#### 核心困惑

应该优先补完整 Web 工程基础，还是直接以 RAG / Agent / AI 应用工程为主线？

#### 希望回答者重点讨论

- 2026–2027 招聘环境
- 入门岗位技能要求
- 学习顺序
- 项目深度
- 求职门槛

### Acceptance Criteria

- 不添加用户未提供且无法推断的事实
- 每一个新增条件要么来自：
  - 用户输入
  - 澄清答案
  - 明确标记为建议
- 用户可逐项编辑
- 用户可重新 Compile

---

## F10 — Before / After
**Priority：P0**

### 目的

形成 Demo 记忆点。

```text
BEFORE
现在转码还有前途吗？
```

VS

```text
AFTER
27 届通信工程本科生，在 AI Coding……
```

### Acceptance Criteria

- 同屏显示
- 高亮新增背景 / 约束 /目标
- 支持复制
- 支持返回编辑

---

## F11 — Question Quality Estimate
**Priority：P1**

### 维度

- Completeness
- Specificity
- Answerability
- Context
- Novelty
- Community Value

显示：

```text
Before  36 / 100
After   88 / 100
```

必须标注：

> AI Estimate

不能暗示为知乎官方评分。

---

## F12 — Topic Recommendation
**Priority：P1**

根据最终 Question 建议：

- 话题
- 专业领域
- 潜在答主领域标签

MVP 可以只做：

> 推荐话题标签。

---

## F13 — Zhihu Companion
**Priority：P2**

真实知乎提问页增加：

```text
✨ 问得更好
```

调用同一套后端。

流程：

```text
知乎提问题
  ↓
点击“问得更好”
  ↓
Analyze
  ↓
Clarify
  ↓
Coverage
  ↓
Compile
  ↓
应用优化版本
```

Hackathon 不作为必做项。

---

# 17. UI / UX

## 17.1 不做 ChatGPT Clone

禁止首页：

> “你好，我是 Ask Better，请问有什么能帮你？”

---

## 17.2 核心视觉隐喻

# Question IDE / Compiler

建议布局：

```text
┌────────────────────────────────────────────┐
│             问得更好 Ask Better            │
├────────────┬─────────────┬────────────────┤
│ Draft      │ Diagnostics │ Compiled       │
│            │             │ Question       │
│ 原始问题    │ 问题诊断     │ 编译结果        │
├────────────┴─────────────┴────────────────┤
│         Zhihu Knowledge Coverage          │
└────────────────────────────────────────────┘
```

---

## 17.3 五个核心 Screen

### Screen 1 — Ask

> 你真正想问什么？

### Screen 2 — Clarify

> 在继续之前，我需要知道 3 件事。

### Screen 3 — Diagnose

- Intent
- Lint
- Missing Context

### Screen 4 — Coverage

- Similar Questions
- Existing Coverage
- Knowledge Gap

### Screen 5 — Compile

- Before
- After
- Question Package

---

# 18. Official API Strategy

官方开放七类能力：

1. 知乎热榜
2. 知乎故事
3. 知乎关注流
4. 知乎搜索
5. 全网搜索
6. 知乎知识
7. 直答 Agent

本项目不需要全部使用。

---

## 18.1 核心：知乎搜索

用途：

- Similar Questions
- Existing Coverage
- Authority / Relevance Signal
- Freshness

官方限制：

> 单用户总调用量上限约 1000 次 / 天。

因此：

- 必须缓存
- 不要每次 UI 更新都重新搜索

---

## 18.2 辅助：全网搜索

只用于：

> 时间敏感型问题的背景补充。

例如：

- 招聘环境
- 新版本技术
- 政策变化

不能让全网搜索替代知乎生态。

---

## 18.3 可选：直答 Agent

用途：

- 对搜索结果做快速摘要
- Coverage 提炼
- 观点聚合

官方限制：

> 约 100 次 / 用户 / 天。

因此不作为每一步必调能力。

---

# 19. Cache Strategy

建议：

```text
Normalize Query
  ↓
Hash
  ↓
Cache Lookup
  ↓
Hit → Return
Miss → Official API
  ↓
Cache
```

MVP 可选：

- 内存缓存
- SQLite
- Redis

48 小时内优先简单可靠。

---

# 20. AI Architecture

产品逻辑上拆模块：

```text
Raw Question
   ↓
Intent Parser
   ↓
Context Gap Detector
   ↓
Clarification Engine
   ↓
Question Linter
   ↓
Zhihu Retriever
   ↓
Coverage Analyzer
   ↓
Knowledge Gap Detector
   ↓
Question Compiler
```

但是：

> 逻辑模块化 ≠ 必须部署 8 个 Agent。

Hackathon 工程上可以：

- 一个主模型
- 多 Prompt Stage
- 明确 JSON Schema
- 可观察日志

避免“为了 Multi-Agent 而 Multi-Agent”。

---

# 21. Core Data Contract

```json
{
  "raw_question": "",
  "intent": {
    "domain": "",
    "primary_goal": "",
    "decision_type": "",
    "time_sensitive": false,
    "ambiguities": []
  },
  "missing_context": [
    {
      "field": "",
      "reason": "",
      "priority": 0
    }
  ],
  "clarification_questions": [
    {
      "id": "",
      "question": "",
      "type": "single_choice",
      "options": []
    }
  ],
  "lint": [
    {
      "code": "W001",
      "severity": "warning",
      "message": "",
      "reason": "",
      "suggestion": ""
    }
  ],
  "similar_questions": [
    {
      "title": "",
      "url": "",
      "relevance": 0,
      "authority": "",
      "published_at": ""
    }
  ],
  "coverage": {
    "covered_topics": [],
    "knowledge_gaps": [],
    "evidence_quality": ""
  },
  "compiled_question": {
    "title": "",
    "background": "",
    "goal": "",
    "constraints": [],
    "attempts": [],
    "core_uncertainty": "",
    "expected_answer": []
  }
}
```

---

# 22. API Design

MVP 推荐：

```text
POST /api/analyze
POST /api/clarify
POST /api/retrieve
POST /api/compile
```

若进一步简化：

```text
POST /api/question/analyze
POST /api/question/compile
```

原则：

> 先保证链路跑通，不要过度拆微服务。

---

# 23. Reliability Rules

## 23.1 Retrieval / Inference 分离

UI 必须区分：

### Retrieved Evidence

来自知乎搜索。

### AI Inference

模型判断。

---

## 23.2 禁止绝对知识缺口声明

错误：

> “知乎没人讨论这个问题。”

正确：

> “当前检索到的相关内容中，较少覆盖以下条件……”

---

## 23.3 信息不足时明确承认

例如：

> 当前检索结果不足以可靠判断该方向是否已经被充分讨论。

---

# 24. Privacy

用户问题可能包含：

- 健康
- 收入
- 学校
- 职业
- 情感
- 身份背景

Hackathon 默认：

> 不长期保存 Raw Question。

日志建议：

- 匿名
- 不记录敏感字段
- Debug Log 可关闭

---

# 25. Success Metrics

## MVP 核心验证

### M1 — Clarification Efficiency

平均澄清问题：

> ≤ 4

### M2 — Intent Fidelity

用户是否认为：

> “系统理解了我真正想问的是什么？”

### M3 — Publish Readiness

用户是否愿意：

> 直接把编译结果用于发问？

### M4 — Gap Discovery

用户是否认为：

> 系统发现了自己原本没有意识到的关键缺失？

### M5 — Duplicate Awareness

系统是否成功提醒：

> 已经存在高度相似讨论？

---

# 26. North Star Metric

长期：

# High-quality Answer Probability

问题经过 Question Compiler 后：

> 获得高质量、相关回答的概率是否提高？

未来指标：

- 首答时间
- 有效回答数
- 回答相关性
- 题主满意度
- 收藏率
- 关注率
- 问题生命周期

Hackathon 不需要证明长期因果。

---

# 27. Judging Score Alignment

## 27.1 AI 场景价值 — 初审 40%

必须证明：

### 用户痛点真实

“提问冷启动”。

### AI 不可替代

固定表单无法针对不同 Question 动态判断：

> 哪些条件真正重要。

### 知乎价值

改善：

- Query Quality
- Retrieval Quality
- Answer Relevance
- 内容质量
- 答主理解成本

---

## 27.2 创新度 — 25%

创新不是：

> AI 帮你改问题。

而是：

- Question Lint
- Existing Coverage
- Knowledge Gap
- Evidence-based Question Compile

---

## 27.3 完成度 — 25%

必须使用：

- 真输入
- 真模型
- 真知乎搜索结果
- 真来源
- 真 Compile

禁止只有 PPT Mock。

---

## 27.4 UI / UX — 10%

核心记忆点：

> Question IDE / Compiler

不要和其他 70% 知识工具一起变成：

> 聊天框 + 卡片。

---

# 28. MVP Scope

## P0 — 必须完成

- Raw Question
- Intent Understanding
- Missing Context Detection
- 2–4 Clarification Questions
- Question Lint
- Zhihu Search
- Similar Questions
- Existing Knowledge Coverage
- Knowledge Gap
- Question Compiler
- Before / After

---

## P1 — 有时间再做

- Question Quality Estimate
- Topic Recommendation
- Diff Highlight
- Share Result
- History
- Multi-version Compile

---

## P2 — Bonus

- Zhihu Companion
- Browser Extension / Userscript
- OAuth
- 自动回填知乎问题
- 刘看山辅助动效
- 账户系统

---

# 29. Explicit Non-Goals

48 小时内坚决不做：

- 完整 AI Answer Engine
- 收藏夹知识库
- 用户长期画像
- 自建社区
- 社交匹配
- 手机 App
- Electron 客户端
- 重型知识图谱
- 多用户协同
- 重型 Agent 平台
- 完整浏览器插件体系
- 推荐系统
- 大规模历史数据爬虫

原则：

> **宁可把一个 Question 编译得极好，也不要做十个半成品功能。**

---

# 30. 48-Hour Development Plan

官方开发冲刺：

> 9 月 13 日 10:00 → 9 月 15 日 10:00

---

## 0–6h：冻结核心链路

必须完成：

- UI Wireframe
- JSON Schema
- Prompt Contract
- Mock API

最低链路：

```text
Input
→ Clarify
→ Compile
```

---

## 6–16h：核心 AI

完成：

- Intent Parser
- Context Gap
- Clarification
- Question Linter
- Web 基础页面

---

## 16–28h：知乎数据

完成：

- 官方知乎搜索接入
- Similar Questions
- Coverage
- Knowledge Gap
- Cache

---

## 28–38h：完整产品

完成：

- Final Compile
- Before / After
- Error Handling
- Loading State
- Source Traceability

---

## 38–44h：体验优化

只做：

- UI Polish
- 动效
- Mobile basic responsive
- Loading
- Empty state
- Error state

---

## 44–48h：冻结功能

只允许：

- Bug Fix
- Demo rehearse
- 部署
- 演示视频
- 计划书
- 提交材料

禁止加功能。

---

# 31. Golden Demo

官方决赛：

> 3 分钟 Demo + 2 分钟 Q&A

因此只能有一个主 Demo。

---

## Demo Input

> **现在转码还有前途吗？**

---

## Step 1 — Intent

系统：

> 我理解你主要想判断：
>
> - 是否值得转向软件 / AI 岗位
> - AI 是否正在改变初级岗位机会
> - 学习投入是否值得

---

## Step 2 — Clarify

### 你现在是什么专业？

> 通信工程

### 什么时候毕业？

> 2027 届

### “有前途”最关心什么？

> 就业机会 + 薪资

---

## Step 3 — Lint

```text
⚠ W001 Scope Too Broad
⚠ W004 Missing Time Condition
⚠ W005 Undefined Success Metric
⚠ W006 “转码”语义不明确
```

---

## Step 4 — Zhihu Search

展示真实相似问题。

---

## Step 5 — Existing Coverage

```text
已有讨论较充分覆盖：

✓ 非科班是否能转码
✓ Web 学习路线
✓ 前后端入门
✓ 转码周期
```

---

## Step 6 — Knowledge Gap

```text
当前检索内容较少覆盖：

• 2027 届毕业生
• AI Coding 普及后初级岗位变化
• AI 应用开发 vs 传统 Web
• 通信专业技能迁移
```

---

## Step 7 — Compile

最终：

> **27 届通信工程本科生，在 AI Coding 工具普及后，如果目标是转向 AI 应用开发，相比传统前后端，就业机会和学习投入分别如何？**

显示：

```text
Before 36
After  88
```

---

# 32. Demo Closing

推荐固定：

> **知乎已经积累了十五年的答案。**
>
> **AI 也正在越来越擅长回答。**
>
> **但知识生产真正的起点，始终是一个好问题。**
>
> **我们想做的，就是让人——问得更好。**

---

# 33. Submission Strategy

官方必交：

## 1. 可运行体验链接

Web：

> 公网可访问。

---

## 2. 产品说明计划书

必须清楚说明：

- 核心创作思路
- 技术方案
- 与知乎社区生态的契合度
- 场景价值

---

官方加分：

## 3. 代码仓库

建议提交 GitHub / Gitee。

## 4. 演示视频

必须准备。

即使 Demo 在线，也建议准备视频作为兜底。

---

# 34. Compliance

官方明确禁止：

- 批量爬取知乎内容
- 滥用站内用户数据
- 违规使用社区数据

因此正式方案：

> 优先使用官方 Skill + API。

参赛前期用于调研的团队公开想法数据，不进入正式产品依赖。

---

# 35. Risk Register

## R01 — 被认为只是 Prompt Wrapper

### 风险

高。

### 解决

现场必须真实展示：

```text
Zhihu Search
→ Coverage
→ Gap
→ Compile
```

---

## R02 — 和“月初星明”撞题

### 风险

高。

### 解决

明确：

```text
月初星明：
Thinking → Learning → Judgment

问得更好：
Intent → Question Quality → Knowledge System
```

---

## R03 — AI 乱判 Knowledge Gap

### 解决

Gap 只能声明：

> 当前检索结果中的覆盖不足。

必须显示 Evidence。

---

## R04 — Search API 限流

### 解决

- Cache
- Query Normalize
- Demo 预热
- Golden Demo 本地 fallback

---

## R05 — 48 小时功能过重

### 解决

严格 P0 / P1 / P2。

插件永远不是 P0。

---

# 36. Product Moat

真正壁垒不是：

- GPT
- Prompt
- “Compiler”这个名字

长期壁垒来自：

## 36.1 Question Quality Dataset

什么问题最终得到高质量回答？

## 36.2 Question–Answer Fit

哪些问题结构与答案质量相关？

## 36.3 Knowledge Coverage Graph

知乎已有知识覆盖到哪里？

## 36.4 Knowledge Gap Detection

哪些问题仍然值得被提出？

## 36.5 Ask Graph

未来形成：

```text
Existing Question
  ↓
Existing Knowledge
  ↓
Coverage Boundary
  ↓
Knowledge Gap
  ↓
Next Valuable Question
```

---

# 37. Long-term Roadmap

## V1 — Ask Better

帮一个人把当前问题问清楚。

## V2 — Question Copilot

直接进入知乎提问页。

## V3 — Question Intelligence

理解：

- 哪些问题高度重复
- 哪些问题已经充分回答
- 哪些问题因时间变化需要重新回答

## V4 — Community Knowledge Gap

帮助知乎理解：

> 整个平台下一步还有哪些值得被问的问题？

最终：

# Question Intelligence Infrastructure

---

# 38. Final Product Narrative

「问得更好」不是：

- AI 聊天机器人
- 问题润色器
- 搜索总结工具
- 学习助手

它是一层位于：

# Human Need 与 Knowledge System 之间的 Question Compiler

完整逻辑：

```text
Human Need
  ↓
Understand
  ↓
Clarify
  ↓
Lint
  ↓
Retrieve
  ↓
Compare
  ↓
Find the Gap
  ↓
Compile
  ↓
A Question Worth Answering
```

---

# 39. Final Definition

> **知乎花了十五年积累答案。**
>
> **AI 时代，我们希望把同样的智能能力放到答案之前。**
>
> **先理解用户真正想知道什么，再决定这个问题应该怎样进入知识社区。**

# 问得更好

> **不是让 AI 替人回答。**  
> **而是帮助人类，提出真正值得回答的问题。**

---

# Appendix A — MVP Lint Dictionary

| Code | Name | 中文解释 |
|---|---|---|
| W001 | Scope Too Broad | 问题范围太大 |
| W002 | Intent Ambiguous | 真实意图不明确 |
| W003 | Missing Context | 缺少必要背景 |
| W004 | Missing Time Condition | 缺少时间条件 |
| W005 | Undefined Success Metric | “好 / 有前途 / 值得”等标准未定义 |
| W006 | Ambiguous Terminology | 核心词存在歧义 |
| W007 | Hidden Assumption | 问题包含未经验证的前提 |
| W008 | Multiple Questions Mixed | 多个不同问题混在一起 |
| W009 | Leading / Biased Framing | 问题带明显诱导 |
| W010 | Existing Question Overlap | 与已有问题高度重合 |

---

# Appendix B — MVP Checklist

## 产品

- [ ] Raw Intent
- [ ] Clarification
- [ ] Linter
- [ ] Similar Questions
- [ ] Coverage
- [ ] Knowledge Gap
- [ ] Compile
- [ ] Before / After

## 数据

- [ ] 知乎官方 Search API
- [ ] Cache
- [ ] Source URL
- [ ] API fallback

## AI

- [ ] JSON Schema
- [ ] Intent Prompt
- [ ] Clarification Prompt
- [ ] Lint Prompt
- [ ] Coverage Prompt
- [ ] Compile Prompt

## UX

- [ ] Landing
- [ ] Clarify
- [ ] Diagnose
- [ ] Coverage
- [ ] Result
- [ ] Loading
- [ ] Error
- [ ] Empty

## 比赛

- [ ] 公网 Demo
- [ ] 产品说明计划书
- [ ] GitHub/Gitee
- [ ] Demo Video
- [ ] 3 min Pitch
- [ ] 2 min Q&A 准备

---

# Appendix C — Source Basis

本 PRD 的比赛规则与接口约束依据：

- 《知乎黑客松 2026｜校园新锐季 开发者手册》
- 三大官方主题赛道
- 官方交付要求
- 官方评审权重
- 官方开放 API 能力与调用限制
- 官方合规要求

竞争格局与产品差异依据：

- 当前采集到的参赛团队公开想法数据
- 对空占位、测试文本和无法判断产品方向的想法进行排除
- 对剩余想法按核心用户价值和产品行为进行人工归类

赛道占比属于**产品研究估计**，不作为官方报名统计数据使用。
