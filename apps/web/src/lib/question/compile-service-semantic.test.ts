import { describe, expect, test } from "vitest";
import type { CompileRequest, QuestionAnalysis, RetrieveResult } from "@ask-better/domain";
import type { StructuredGenerator } from "./analyze-service";
import { compileQuestion } from "./compile-service";
import type { SemanticAuditInput, SemanticAuditResult } from "./semantic-grounding";

const analysis: QuestionAnalysis = {
  intent: ["生活费用规划"],
  primaryGoal: "确定每月基础生活费金额",
  timeSensitive: false,
  ambiguities: [],
  missingContext: [],
  clarificationQuestions: [
    { id: "city", question: "学校在哪个城市？", options: ["新一线城市", "二线城市"] },
    { id: "comm", question: "通讯费怎么算？", options: ["家长另外给", "含在这笔钱里"] }
  ],
  diagnostics: []
};

const retrieval: RetrieveResult = {
  status: "success",
  evidenceStatus: "partial",
  queries: ["大一 生活费 标准"],
  evidence: [],
  existingCoverage: [],
  knowledgeGaps: [
    { id: "gap-1", title: "四项拆分", detail: "当前检索结果较少覆盖四项各自的月度水平。" }
  ]
};

const input: CompileRequest = {
  rawQuestion: "孩子大一，在新一线或二线城市上学，只算吃饭、交通、通讯和日用品，每月生活费给多少合适？",
  analysis,
  clarificationAnswers: { city: "新一线城市", comm: "家长另外给，不算在这笔钱里" },
  retrieval
};

function artifact(overrides: { context?: string; questions?: string[]; title?: string } = {}) {
  return {
    compiledQuestion: {
      title: "新一线城市大一学生四项基础生活费标准",
      background: "孩子大一，在新一线城市上学。",
      goal: "确定只覆盖四项的月度基础生活费。",
      constraints: ["只覆盖吃饭、交通、通讯、日用品"],
      coreUncertainty: "只算四项时，新一线城市大一学生每月基础生活费应定为多少。",
      expectedAnswer: ["四项合计金额区间", "四项各自的大致水平"]
    },
    publishableQuestion: {
      title: overrides.title ?? "新一线城市大一学生，只算四项，每月生活费给多少合适？",
      context: overrides.context ?? "孩子今年读大一，学校在新一线城市。通讯费用另行承担，不计入这笔生活费。",
      questions: overrides.questions ?? [
        "四项合计每月大概在什么区间比较合适？",
        "吃饭、交通、日用品分别大概按多少估算？"
      ]
    }
  };
}

const passAudit: SemanticAuditResult = { passed: true, violations: [] };

function failingAudit(code: "MECHANISM_INFERENCE" | "ADJACENT_SCOPE", excerpt: string): SemanticAuditResult {
  return {
    passed: false,
    violations: [{ code, target: "question", questionIndex: 0, excerpt, reason: `审计命中 ${code}` }]
  };
}

