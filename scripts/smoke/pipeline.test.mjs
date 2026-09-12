import test from "node:test";
import assert from "node:assert/strict";
import { runPipelineSmoke } from "./pipeline.mjs";

test("runs analyze -> retrieve -> compile and answers clarifications from returned options", async () => {
  const calls = [];
  const analysis = {
    intent: ["职业决策"],
    primaryGoal: "比较转码路线",
    timeSensitive: true,
    ambiguities: ["目标方向不明确"],
    missingContext: [{ field: "direction", reason: "影响答案", priority: 1 }],
    clarificationQuestions: [
      { id: "direction", question: "你更想转向哪类岗位？", options: ["AI 应用开发", "传统 Web"] },
      { id: "priority", question: "你最看重什么？", options: ["就业机会", "学习成本"] }
    ],
    diagnostics: []
  };
  const retrieval = {
    status: "success",
    evidenceStatus: "partial",
    queries: ["转码 AI 应用开发"],
    evidence: [{
      id: "answer-1",
      title: "转码讨论",
      contentType: "Answer",
      summary: "摘要",
      url: "https://www.zhihu.com/question/1/answer/1",
      author: "答主",
      editedAt: 1710000000,
      rankingScore: 0.8,
      authorityLevel: "1",
      voteUpCount: 10,
      commentCount: 2,
      selectedComments: [],
      source: "zhihu"
    }],
    existingCoverage: [],
    knowledgeGaps: []
  };
  const compile = {
    compiledQuestion: {
      title: "非科班转向 AI 应用开发时，应如何评估就业机会与学习投入？",
      background: "希望评估转码方向。",
      goal: "比较路线。",
      constraints: ["目标方向：AI 应用开发"],
      coreUncertainty: "投入是否值得。",
      expectedAnswer: ["岗位机会", "学习成本"]
    },
    evidenceUsed: true
  };

  const fakeFetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url: String(url), body });
    const payload = calls.length === 1 ? analysis : calls.length === 2 ? retrieval : compile;
    return new Response(JSON.stringify({ ok: true, data: payload }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  const result = await runPipelineSmoke("https://demo.example.com/", "现在转码还有前途吗？", fakeFetch);

  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://demo.example.com/api/question/analyze");
  assert.deepEqual(calls[1].body.clarificationAnswers, {
    direction: "AI 应用开发",
    priority: "就业机会"
  });
  assert.equal(calls[2].body.retrieval.evidence[0].source, "zhihu");
  assert.equal(result.compile.compiledQuestion.title, compile.compiledQuestion.title);
});

test("throws a safe message when an API response is not ok", async () => {
  const fakeFetch = async () => new Response(
    JSON.stringify({
      ok: false,
      error: { code: "AI_NOT_CONFIGURED", message: "AI 服务暂未配置。", retryable: false }
    }),
    { status: 503, headers: { "content-type": "application/json" } }
  );

  await assert.rejects(
    () => runPipelineSmoke("https://demo.example.com", "现在转码还有前途吗？", fakeFetch),
    /AI_NOT_CONFIGURED: AI 服务暂未配置/
  );
});
