import type { ApiErrorCode } from "@ask-better/domain";

export class ZhihuProviderError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;

  constructor(code: ApiErrorCode, message: string, retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "ZhihuProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}
