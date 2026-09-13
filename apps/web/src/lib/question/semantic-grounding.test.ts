import { describe, expect, test } from "vitest";
import type { StructuredGenerator } from "./analyze-service";
import { auditSemanticGrounding, type SemanticAuditInput, type SemanticAuditResult } from "./semantic-grounding";

const auditInput: SemanticAuditInput = {
  rawQuestion: "孩子大一，在新一线或二线城市上学，只算吃饭、交通、通讯和日用品，每月生活费给多少合适？",
  answeredClarifications: [{ question: "通讯费怎么算？", answer: "通讯费家长另外给，不算在这笔钱里" }],
  coreUncertainty: "只算吃饭、交通、通讯和日用品时，新一线城市大一学生每月基础生活费应定为多少。",
  knowledgeGaps: [
    { id: "gap-1", title: "四项拆分", detail: "当前检索结果较少覆盖四项各自的月度水平。" }
  ],
  publishableQuestion: {
    title: "新一线城市大一学生每月基础生活费给多少合适？",
    context: "孩子今年读大一，学校在新一线城市。通讯费用另行承担，不计入这笔生活费。",
    questions: ["吃饭、交通、通讯、日用品四项合计每月大概在什么区间？"]
  }
};

const passResult: SemanticAuditResult = { passed: true, violations: [] };

const mechanismFailure: SemanticAuditResult = {
  passed: false,
  violations: [
    {
      code: "MECHANISM_INFERENCE",
      target: "context",
      excerpt: "通讯已有家庭共享套餐",
      reason: "用户只说明通讯费另付，没有提供家庭共享套餐这一机制。"
    }
  ]
};

const adjacentScopeFailure: SemanticAuditResult = {
  passed: false,
  violations: [
    {
      code: "ADJACENT_SCOPE",
      target: "question",
      questionIndex: 2,
      excerpt: "开学第一个月是不是要多给",
      reason: "用户只问基础生活费金额，首月加钱属于相邻但未被询问的话题。"
    }
  ]
};

describe("semantic grounding audit", () => {
  test("accepts a well-formed pass", async () => {
    const fake = (async () => passResult) as StructuredGenerator;
    const result = await auditSemanticGrounding(auditInput, { generateStructured: fake });
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test("accepts a well-formed failure and preserves the violation payload", async () => {
    const mechanismInput: SemanticAuditInput = {
      ...auditInput,
      publishableQuestion: {
        ...auditInput.publishableQuestion,
        context: "孩子今年读大一，通讯已有家庭共享套餐，所以不计入这笔生活费。"
      }
    };
    const fake = (async () => mechanismFailure) as StructuredGenerator;
    const result = await auditSemanticGrounding(mechanismInput, { generateStructured: fake });
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      code: "MECHANISM_INFERENCE",
      target: "context",
      excerpt: "通讯已有家庭共享套餐"
    });
  });

  test("carries the question index for a per-question scope violation", async () => {
    const adjacentInput: SemanticAuditInput = {
      ...auditInput,
      publishableQuestion: {
        ...auditInput.publishableQuestion,
        questions: [
          "吃饭、交通、通讯、日用品四项合计每月大概在什么区间？",
          "各项基础开销分别大概是多少？",
          "开学第一个月是不是要多给？"
        ]
      }
    };
    const fake = (async () => adjacentScopeFailure) as StructuredGenerator;
    const result = await auditSemanticGrounding(adjacentInput, { generateStructured: fake });
    expect(result.violations[0]).toMatchObject({ code: "ADJACENT_SCOPE", target: "question", questionIndex: 2 });
  });

  test("only receives the grounded surface, never compiler-internal context", async () => {
    let seenPrompt = "";
    const fake = (async (_schema: unknown, _system: string, prompt: string) => {
      seenPrompt = prompt;
      return passResult;
    }) as unknown as StructuredGenerator;

    const poisoned = {
      ...auditInput,
      missingContext: [{ field: "missing-context-marker" }],
      diagnostics: [{ summary: "diagnostic-marker" }],
      clarificationQuestions: [{ id: "unanswered-clarification-marker" }],
      retrievalEvidence: [{ summary: "evidence-summary-marker", author: "author-marker" }],
      selectedComments: ["comment-marker"]
    } as unknown as SemanticAuditInput;

    await auditSemanticGrounding(poisoned, { generateStructured: fake });

    expect(seenPrompt).toContain(auditInput.rawQuestion);
    expect(seenPrompt).toContain("通讯费怎么算？");
    expect(seenPrompt).toContain("通讯费家长另外给，不算在这笔钱里");
    expect(seenPrompt).toContain(auditInput.coreUncertainty);
    expect(seenPrompt).toContain("四项拆分");
    expect(seenPrompt).toContain(auditInput.publishableQuestion.title);
    expect(seenPrompt).toContain(auditInput.publishableQuestion.questions[0]);

    expect(seenPrompt).not.toContain("missing-context-marker");
    expect(seenPrompt).not.toContain("diagnostic-marker");
    expect(seenPrompt).not.toContain("unanswered-clarification-marker");
    expect(seenPrompt).not.toContain("evidence-summary-marker");
    expect(seenPrompt).not.toContain("author-marker");
    expect(seenPrompt).not.toContain("comment-marker");
  });

  test("instructs the auditor about mechanism inference and adjacent scope", async () => {
    let seenSystem = "";
    const fake = (async (_schema: unknown, system: string) => {
      seenSystem = system;
      return passResult;
    }) as unknown as StructuredGenerator;

    await auditSemanticGrounding(auditInput, { generateStructured: fake });

    for (const code of ["UNSUPPORTED_FACT", "MECHANISM_INFERENCE", "ADJACENT_SCOPE", "INTENT_DRIFT"]) {
      expect(seenSystem).toContain(code);
    }
    expect(seenSystem).toContain("家庭共享套餐");
    expect(seenSystem).toContain("开学第一个月");
  });

  test("rejects passed=true that still lists violations as malformed", async () => {
    const fake = (async () => ({ passed: true, violations: mechanismFailure.violations })) as StructuredGenerator;
    await expect(auditSemanticGrounding(auditInput, { generateStructured: fake })).rejects.toMatchObject({
      code: "COMPILE_FAILED",
      retryable: true
    });
  });

  test("rejects passed=false without any violation as malformed", async () => {
    const fake = (async () => ({ passed: false, violations: [] })) as StructuredGenerator;
    await expect(auditSemanticGrounding(auditInput, { generateStructured: fake })).rejects.toMatchObject({
      code: "COMPILE_FAILED",
      retryable: true
    });
  });

  test("rejects an unknown violation code instead of silently passing it through", async () => {
    const fake = (async () => ({
      passed: false,
      violations: [{ code: "SOMETHING_ELSE", target: "title", excerpt: "x", reason: "y" }]
    })) as StructuredGenerator;
    await expect(auditSemanticGrounding(auditInput, { generateStructured: fake })).rejects.toMatchObject({
      code: "COMPILE_FAILED",
      retryable: true
    });
  });

  test("maps a provider invalid-output failure to a safe COMPILE_FAILED", async () => {
    const fake = (async () => {
      const error = new Error("schema mismatch");
      Object.assign(error, { name: "LLMProviderError", code: "AI_INVALID_OUTPUT", retryable: true });
      throw error;
    }) as unknown as StructuredGenerator;

    await expect(auditSemanticGrounding(auditInput, { generateStructured: fake })).rejects.toMatchObject({
      code: "COMPILE_FAILED"
    });
  });
});
