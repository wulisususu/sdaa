import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ApiErrorCode } from "@ask-better/domain";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z, type ZodType } from "zod";

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

// 实测：deepseek-v4-flash 是推理模型，对 10-12 条真实知乎证据（约 1.5 万字符）做覆盖分析需要
// 16.5-20+ 秒。原来的 20 秒预算会稳定打掉约三分之一的请求，使 Coverage / Gap 整段不可用。
// 放宽预算不改变错误语义：超时仍然映射为可重试的 AI_TIMEOUT。
export const LLM_TIMEOUT_MS = 45_000;

const JSON_RESPONSE_RULE =
  "只返回一个合法的 json 对象作为最终答案：不要输出 Markdown 代码块、解释性文字或任何前后缀。";

/**
 * OpenAI-compatible 上游在缺少 json_schema 支持时会退化为 response_format=json_object，
 * 而部分上游（如 DeepSeek）要求提示词中必须字面出现 "json"，否则直接返回 HTTP 400。
 * 同时因为 json_schema 未被发送，模型只能从提示词获知输出结构，所以这里一并附上 JSON Schema。
 */
export function buildJsonSystemPrompt(system: string, schema?: ZodType): string {
  const sections = [system, JSON_RESPONSE_RULE];

  if (schema) {
    try {
      const jsonSchema = z.toJSONSchema(schema, { unrepresentable: "any" });
      sections.push(`返回的 json 必须符合以下 JSON Schema：\n${JSON.stringify(jsonSchema)}`);
    } catch {
      // 某些 Zod 结构无法描述为 JSON Schema；此时仍保留上面的 json 约束，不阻断调用。
    }
  }

  return sections.join("\n\n");
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
      system: buildJsonSystemPrompt(system, schema),
      prompt,
      output: Output.object({ schema }),
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS)
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
