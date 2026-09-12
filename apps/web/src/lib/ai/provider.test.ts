import { describe, expect, test } from "vitest";
import { readLLMConfig } from "./provider";

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
