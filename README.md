# 问得更好 · Ask Better

知乎 AI 提问编译器：把模糊需求整理成更清楚、更完整、更容易获得高质量回答的问题。

> 核心定位：**Query Understanding + Intent Clarification + Question Compiler**。AI 不只回答问题，也帮助用户把问题问得更好。

## 在线体验与 Android 下载

- Web：<https://ask.wulisu.icu>
- Android Release：<https://github.com/wulisususu/sdaa/releases/tag/v0.1.0-preview>
- Android APK：<https://github.com/wulisususu/sdaa/releases/download/v0.1.0-preview/ask-better-competition-release.apk>

Android 包名：`icu.wulisu.askbetter`

当前公开 APK：`v0.1.0-preview`

SHA-256：

```text
b64dabec8c31d6f84160f7b252dbcb0afacbddf95ba27908b71f44f67ceeb021
```

> Android 版本是现有 Web 产品的轻量 WebView Shell，不在 APK 内重新实现业务 Pipeline，也不会把知乎 Access Secret、LLM API Key 或 Redis Token 打包进客户端。

## 产品流程

生产版本已经接入真实服务端 Pipeline：

1. **Analyze**：识别意图、缺失信息和 Question Lint，并生成高信息增益追问。
2. **Clarify**：补充真正会改变答案的关键条件。
3. **Retrieve / Coverage**：通过知乎开放平台检索已有讨论，并分析 Existing Coverage 与 Knowledge Gap。
4. **Diagnose**：帮助用户理解当前问题的结构、缺口与改进方向。
5. **Compile / Result**：把原问题、明确补充条件和检索上下文编译成结构化 Question Package，支持复制结果和打开知乎提问页。

Web 端保留同一套 Question Session：Input / Clarify / Diagnose / Coverage / Result 稳定状态会本地持久化；刷新、重新打开页面或 Android App 后可以恢复当前问题流程，不会创建第二套移动端 Session。

## Android 客户端

Android 客户端位于 `apps/mobile`，基于 Expo + React Native WebView，仅加载：

```text
https://ask.wulisu.icu
```

导航策略：

- 同源 `https://ask.wulisu.icu` 留在 App 内；
- 其它 `http(s)`、`mailto:`、`tel:` 交给系统外部应用；
- `javascript:`、`data:`、畸形 URL 和不支持的 scheme 会被阻止；
- `打开知乎` 会跳转到系统浏览器；
- WebView Clipboard 已通过 Android 行为验收，不需要额外 native clipboard bridge。

### 安装 APK

从 Releases 下载：

```text
ask-better-competition-release.apk
```

ADB 安装：

```bash
adb install -r ask-better-competition-release.apk
```

该 release APK 已完成 Android 35 standalone 冷启动验证，不依赖 Metro 开发服务器。

### Android 本地开发

需要：Node.js 22+、Corepack / pnpm、JDK 17、Android Studio / Android SDK、`adb`。

```bash
corepack enable
pnpm install
pnpm --filter mobile test
pnpm --filter mobile typecheck
pnpm --filter mobile android
```

生成 preview APK 可使用 EAS：

```bash
cd apps/mobile
eas build --platform android --profile preview
```

`apps/mobile/package.json` 故意不定义 `build` script，因此根目录 `pnpm build` 不会调用 Gradle，也不会要求 Android SDK。

## 公网部署

当前生产环境部署在 Linux 自托管服务器（Ubuntu 24.04）：

- Web / API：Next.js 16 + systemd，仅监听 `127.0.0.1:3100`
- 反向代理：Nginx + HTTPS
- LLM：OpenAI-compatible provider
- 检索：知乎官方开放平台 `zhihu_search`
- 可选缓存：Upstash Redis / Memory Cache fallback

生产 UI 不使用 Mock 数据作为成功回退。外部服务不可用、额度受限或只返回部分 Evidence 时，会进入明确的 `partial` / `quota_limited` / `unavailable` 状态，而不是伪造检索结果。

## 服务端集成

### LLM

服务端环境变量：

```env
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
```

### 知乎开放平台

P0 使用知乎官方搜索能力：

```text
GET /api/v1/content/zhihu_search
```

鉴权 Secret 仅保存在服务端。

### 可选 Redis

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Redis 不作为正确性依赖；缓存不可用时会降级到直接调用上游搜索。

## 安全边界

- Question Compiler 不替用户编造个人背景或约束条件；
- 用户事实只来自原始输入和用户明确补充内容；
- 不自动代用户发布知乎问题；
- 知乎 Access Secret、LLM API Key、Redis Token 只存在于服务端；
- Android 只持有公开生产 URL；
- `apps/mobile/android/` 由 Expo CNG / prebuild 生成并保持 Git ignored；
- APK 已做敏感服务端变量扫描。

## 本地开发

要求 Node.js 22+，使用 pnpm/Corepack：

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Windows PowerShell：

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

最小服务端配置：

```env
ZHIHU_API_BASE_URL=https://developer.zhihu.com
ZHIHU_ACCESS_SECRET=
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
```

不要把真实 Secret 提交到 GitHub。

## 验证

```bash
pnpm install --frozen-lockfile
pnpm --filter @ask-better/domain test
pnpm --filter @ask-better/domain typecheck
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web build
pnpm --filter mobile test
pnpm --filter mobile typecheck
pnpm build
```

当前 Android shell 最终回归：

- Web：203 tests passed
- Domain：18 tests passed
- Mobile：18 tests passed
- Web production build：passed
- Root build：Android-SDK-independent
- Android 35：完整业务流程、Session 恢复、外链、Clipboard、standalone 冷启动均通过

## 技术栈

- Next.js 16 App Router + React 19 + TypeScript
- Expo + React Native + React Native WebView
- pnpm + Turborepo
- Zod runtime contracts
- Vercel AI SDK + OpenAI-compatible provider
- 知乎开放平台 HTTP API
- Upstash Redis（可选）+ Memory Cache fallback
- Vitest

## 文档

- `docs/PRD.md`：Master PRD
- `docs/ARCHITECTURE.md`：总体技术架构
- `docs/ZHIHU_INTEGRATION.md`：知乎官方能力、鉴权、缓存与降级边界
- `docs/FRONTEND_SPEC.md`：Web UI 与响应式规范
- `docs/superpowers/plans/2026-09-14-android-webview-shell-design.md`：Android Shell 设计
- `docs/superpowers/plans/2026-09-14-android-webview-shell.md`：Android Shell 实施计划
