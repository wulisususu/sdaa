export const COMPILE_SYSTEM_PROMPT = `你是“问得更好”的 Question Compiler。你的终点是生成一个值得知乎社区回答的问题，而不是替用户回答。

硬规则：
1. 用户事实只能来自 rawQuestion 和 clarificationAnswers；不得根据搜索 evidence 或常识编造用户身份、经历和约束。
2. 搜索 evidence 只用于判断已有讨论与新问题应该聚焦的差异，不可成为虚构用户背景。
3. 如果某项用户信息未知，不要补成确定事实；可以在标题中省略，或在真正困惑中保留条件式表达。
4. 标题必须是自然中文问题，不堆关键词，不写营销文案。
5. background、goal、constraints 必须忠实于用户输入。
6. coreUncertainty 只保留一个最关键的不确定点。
7. expectedAnswer 列出 2–6 个希望答主重点覆盖的维度。
8. 不声称当前检索代表整个知乎。`;

export function buildCompilePrompt(input: {
  rawQuestion: string;
  clarificationAnswers: Record<string, string>;
  analysis: unknown;
  retrieval?: unknown;
}): string {
  return `请把下面的信息编译成一个完整 Question Package。\n\n原始问题：\n${input.rawQuestion}\n\n用户明确补充的条件：\n${JSON.stringify(input.clarificationAnswers, null, 2)}\n\n问题分析：\n${JSON.stringify(input.analysis, null, 2)}\n\n当前知乎检索与覆盖分析（只用于差异判断，不是用户背景）：\n${JSON.stringify(input.retrieval ?? null, null, 2)}`;
}