describe("compileQuestion semantic grounding flow", () => {
  test("runs deterministic guard and semantic audit on the happy path", async () => {
    const compileCalls: string[] = [];
    const auditCalls: SemanticAuditInput[] = [];

    const fakeGenerate = (async (_schema: unknown, _system: string, prompt: string) => {
      compileCalls.push(prompt);
      return artifact();
    }) as unknown as StructuredGenerator;

    const result = await compileQuestion(input, {
      generateStructured: fakeGenerate,
      auditSemanticGrounding: async (auditInput) => {
        auditCalls.push(auditInput);
        return passAudit;
      }
    });

    expect(compileCalls).toHaveLength(1);
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0].rawQuestion).toBe(input.rawQuestion);
    expect(auditCalls[0].coreUncertainty).toContain("基础生活费");
    expect(result.publishableQuestion.questions).toHaveLength(2);
  });

  test("repairs once when the semantic audit fails, then returns the repaired artifact", async () => {
    let compileCall = 0;
    let auditCall = 0;
    let repairPrompt = "";

    const fakeGenerate = (async (_schema: unknown, _system: string, prompt: string) => {
      compileCall += 1;
      if (compileCall === 1) {
        return artifact({ context: "通讯已有家庭共享套餐，所以不计入这笔生活费。" });
      }
      repairPrompt = prompt;
      return artifact();
    }) as unknown as StructuredGenerator;

    const result = await compileQuestion(input, {
      generateStructured: fakeGenerate,
      auditSemanticGrounding: async () => {
        auditCall += 1;
        return auditCall === 1 ? {
          passed: false,
          violations: [{
            code: "MECHANISM_INFERENCE",
            target: "context",
            excerpt: "通讯已有家庭共享套餐",
            reason: "用户只说明通讯费另付，没有提供该机制。"
          }]
        } : passAudit;
      }
    });

    expect(compileCall).toBe(2);
    expect(auditCall).toBe(2);
    expect(repairPrompt).toContain("MECHANISM_INFERENCE");
    expect(result.publishableQuestion.context).not.toContain("家庭共享套餐");
  });

  test("fails safely when the re-audited artifact still violates semantic grounding", async () => {
    const bad = artifact({ context: "通讯已有家庭共享套餐，所以不计入这笔生活费。" });
    const fakeGenerate = (async () => bad) as unknown as StructuredGenerator;

    await expect(
      compileQuestion(input, {
        generateStructured: fakeGenerate,
        auditSemanticGrounding: async () => ({
          passed: false,
          violations: [{
            code: "MECHANISM_INFERENCE",
            target: "context",
            excerpt: "通讯已有家庭共享套餐",
            reason: "用户只说明通讯费另付，没有提供该机制。"
          }]
        })
      })
    ).rejects.toMatchObject({ code: "COMPILE_FAILED", retryable: true });
  });

  test("never exceeds four LLM calls and never loops on repeated failure", async () => {
    let llmCalls = 0;
    const bad = artifact({ questions: ["开学第一个月是不是要多给？"] });
    const fakeGenerate = (async () => {
      llmCalls += 1;
      return bad;
    }) as unknown as StructuredGenerator;

    await expect(
      compileQuestion(input, {
        generateStructured: fakeGenerate,
        auditSemanticGrounding: async () => {
          llmCalls += 1;
          return {
            passed: false,
            violations: [{
              code: "ADJACENT_SCOPE",
              target: "question",
              questionIndex: 0,
              excerpt: "开学第一个月是不是要多给？",
              reason: "该子问题不直接服务基础生活费金额。"
            }]
          };
        }
      })
    ).rejects.toMatchObject({ code: "COMPILE_FAILED" });

    expect(llmCalls).toBeLessThanOrEqual(4);
  });

  test("still audits the first artifact when the deterministic guard already failed", async () => {
    let generateCalls = 0;
    let auditCalls = 0;

    const fakeGenerate = (async (_schema: unknown, _system: string, prompt: string) => {
      generateCalls += 1;
      if (prompt.includes("未通过发布质量检查")) {
        return artifact();
      }
      return artifact({ context: "用户未提供更多个人背景，通讯费用另行承担，不计入这笔生活费。" });
    }) as unknown as StructuredGenerator;

    const result = await compileQuestion(input, {
      generateStructured: fakeGenerate,
      auditSemanticGrounding: async () => {
        auditCalls += 1;
        return passAudit;
      }
    });

    expect(generateCalls).toBe(2);
    expect(auditCalls).toBe(2);
    expect(result.publishableQuestion.context).not.toContain("用户未提供");
  });

  test("still blocks numeric drift introduced by the compiler", async () => {
    const numericInput: CompileRequest = {
      ...input,
      rawQuestion: "每天最多 3 小时，AI 应用开发应该怎么学？",
      clarificationAnswers: { city: "新一线城市" },
      retrieval: { ...retrieval, knowledgeGaps: [] }
    };

    let generateCalls = 0;
    const fakeGenerate = (async (_schema: unknown, _system: string, prompt: string) => {
      generateCalls += 1;
      if (prompt.includes("未通过发布质量检查")) {
        return {
          ...artifact(),
          compiledQuestion: { ...artifact().compiledQuestion, constraints: ["每天最多3小时"] },
          publishableQuestion: {
            ...artifact().publishableQuestion,
            context: "每天最多 3 小时，通讯费用另行承担，不计入这笔生活费。"
          }
        };
      }
      return {
        ...artifact(),
        compiledQuestion: { ...artifact().compiledQuestion, constraints: ["每天最多5小时"] },
        publishableQuestion: {
          ...artifact().publishableQuestion,
          context: "每天最多 5 小时，通讯费用另行承担，不计入这笔生活费。"
        }
      };
    }) as unknown as StructuredGenerator;

    const result = await compileQuestion(numericInput, {
      generateStructured: fakeGenerate,
      auditSemanticGrounding: async () => passAudit
    });

    expect(generateCalls).toBe(2);
    expect(JSON.stringify(result)).not.toContain("5 小时");
    expect(JSON.stringify(result)).not.toContain("5小时");
  });

  test("still fails safely when the repaired artifact keeps drifting numbers", async () => {
    const numericInput: CompileRequest = {
      ...input,
      rawQuestion: "每天最多 3 小时，AI 应用开发应该怎么学？",
      clarificationAnswers: { city: "新一线城市" },
      retrieval: { ...retrieval, knowledgeGaps: [] }
    };

    const fakeGenerate = (async () => ({
      ...artifact(),
      compiledQuestion: { ...artifact().compiledQuestion, constraints: ["每天最多5小时"] },
      publishableQuestion: {
        ...artifact().publishableQuestion,
        context: "每天最多 5 小时，通讯费用另行承担，不计入这笔生活费。"
      }
    })) as unknown as StructuredGenerator;

    await expect(
      compileQuestion(numericInput, {
        generateStructured: fakeGenerate,
        auditSemanticGrounding: async () => passAudit
      })
    ).rejects.toMatchObject({ code: "COMPILE_FAILED" });
  });

  test("propagates a malformed audit as a safe COMPILE_FAILED", async () => {
    const fakeGenerate = (async () => artifact()) as unknown as StructuredGenerator;

    await expect(
      compileQuestion(input, {
        generateStructured: fakeGenerate,
        auditSemanticGrounding: async () => {
          throw Object.assign(new Error("audit malformed"), {
            name: "LLMProviderError",
            code: "COMPILE_FAILED",
            retryable: true
          });
        }
      })
    ).rejects.toMatchObject({ code: "COMPILE_FAILED", retryable: true });
  });
});
