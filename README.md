# 问得更好 · Ask Better

知乎 AI 提问编译器：把模糊需求，整理成值得回答的问题。

## 当前开发阶段

当前仓库已经完成 **Web First 前端交互流程检查点**。

已经可点击体验完整 Mock 流程：

1. 输入问题
2. 补充关键信息
3. 问题体检
4. 查看已有讨论与知识缺口
5. 查看编译结果
6. 复制完整 Question Package
7. 重新优化 / 新建问题 / 打开知乎提问页

同时包含：

- pnpm + Turborepo Monorepo
- Next.js Web 客户端
- `packages/domain` 共享状态、流程规则和问题格式化逻辑
- 中文优先、英文弱化的界面文案
- Desktop / Tablet / Mobile 响应式布局
- 移动 Web 作为后续 Expo Android 客户端的信息架构参考
- 已访问步骤可回退，未完成步骤不可越级
- 补充信息选择可在回退后保留
- GitHub Actions 自动运行 Domain Test + Web Build

> 当前分析、体检、知乎已有讨论和最终编译内容仍使用演示 Mock 数据。页面已经是真实交互，但尚未调用真实 AI 和知乎数据。

## 下一阶段集成边界

下一阶段将把 Mock 数据逐步替换为：

- AI：Intent Understanding / Missing Context / Clarification / Question Lint / Compile
- 知乎官方能力：Search → Similar Questions → Existing Coverage → Knowledge Gap
- Cache：避免重复调用知乎官方接口
- OAuth：作为 P1，不阻塞游客主流程

当前不依赖“直接代用户发布知乎问题”。结果页仅提供复制和打开知乎提问页，最终发布由用户确认。

## 本地开发

```bash
corepack enable
pnpm install
pnpm dev
```

单独验证：

```bash
pnpm --filter @ask-better/domain test
pnpm --filter web build
```

Web 客户端位于 `apps/web`。

## 文档

- `docs/PRD.md`：Master PRD v2.0
- `docs/ARCHITECTURE.md`：总体技术架构
- `docs/FRONTEND_SPEC.md`：前端与响应式规范
- `docs/superpowers/plans/2026-09-12-frontend-foundation.md`：前端骨架计划
- `docs/superpowers/plans/2026-09-12-interactive-frontend-flow.md`：本阶段完整交互计划
