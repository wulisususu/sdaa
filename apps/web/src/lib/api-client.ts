import {
  ApiErrorSchema,
  CompileResultSchema,
  QuestionAnalysisSchema,
  RetrieveResultSchema,
  type ApiErrorCode,
  type CompileRequest,
  type CompileResult,
  type QuestionAnalysis,
  type RetrieveRequest,
  type RetrieveResult
} from "@ask-better/domain";
import type { ZodType } from "zod";

export type ApiFetch = typeof fetch;
export type ClientErrorCode = ApiErrorCode | "INVALID_RESPONSE" | "NETWORK_ERROR";

export class ClientApiError extends Error {
  readonly code: ClientErrorCode;
  readonly retryable: boolean;

  constructor(code: ClientErrorCode, message: string, retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "ClientApiError";
    this.code = code;
    this.retryable = retryable;
  }
}

async function postJson<T>(
  url: string,
  body: unknown,
  schema: ZodType<T>,
  fetchImpl: ApiFetch
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new ClientApiError("NETWORK_ERROR", "网络连接失败，请检查网络后重试。", true, {
      cause: error instanceof Error ? error : undefined
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new ClientApiError("INVALID_RESPONSE", "服务返回了无法解析的数据，请重试。", true, {
      cause: error instanceof Error ? error : undefined
    });
  }

  if (!payload || typeof payload !== "object" || !("ok" in payload)) {
    throw new ClientApiError("INVALID_RESPONSE", "服务返回的数据结构不完整，请重试。", true);
  }

  const envelope = payload as { ok?: unknown; data?: unknown; error?: unknown };
  if (envelope.ok === false) {
    const parsedError = ApiErrorSchema.safeParse(envelope.error);
    if (parsedError.success) {
      throw new ClientApiError(
        parsedError.data.code,
        parsedError.data.message,
        parsedError.data.retryable
      );
    }
    throw new ClientApiError("INVALID_RESPONSE", "服务暂时无法处理请求，请重试。", true);
  }

  if (envelope.ok !== true) {
    throw new ClientApiError("INVALID_RESPONSE", "服务返回的数据结构不完整，请重试。", true);
  }

  const parsed = schema.safeParse(envelope.data);
  if (!parsed.success) {
    throw new ClientApiError("INVALID_RESPONSE", "服务返回的数据未通过校验，请重试。", true, {
      cause: parsed.error
    });
  }

  return parsed.data;
}

export function analyzeQuestionApi(
  rawQuestion: string,
  fetchImpl: ApiFetch = fetch
): Promise<QuestionAnalysis> {
  return postJson(
    "/api/question/analyze",
    { rawQuestion },
    QuestionAnalysisSchema,
    fetchImpl
  );
}

export function retrieveQuestionApi(
  input: RetrieveRequest,
  fetchImpl: ApiFetch = fetch
): Promise<RetrieveResult> {
  return postJson("/api/question/retrieve", input, RetrieveResultSchema, fetchImpl);
}

export function compileQuestionApi(
  input: CompileRequest,
  fetchImpl: ApiFetch = fetch
): Promise<CompileResult> {
  return postJson("/api/question/compile", input, CompileResultSchema, fetchImpl);
}
