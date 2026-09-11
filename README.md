# 问得更好 · Ask Better

知乎 AI 提问编译器：把模糊需求，编译成值得回答的问题。

## 当前开发阶段

当前仓库已经进入 **Web First 前端骨架阶段**。

本检查点只包含：

- pnpm + Turborepo Monorepo 基础
- Next.js Web 客户端
- 中文优先的 Question IDE
- PC 三栏布局
- 平板两列布局
- 手机 / Android 参考用单栏步骤布局
- Mock 的问题体检、已有讨论、知识缺口与编译结果

**尚未接入**：知乎官方 API、OAuth、LLM、Redis、真实发布能力、Expo Android 客户端。

## 本地开发

```bash
corepack enable
pnpm install
pnpm dev
```

Web 默认由 `apps/web` 提供。

## 文档

- `docs/PRD.md`：Master PRD v2.0
- `docs/ARCHITECTURE.md`：总体技术架构
- `docs/FRONTEND_SPEC.md`：前端与响应式规范
- `docs/superpowers/plans/2026-09-12-frontend-foundation.md`：本阶段实现计划
