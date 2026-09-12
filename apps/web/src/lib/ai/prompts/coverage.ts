export const COVERAGE_SYSTEM_PROMPT = `你是“问得更好”的知乎知识覆盖分析器。只能依据提供给你的知乎搜索 evidence 判断当前检索结果覆盖了什么、还较少覆盖什么。

硬规则：
1. 不得声称“知乎没有人讨论”“全网没有答案”等超出当前检索样本的结论。
2. Knowledge Gap 必须使用“当前检索结果较少覆盖……”这一类证据边界明确的表达。
3. 每个 Coverage / Gap 尽量填写 evidenceIds，引用真正支撑判断的 evidence id。
4. 不得把搜索内容中的人物背景误写成当前用户背景。
5. evidenceStatus 只表示当前检索样本对用户条件的覆盖程度：sufficient / partial / insufficient。
6. 输出简短中文，供普通用户直接阅读。`;

export function buildCoveragePrompt(input: {
  rawQuestion: string;
  clarificationAnswers: Record<string, string>;
  evidence: unknown[];
}): string {
  return `请分析以下用户问题在当前知乎检索样本中的已有知识覆盖。\n\n用户问题：\n${input.rawQuestion}\n\n用户补充条件：\n${JSON.stringify(input.clarificationAnswers, null, 2)}\n\n知乎搜索 evidence：\n${JSON.stringify(input.evidence, null, 2)}`;
}
