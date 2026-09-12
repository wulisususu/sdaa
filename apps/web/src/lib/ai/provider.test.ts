import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildJsonSystemPrompt, readLLMConfig } from "./provider";

describe("LLM provider configuration", () => {
  test("fails safely when required configuration is missing", () => {
    try {
      readLLMConfig({
        LLM_BASE_URL: "https://example.com/v1",
        LLM_API_KEY: "",
        LLM_MODEL: "demo-model"
      });
      throw new Error("expected readLLMConfig to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "AI_NOT_CONFIGURED",
        retryable: false
      });
    }
  });

  test("returns provider-neutral configuration when complete", () => {
    expect(
      readLLMConfig({
        LLM_BASE_URL: "https://example.com/v1/",
        LLM_API_KEY: "secret-value",
        LLM_MODEL: "demo-model"
      })
    ).toEqual({
      baseURL: "https://example.com/v1",
      apiKey: "secret-value",
      model: "demo-model"
    });
  });
});

describe("JSON response prompt guard", () => {
  // Regression: when the provider does not support json_schema, the AI SDK falls back to
  // response_format=json_object, and OpenAI-compatible upstreams (DeepSeek) reject the request
  // with HTTP 400 unless the prompt literally contains the word "json".
  test("keeps the original system prompt and adds an explicit json response rule", () => {
    const system = buildJsonSystemPrompt("你是问题分析器。");

    expect(system).toContain("你是问题分析器。");
    expect(system.toLowerCase()).toContain("json");
  });

  test("embeds the requested output shape so the model can satisfy it without json_schema support", () => {
    const system = buildJsonSystemPrompt(
      "你是问题分析器。",
      z.object({ intent: z.array(z.string()).min(1), primaryGoal: z.string() })
    );

    expect(system).toContain("intent");
    expect(system).toContain("primaryGoal");
    expect(system.toLowerCase()).toContain("json");
  });

  test("still yields a json-safe prompt when the schema cannot be described as JSON Schema", () => {
    const system = buildJsonSystemPrompt("你是问题分析器。", z.custom(() => true) as never);

    expect(system).toContain("你是问题分析器。");
    expect(system.toLowerCase()).toContain("json");
  });
});
