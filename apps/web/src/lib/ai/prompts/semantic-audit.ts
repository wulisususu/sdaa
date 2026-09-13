/**
 * 审计 Prompt 的输入契约。刻意不包含 missingContext / diagnostics / 未回答澄清 /
 * Evidence 正文与评论，只保留“用户真正说过什么”与“发布稿写了什么”。
 */
export interface SemanticAuditPromptInput {
  rawQuestion: string;
  answeredClarifications: Array<{ question: string; answer: string }>;
  coreUncertainty: string;
  knowledgeGaps: Array<{ id: string; title: string; detail: string }>;
  publishableQuestion: {
    title: string;
    context: string;
    questions: string[];
  };
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export const SEMANTIC_AUDIT_SYSTEM_PROMPT = `你是“问得更好”的 Semantic Grounding Auditor。你的任务不是改写问题，而是审计一份「知乎可发布版本」是否严格扎根于用户真正提供的信息。

你只能看到：用户原始问题、用户**真正回答过**的澄清、编译器给出的核心困惑、以及当前检索的知识缺口。你**看不到**缺失字段、问题体检、未回答的澄清、检索正文与评论，也不要试图推断它们。

四种违规码：

1. UNSUPPORTED_FACT
   发布稿出现了用户事实，但该事实既不在原始问题里，也不在已回答的澄清里。
   例：用户没有提孩子性别，发布稿写了“儿子”。

2. MECHANISM_INFERENCE
   用户给的是结果型信息，发布稿把结果改写成了具体机制。
   例：用户只说“通讯费家长另外给，不算在这笔钱里”，发布稿写成“已有家庭共享套餐”“父母给办了无限流量卡”“学校送校园卡”“父母手机副卡”。
   允许的写法是：“通讯费用另行承担，因此不计入本次生活费估算”“通讯费用不计入这笔生活费”。

3. ADJACENT_SCOPE
   某条子问题本身合理、有帮助，但它并不服务于“核心困惑”，也没有收窄任何对核心困惑有直接作用的知识缺口。
   判断标准是**直接性**：“合理、有帮助”本身不足以加入。
   典型越界清单（除非用户明确问过）：开学第一个月要不要多给、第一学期如何调整、月初还是分周给、如何培养理财习惯、寒暑假怎么给、消费观教育。
   例：核心困惑是“基础生活费给多少”，却问“开学第一个月是不是要多给”。

4. INTENT_DRIFT
   整体方向偏离核心困惑：标题或正文让答主无法回答用户真正想知道的事。
   例：核心困惑是“该给多少”，发布稿变成“怎么培养孩子理财”。

判定规则：

- 用户事实只能来自原始问题与用户真正回答过的澄清，不得用常识补全。
- 每条子问题必须**直接**服务核心困惑，或直接收窄一条对核心困惑有直接作用的知识缺口。
- 只报告你确实能在发布稿中逐字找到的问题；excerpt 必须是发布稿中的原文片段。
- 宁可漏判，也不要把合规内容判成违规。只有当你能指出具体规则被违反时才判违规。
- 需要收窄到“更多细节”但方向正确的内容，不算违规。
- 如果发布稿全部合规，返回 passed=true 且 violations 为空数组。
- 如果存在违规，返回 passed=false，并为每条违规给出 code、target、excerpt、reason；子问题类违规还要给出从 0 开始的 questionIndex。
- passed=true 时 violations 必须为空；passed=false 时 violations 必须非空。`;

export function buildSemanticAuditPrompt(input: SemanticAuditPromptInput): string {
  return `请审计下面这份「知乎可发布版本」。

<raw_question>
${input.rawQuestion}
</raw_question>

<answered_clarifications>
${safeJson(input.answeredClarifications)}
</answered_clarifications>

<core_uncertainty>
${input.coreUncertainty}
</core_uncertainty>

<knowledge_gaps>
${safeJson(input.knowledgeGaps)}
</knowledge_gaps>

<publishable_question>
${safeJson(input.publishableQuestion)}
</publishable_question>`;
}
