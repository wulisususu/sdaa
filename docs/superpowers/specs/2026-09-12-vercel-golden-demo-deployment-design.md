# Vercel Golden Demo Deployment Design

> Status: Approved direction / pre-implementation deployment freeze  
> Date: 2026-09-12  
> Scope: P0 公网部署、DeepSeek V4 Flash 真实联调、知乎官方 HTTP API、Golden Demo 验证。

## 1. 目标

把当前已经进入 `main` 的真实 Question Compiler Pipeline 部署到公网 HTTPS 地址，并用真实 DeepSeek + 知乎官方开放平台完成完整 Golden Path：

```text
输入问题
  ↓
Analyze
  ↓
2–4 个澄清问题
  ↓
Diagnose
  ↓
Zhihu Retrieve / Coverage / Knowledge Gap
  ↓
Compile
  ↓
Result / Copy / Open Zhihu Ask Page
```

本阶段完成后，比赛演示不再依赖本地环境或 Mock 数据。

## 2. 已锁定方案

### Hosting

- GitHub 仓库：`wulisususu/sdaa`
- 生产分支：`main`
- Web / API：Vercel
- Framework：Next.js App Router
- 部署方式：GitHub `main` 自动触发 Production Deployment

### LLM

- Provider：DeepSeek 官方 OpenAI-compatible API
- Base URL：`https://api.deepseek.com`
- Model：`deepseek-v4-flash`
- P0 策略：优先低延迟、稳定结构化输出，不启用额外复杂 Agent 调度
- Secret：只进入 Vercel Environment Variables / 本地 `.env.local`

当前聊天中曾暴露过一把 DeepSeek API Key。该 Key 不作为最终公网生产凭据。上线前必须在 DeepSeek 控制台重新生成生产 Key，并只写入部署平台 Secret Store。

### Zhihu

- 仅调用知乎官方开放平台 HTTP API
- 当前 P0 使用 `zhihu_search`
- `ZHIHU_ACCESS_SECRET` 仅存在服务端
- 浏览器不得直接请求知乎开放平台
- 不使用爬虫或非官方 Cookie 接口作为正式链路

### Cache

- P0 不强制 Upstash Redis
- 未配置 Upstash 时使用现有进程内 Memory Cache
- 如果公网联调发现额度保护不足，再开启 Upstash
- Cache 只影响额度和性能，不影响正确性

## 3. 公网运行拓扑

```text
Browser
   │
   ▼
Vercel Production
┌──────────────────────────────┐
│ Next.js Web                  │
│                              │
│ /api/question/analyze        │
│ /api/question/retrieve       │
│ /api/question/compile        │
└─────────────┬────────────────┘
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
 DeepSeek   Zhihu    Cache
  API       API     Memory/Upstash
```

所有外部 Secret 只存在于 Vercel 服务端运行环境。

## 4. 环境变量

### P0 必需

```env
ZHIHU_API_BASE_URL=https://developer.zhihu.com
ZHIHU_ACCESS_SECRET=<server-only>

LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=<server-only>
LLM_MODEL=deepseek-v4-flash
```

### P0 可选

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### 本阶段不启用

```env
ZHIHU_OAUTH_APP_ID=
ZHIHU_OAUTH_APP_KEY=
ZHIHU_OAUTH_REDIRECT_URI=
```

OAuth 不作为比赛 Golden Path 的依赖。

## 5. DeepSeek 兼容性策略

现有代码通过统一 `generateStructured()` 接口调用 OpenAI-compatible Provider。部署前不预设 SDK 与 `deepseek-v4-flash` 的所有扩展参数都天然兼容，而是先做真实 Smoke Test。

兼容性顺序：

1. 首先复用当前 `@ai-sdk/openai-compatible` + `Output.object()` 实现。
2. 用真实 DeepSeek Key 验证 Analyze 的结构化输出。
3. 如果当前兼容层能稳定生成并通过 Zod 校验，则保持现有 Provider，不增加 DeepSeek 专有代码。
4. 如果 DeepSeek 对当前结构化输出路径不兼容，则仅在 `lib/ai` 内增加 DeepSeek-specific Adapter，继续暴露同一个 `generateStructured()` 接口。
5. 上层 Analyze / Retrieve / Compile Service 和前端 Contract 不随 Provider 变化。

原则：优先保持 Provider 无厂商绑定；只有真实兼容性测试失败时才引入厂商特化。

## 6. Golden Demo 联调问题

公网真实联调至少验证三类问题，避免只对单一示例过拟合。

### Case A：宽泛职业问题

```text
现在转码还有前途吗？
```

预期重点：

- Analyze 能识别范围过宽
- Clarify 能生成 2–4 个高信息增益问题
- Retrieve 能生成合理搜索词
- Coverage / Gap 不夸大“知乎没有讨论”
- Compile 能生成一个条件更明确的问题

### Case B：决策问题

```text
考研还是直接就业？
```

