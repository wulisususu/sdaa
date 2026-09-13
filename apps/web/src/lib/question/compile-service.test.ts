import { describe, expect, test } from "vitest";
import type { CompileRequest, QuestionAnalysis, RetrieveResult } from "@ask-better/domain";
import type { StructuredGenerator } from "./analyze-service";
import { compileQuestion } from "./compile-service";

const analysis: QuestionAnalysis = {
  intent: ["职业转换"],
  primaryGoal: "比较技术路线",
  timeSensitive: true,
  ambiguities: [],
  missingContext: [{ field: "private-marker", reason: "敏感缺失字段标记", priority: 3 }],
  clarificationQuestions: [
    {
      id: "direction",
      question: "更想比较哪类方向？",
      options: ["AI 应用开发", "传统前后端"]
    },
    {
      id: "goal",
      question: "最关心哪类结果？",
      options: ["就业机会", "学习投入"]
    }
  ],
  diagnostics: [{ code: "W001", title: "不应进入 prompt 的诊断", summary: "diagnostic-secret-marker", level: "warning" }]
};

const retrieval: RetrieveResult = {
  status: "success",
  evidenceStatus: "partial",
  queries: ["AI 应用开发 转码"],
  evidence: [
    {
      id: "answer-1",
      title: "非科班转码经验",
      contentType: "Answer",
      summary: "full-evidence-summary-marker",
      url: "https://www.zhihu.com/question/1/answer/1?utm_medium=openapi_platform",
      author: "答主",
      editedAt: 1710000000,
      rankingScore: 0.9,
      authorityLevel: "2",
      voteUpCount: 100,
      commentCount: 10,
      selectedComments: ["full-comment-marker"],
      source: "zhihu"
    }
  ],
  existingCoverage: [
    { id: "coverage-1", title: "岗位讨论较多", detail: "已有岗位机会讨论。", strength: "high", evidenceIds: ["answer-1"] }
  ],
  knowledgeGaps: [
    { id: "gap-1", title: "当前检索较少比较学习投入", detail: "当前检索结果较少覆盖两条路线的学习投入对比。", evidenceIds: ["answer-1"] }
  ]
};

const input: CompileRequest = {
  rawQuestion: "我想转码，但不知道 AI 应用开发还是传统前后端更适合。",
  analysis,
  clarificationAnswers: { direction: "AI 应用开发", goal: "就业机会" },
  retrieval
};

function validArtifact() {
  return {
    compiledQuestion: {
      title: "想转码并关注就业机会时，AI 应用开发和传统前后端应该如何比较？",
      background: "正在评估转码方向。",
      goal: "比较 AI 应用开发和传统前后端的就业机会。",
      constraints: ["明确关注就业机会"],
      coreUncertainty: "两条路线中哪一条更适合当前投入？",
      expectedAnswer: ["初级岗位机会", "学习投入", "项目门槛"]
    },
    publishableQuestion: {
      title: "想转码时，AI 应用开发和传统前后端该怎么选？",
      context: "我正在评估转码方向，目前更关心初级岗位机会和实际学习投入，希望比较两条路线。",
      questions: ["两条路线的初级岗位机会有什么差异？", "学习投入和项目门槛分别如何？"]
    }
  };
}

describe("compileQuestion", () => {
  test("uses answered clarification semantics in a slim compile context", async () => {
    let seenPrompt = "";
    const fakeGenerate = (async (_schema, _system, prompt) => {
      seenPrompt = prompt;
      return validArtifact();
    }) as StructuredGenerator;

    const result = await compileQuestion(input, { generateStructured: fakeGenerate });

    expect(seenPrompt).toContain(input.rawQuestion);
    expect(seenPrompt).toContain("更想比较哪类方向？");
    expect(seenPrompt).toContain('"answer": "AI 应用开发"');
    expect(seenPrompt).toContain("最关心哪类结果？");
    expect(seenPrompt).toContain('"answer": "就业机会"');
    expect(seenPrompt).toContain("岗位讨论较多");
    expect(seenPrompt).toContain("当前检索较少比较学习投入");
    expect(seenPrompt).toContain("非科班转码经验");
    expect(seenPrompt).not.toContain("敏感缺失字段标记");
    expect(seenPrompt).not.toContain("diagnostic-secret-marker");
    expect(seenPrompt).not.toContain("full-evidence-summary-marker");
    expect(seenPrompt).not.toContain("full-comment-marker");
    expect(result.evidenceUsed).toBe(true);
    expect(result.publishableQuestion.title).toContain("AI 应用开发");
  });

  test("does not claim evidence was used when retrieval has no evidence", async () => {
    const fakeGenerate = (async () => validArtifact()) as StructuredGenerator;
    const result = await compileQuestion(
      {
        ...input,
        retrieval: { ...retrieval, status: "unavailable", evidenceStatus: "insufficient", evidence: [] }
      },
      { generateStructured: fakeGenerate }
    );
    expect(result.evidenceUsed).toBe(false);
  });

  test("repairs one publication-quality failure exactly once", async () => {
    let calls = 0;
    let repairPrompt = "";
    const fakeGenerate = (async (_schema, _system, prompt) => {
      calls += 1;
      if (calls === 1) {
        const artifact = validArtifact();
        artifact.publishableQuestion.context = "用户未提供更多个人背景，目前正在评估 AI 应用开发和传统前后端，希望获得比较。";
        return artifact;
      }
      repairPrompt = prompt;
      return validArtifact();
    }) as StructuredGenerator;

    const result = await compileQuestion(input, { generateStructured: fakeGenerate });
    expect(calls).toBe(2);
    expect(repairPrompt).toContain("最终发布稿包含编译器内部表达");
    expect(result.publishableQuestion.context).not.toContain("用户未提供");
  });

  test("fails safely when repaired output still violates publication quality", async () => {
    const fakeGenerate = (async () => {
      const artifact = validArtifact();
      artifact.publishableQuestion.context = "用户未提供更多个人背景，目前正在评估 AI 应用开发和传统前后端，希望获得比较。";
      return artifact;
    }) as StructuredGenerator;

    await expect(compileQuestion(input, { generateStructured: fakeGenerate })).rejects.toMatchObject({
      code: "COMPILE_FAILED",
      retryable: true
    });
  });

  test("maps invalid generated artifact structure to COMPILE_FAILED", async () => {
    const fakeGenerate = (async () => ({ title: "只有标题" })) as StructuredGenerator;
    await expect(compileQuestion(input, { generateStructured: fakeGenerate })).rejects.toMatchObject({
      code: "COMPILE_FAILED",
      retryable: true
    });
  });
});
