import { ZhihuProviderError } from "./errors";

const DEFAULT_ZHIHU_API_BASE_URL = "https://developer.zhihu.com";

export type ZhihuFetch = typeof fetch;
export type ZhihuEnv = Record<string, string | undefined>;

export interface ZhihuRawCommentInfo {
  Content: string;
}

export interface ZhihuRawSearchItem {
  Title: string;
  ContentType: string;
  ContentID: string;
  ContentText: string;
  Url: string;
  CommentCount: number;
  VoteUpCount: number;
  AuthorName: string;
  AuthorAvatar: string;
  AuthorBadge: string;
  AuthorBadgeText: string;
  EditTime: number;
  CommentInfoList?: ZhihuRawCommentInfo[];
  AuthorityLevel: string;
  RankingScore: number;
}

export interface ZhihuRawSearchData {
  HasMore: boolean;
  SearchHashId: string;
  Items: ZhihuRawSearchItem[];
  EmptyReason?: string;
}

interface ZhihuEnvelope {
  Code: number;
  Message?: string;
  Data?: ZhihuRawSearchData | null;
}

export interface SearchZhihuOptions {
  count?: number;
  fetchImpl?: ZhihuFetch;
  now?: () => number;
  env?: ZhihuEnv;
}

interface ZhihuConfig {
  baseURL: string;
  accessSecret: string;
}

export function readZhihuConfig(env: ZhihuEnv = process.env): ZhihuConfig {
  const baseURL = (env.ZHIHU_API_BASE_URL?.trim() || DEFAULT_ZHIHU_API_BASE_URL).replace(/\/+$/, "");
  const accessSecret = env.ZHIHU_ACCESS_SECRET?.trim();

  if (!accessSecret) {
    throw new ZhihuProviderError("ZHIHU_NOT_CONFIGURED", "知乎检索服务暂未配置。", false);
  }

  return { baseURL, accessSecret };
}

function normalizeCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return 10;
  return Math.min(10, Math.max(1, Math.trunc(value)));
}

function mapBusinessError(code: number): ZhihuProviderError {
  if (code === 20001) {
    return new ZhihuProviderError("ZHIHU_UNAUTHORIZED", "知乎检索服务鉴权失败。", false);
  }
  if (code === 30001) {
    return new ZhihuProviderError("ZHIHU_RATE_LIMITED", "知乎检索额度或频率暂时受限。", true);
  }
  return new ZhihuProviderError("ZHIHU_UPSTREAM_ERROR", "知乎检索暂时失败。", true);
}

function looksLikeSearchData(value: unknown): value is ZhihuRawSearchData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ZhihuRawSearchData>;
  return typeof data.HasMore === "boolean" && typeof data.SearchHashId === "string" && Array.isArray(data.Items);
}

export async function searchZhihu(query: string, options: SearchZhihuOptions = {}): Promise<ZhihuRawSearchData> {
  const config = readZhihuConfig(options.env ?? process.env);
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new ZhihuProviderError("ZHIHU_UPSTREAM_ERROR", "知乎检索关键词不能为空。", false);
  }

  const url = new URL("/api/v1/content/zhihu_search", config.baseURL);
  url.searchParams.set("Query", trimmedQuery);
  url.searchParams.set("Count", String(normalizeCount(options.count)));

  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.accessSecret}`,
        "X-Request-Timestamp": String(Math.floor(now() / 1000)),
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(10_000)
    });
  } catch (error) {
    throw new ZhihuProviderError("ZHIHU_UPSTREAM_ERROR", "知乎检索暂时失败。", true, {
      cause: error instanceof Error ? error : undefined
    });
  }

  if (response.status === 401 || response.status === 403) {
    throw new ZhihuProviderError("ZHIHU_UNAUTHORIZED", "知乎检索服务鉴权失败。", false);
  }
  if (response.status === 429) {
    throw new ZhihuProviderError("ZHIHU_RATE_LIMITED", "知乎检索额度或频率暂时受限。", true);
  }
  if (!response.ok) {
    throw new ZhihuProviderError("ZHIHU_UPSTREAM_ERROR", "知乎检索暂时失败。", true);
  }

  let body: ZhihuEnvelope;
  try {
    body = (await response.json()) as ZhihuEnvelope;
  } catch (error) {
    throw new ZhihuProviderError("ZHIHU_UPSTREAM_ERROR", "知乎检索返回了无法解析的数据。", true, {
      cause: error instanceof Error ? error : undefined
    });
  }

  if (body.Code !== 0) {
    throw mapBusinessError(body.Code);
  }
  if (!looksLikeSearchData(body.Data)) {
    throw new ZhihuProviderError("ZHIHU_UPSTREAM_ERROR", "知乎检索返回的数据结构不完整。", true);
  }

  return body.Data;
}
