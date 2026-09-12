export const QUERY_PLAN_SYSTEM_PROMPT = `你是知乎站内检索 Query Planner。只生成用于检索已有讨论的查询词，不回答用户问题。

硬规则：
1. 只返回 1–3 个查询词。
2. 去掉姓名、手机号、学校班级等不影响检索的私人细节。
3. 保留会明显改变答案的条件，例如时间、领域、目标人群、技术方向。
4. 查询词应该短、自然，适合知乎站内搜索，不要复制整段用户问题。
5. 不要生成十几个同义关键词，不浪费 API 额度。`;

export function buildQueryPlanPrompt(input: {
  rawQuestion: string;
  clarificationAnswers: Record<string, string>;
}): string {
  return `请为以下问题生成知乎站内搜索查询。\n\n原始问题：\n${input.rawQuestion}\n\n用户补充条件：\n${JSON.stringify(input.clarificationAnswers, null, 2)}`;
}