预期重点：

- 不凭空补用户学历、专业、城市或家庭条件
- 澄清问题围绕目标、风险承受、行业方向等真实决策变量
- 最终问题只使用用户明确给出的事实

### Case C：学习路径问题

```text
AI 应用开发应该怎么学？
```

预期重点：

- Zhihu Evidence 可真实点击
- Coverage 与 Knowledge Gap 有证据边界
- Compile 不是简单改写标题，而是形成可回答的 Question Package

## 7. 真实环境成功标准

P0 上线必须同时满足：

1. 公网 HTTPS 页面可访问。
2. 首页不需要登录即可使用。
3. Analyze 能真实调用 `deepseek-v4-flash`。
4. Retrieve 能真实调用知乎官方 `zhihu_search`。
5. Evidence URL 可打开真实知乎来源。
6. Coverage / Gap 只基于本次 Evidence。
7. Compile 能生成通过共享 Zod Contract 的 Question Package。
8. 修改澄清答案后，旧 Retrieval / Compile 结果失效。
9. DeepSeek、知乎或缓存任一外部依赖异常时，不回退到 Mock 成功数据。
10. 浏览器源码与网络响应中不包含 DeepSeek Key、Zhihu Access Secret 或 Redis Token。
11. `main` CI 保持绿色。
12. Golden Demo 至少连续完成 3 次完整流程，不出现不可恢复错误。

## 8. 错误与降级

### DeepSeek 未配置

- `/analyze` 返回安全的 `AI_NOT_CONFIGURED`
- UI 显示中文错误
- 不泄露环境变量名对应的真实值

### DeepSeek 超时 / 非法结构

- 使用现有 `AI_TIMEOUT` / `AI_INVALID_OUTPUT`
- 保留用户输入
- 用户可以重试当前步骤

### Zhihu 未配置 / 鉴权失败

- Retrieve 不伪造知乎内容
- 返回明确 unavailable 状态或安全错误
- 如果已有真实 Evidence，则保留已拿到的 Evidence

### Zhihu 限流

- 保留限流前已经得到的 Evidence
- 状态保持 `quota_limited`
- 不无限重试

### Redis 未配置 / 故障

- 使用 Memory Cache 或直接搜索
- 不让缓存故障阻断主链路

## 9. Secret 管理

禁止把真实 Secret 放入：

- GitHub commits
- `.env.example`
- README
- 浏览器 Bundle
- Android APK
- Console Log
- Vercel Build Log
- Demo 视频画面

本地只允许 `.env.local`；公网只允许 Vercel Environment Variables。

生产 DeepSeek Key 使用新的、未在聊天或其他公开位置出现过的 Key。

## 10. Vercel 项目设置

建议设置：

```text
Framework Preset: Next.js
Production Branch: main
Root Directory: apps/web
Install Command: pnpm install --no-frozen-lockfile
Build Command: pnpm --filter web build
```

如果 Vercel 从 Monorepo 根目录自动识别 workspace，则优先保留默认 Build 逻辑；只有自动识别失败时才显式覆盖 Install / Build Command。

部署过程中不把 Secret 写入 `vercel.json`。

## 11. CI 与生产部署边界

GitHub Actions CI：

```text
install
→ domain test
→ domain typecheck
→ web test
→ web typecheck
→ web build
```

CI 不使用真实 DeepSeek / Zhihu Secret，不消费真实 API 额度。

Vercel Production Deployment 才读取真实 Environment Variables。

因此：

- CI 证明代码结构和测试通过
- Production Smoke Test 证明真实外部服务可用

二者不能互相替代。

## 12. 部署验证顺序

正式上线按下面顺序，避免同时调多个变量：

```text
1. Vercel 无 Secret 构建成功
2. 配置 DeepSeek 生产 Key
3. 只验证 /analyze
4. 配置 Zhihu Access Secret
5. 验证 /retrieve
6. 验证 /compile
7. 完整浏览器 Golden Path
8. 检查 Secret 泄漏
9. 连续跑 3 组 Demo Case
10. 再决定是否增加 Upstash
```

如果某一步失败，只修当前层，不同时更改 LLM、知乎和 UI。

## 13. 本阶段明确不做

- OAuth 登录
- 知乎用户画像 / 收藏 / 关注数据
- 自动发布知乎问题
- Android Expo 客户端
- 自定义域名
- 重型数据库
- 多模型路由
- 多 Agent Orchestrator
- 强制 Upstash Redis
- 最终视觉模板替换

这些都不能阻塞公网 P0 Golden Demo。

## 14. 后续阶段

公网 Golden Demo 稳定后再按优先级推进：

1. UI 模板与视觉美化
2. Upstash 持久缓存 / quota 可视化
3. OAuth P1
4. Expo Android P2
5. Demo 视频与比赛提交材料

本阶段完成标准不是“代码已经写完”，而是“真实公网用户能连续完成核心 Question Compiler 流程”。
