import { ApiErrorCodeSchema, type ApiErrorCode } from "@ask-better/domain";

const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  AI_NOT_CONFIGURED: 503,
  AI_TIMEOUT: 504,
  AI_INVALID_OUTPUT: 502,
  ZHIHU_NOT_CONFIGURED: 503,
  ZHIHU_UNAUTHORIZED: 502,
  ZHIHU_RATE_LIMITED: 429,
  ZHIHU_UPSTREAM_ERROR: 502,
  COMPILE_FAILED: 502
};

const messageByCode: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: "输入内容不符合要求，请检查后重试。",
  AI_NOT_CONFIGURED: "AI 服务暂未配置。",
  AI_TIMEOUT: "AI 服务响应超时，请稍后重试。",
  AI_INVALID_OUTPUT: "AI 暂时无法生成有效结果，请重试。",
  ZHIHU_NOT_CONFIGURED: "知乎检索服务暂未配置。",
  ZHIHU_UNAUTHORIZED: "知乎检索服务鉴权失败，请稍后再试。",
  ZHIHU_RATE_LIMITED: "知乎检索额度或频率暂时受限，请稍后重试。",
  ZHIHU_UPSTREAM_ERROR: "知乎检索暂时失败，请稍后重试。",
  COMPILE_FAILED: "问题编译暂时失败，请重试。"
};

export function apiErrorResponse(
  code: ApiErrorCode,
  retryable: boolean,
  status = statusByCode[code]
): Response {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message: messageByCode[code],
        retryable
      }
    },
    { status }
  );
}

export function toSafeApiResponse(error: unknown, fallbackCode: ApiErrorCode = "AI_INVALID_OUTPUT"): Response {
  if (error && typeof error === "object" && "code" in error) {
    const parsedCode = ApiErrorCodeSchema.safeParse((error as { code?: unknown }).code);
    if (parsedCode.success) {
      const retryable =
        "retryable" in error && typeof (error as { retryable?: unknown }).retryable === "boolean"
          ? Boolean((error as { retryable: boolean }).retryable)
          : true;
      return apiErrorResponse(parsedCode.data, retryable);
    }
  }

  return apiErrorResponse(fallbackCode, true);
}
