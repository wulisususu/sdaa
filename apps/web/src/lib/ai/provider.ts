import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ApiErrorCode } from "@ask-better/domain";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import type { ZodType } from "zod";

export interface LLMConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export type EnvLike = Record<string, string | undefined>;

export class LLMProviderError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;

  constructor(code: ApiErrorCode, message: string, retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "LLMProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function readLLMConfig(env: EnvLike = process.env): LLMConfig {
  const baseURL = env.LLM_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = env.LLM_API_KEY?.trim();
  const model = env.LLM_MODEL?.trim();

  if (!baseURL || !apiKey || !model) {
    throw new LLMProviderError("AI_NOT_CONFIGURED", "AI 服务暂未配置。", false);
  }

  return { baseURL, apiKey, model };
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

export async function generateStructured<T>(
  schema: ZodType<T>,
  system: string,
  prompt: string,
  env: EnvLike = process.env
): Promise<T> {
  const config = readLLMConfig(env);
  const provider = createOpenAICompatible({
    name: "ask-better-compatible",
    apiKey: config.apiKey,
    baseURL: config.baseURL
  });

  try {
    const { output } = await generateText({
      model: provider(config.model),
      system,
      prompt,
      output: Output.object({ schema }),
      abortSignal: AbortSignal.timeout(20_000)
    });

    return schema.parse(output);
  } catch (error) {
    if (error instanceof LLMProviderError) throw error;
    if (isTimeoutError(error)) {
      throw new LLMProviderError("AI_TIMEOUT", "AI 服务响应超时，请稍后重试。", true, { cause: error });
    }
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new LLMProviderError("AI_INVALID_OUTPUT", "AI 返回的结构无法校验，请重试。", true, {
        cause: error
      });
    }

    throw new LLMProviderError("AI_INVALID_OUTPUT", "AI 暂时无法生成有效结果，请重试。", true, {
      cause: error instanceof Error ? error : undefined
    });
  }
}
