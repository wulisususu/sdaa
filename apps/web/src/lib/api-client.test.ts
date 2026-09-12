import { describe, expect, test } from "vitest";
import { analyzeQuestionApi, ClientApiError, type ApiFetch } from "./api-client";

const validAnalysis = {
  intent: ["职业转换"],
  primaryGoal: "判断职业方向",
  timeSensitive: true,
  ambiguities: [],
  missingContext: [],
  clarificationQuestions: [],
  diagnostics: []
};

describe("browser API client", () => {
  test("parses a successful analyze response", async () => {
    const fakeFetch: ApiFetch = async () =>
      new Response(JSON.stringify({ ok: true, data: validAnalysis }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });

    const result = await analyzeQuestionApi("这是一个足够长的用户问题吗？", fakeFetch);
    expect(result).toEqual(validAnalysis);
  });

  test("throws a typed client error from a safe API failure", async () => {
    const fakeFetch: ApiFetch = async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "AI_NOT_CONFIGURED",
            message: "AI 服务暂未配置。",
            retryable: false
          }
        }),
        { status: 503, headers: { "content-type": "application/json" } }
      );

    try {
      await analyzeQuestionApi("这是一个足够长的用户问题吗？", fakeFetch);
      throw new Error("expected client to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ClientApiError);
      expect(error).toMatchObject({
        code: "AI_NOT_CONFIGURED",
        message: "AI 服务暂未配置。",
        retryable: false
      });
    }
  });

  test("does not trust malformed success payloads", async () => {
    const fakeFetch: ApiFetch = async () =>
      new Response(JSON.stringify({ ok: true, data: { intent: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });

    await expect(
      analyzeQuestionApi("这是一个足够长的用户问题吗？", fakeFetch)
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
