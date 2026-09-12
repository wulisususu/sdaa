import {
  CoverageAnalysisSchema,
  RetrieveResultSchema,
  SearchEvidenceItemSchema,
  SearchQueryPlanSchema,
  type RetrieveRequest,
  type RetrieveResult,
  type SearchEvidenceItem
} from "@ask-better/domain";
import { LLMProviderError, generateStructured as defaultGenerateStructured } from "../ai/provider";
import { COVERAGE_SYSTEM_PROMPT, buildCoveragePrompt } from "../ai/prompts/coverage";
import { QUERY_PLAN_SYSTEM_PROMPT, buildQueryPlanPrompt } from "../ai/prompts/query-plan";
import { buildSearchCacheKey, createCache, type CacheAdapter } from "../cache/cache";
import { searchZhihu as defaultSearchZhihu, type ZhihuRawSearchData } from "../zhihu/client";
import { normalizeZhihuSearchItem } from "../zhihu/normalize";
import type { StructuredGenerator } from "./analyze-service";

export type ZhihuSearcher = (query: string) => Promise<ZhihuRawSearchData>;

export interface RetrieveQuestionDependencies {
  generateStructured?: StructuredGenerator;
  searchZhihu?: ZhihuSearcher;
  cache?: CacheAdapter;
}

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const query of queries) {
    const clean = query.trim().replace(/\s+/g, " ");
    const key = clean.toLocaleLowerCase("zh-CN");
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length === 3) break;
  }

  return result;
}

function dedupeEvidence(items: SearchEvidenceItem[]): SearchEvidenceItem[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const result: SearchEvidenceItem[] = [];

  for (const item of items.sort((a, b) => b.rankingScore - a.rankingScore)) {
    const idKey = `${item.source}:${item.id}`;
    if (seenIds.has(idKey) || seenUrls.has(item.url)) continue;
    seenIds.add(idKey);
    seenUrls.add(item.url);
    result.push(item);
  }

  return result.slice(0, 24);
}

function readErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;
}

async function safeCacheGet(cache: CacheAdapter, key: string): Promise<SearchEvidenceItem[] | null> {
  try {
    const value = await cache.get<unknown>(key);
    if (value === null) return null;
    const parsed = SearchEvidenceItemSchema.array().safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function safeCacheSet(
  cache: CacheAdapter,
  key: string,
  value: SearchEvidenceItem[],
  ttlSeconds: number
): Promise<void> {
  try {
    await cache.set(key, value, ttlSeconds);
  } catch {
    // Cache is quota/performance protection only. A Redis outage must not break retrieval.
  }
}

function validateQueryPlan(value: unknown): string[] {
  const parsed = SearchQueryPlanSchema.safeParse(value);
  if (!parsed.success) {
    throw new LLMProviderError("AI_INVALID_OUTPUT", "AI 返回的检索计划无法校验，请重试。", true, {
      cause: parsed.error
    });
  }
  return dedupeQueries(parsed.data.queries);
}

function resolvedRetrievalStatus(
  terminalSearchStatus: "quota_limited" | "unavailable" | null,
  hadSearchFailure: boolean
): "success" | "partial" | "quota_limited" {
  if (terminalSearchStatus === "quota_limited") return "quota_limited";
  return hadSearchFailure ? "partial" : "success";
}

export async function retrieveQuestion(
  input: RetrieveRequest,
  deps: RetrieveQuestionDependencies = {}
): Promise<RetrieveResult> {
  const generate = deps.generateStructured ?? defaultGenerateStructured;
  const search: ZhihuSearcher = deps.searchZhihu ?? ((query) => defaultSearchZhihu(query));
  const cache = deps.cache ?? createCache();

  const queryPlanRaw = await generate(
    SearchQueryPlanSchema,
    QUERY_PLAN_SYSTEM_PROMPT,
    buildQueryPlanPrompt({
      rawQuestion: input.rawQuestion,
      clarificationAnswers: input.clarificationAnswers
    })
  );
  const queries = validateQueryPlan(queryPlanRaw);

  if (queries.length === 0) {
    throw new LLMProviderError("AI_INVALID_OUTPUT", "AI 未生成有效检索词，请重试。", true);
  }

  const ttlSeconds = input.analysis.timeSensitive ? 2 * 60 * 60 : 12 * 60 * 60;
  const gathered: SearchEvidenceItem[] = [];
  const warnings: string[] = [];
  let hadSearchFailure = false;
  let terminalSearchStatus: "quota_limited" | "unavailable" | null = null;

  for (const query of queries) {
    const cacheKey = buildSearchCacheKey(query);
    const cached = await safeCacheGet(cache, cacheKey);
    if (cached) {
      gathered.push(...cached);
      continue;
    }

    try {
      const raw = await search(query);
      const normalized = raw.Items.map(normalizeZhihuSearchItem);
      gathered.push(...normalized);
      await safeCacheSet(cache, cacheKey, normalized, ttlSeconds);
    } catch (error) {
      hadSearchFailure = true;
      const code = readErrorCode(error);
      if (code === "ZHIHU_RATE_LIMITED") {
        terminalSearchStatus = "quota_limited";
        warnings.push("知乎检索额度或频率暂时受限，本次没有伪造替代结果。");
        break;
      }
      if (code === "ZHIHU_NOT_CONFIGURED" || code === "ZHIHU_UNAUTHORIZED") {
        terminalSearchStatus = "unavailable";
        warnings.push("知乎检索服务当前不可用，本次结果不会使用演示数据代替。");
        break;
      }
      warnings.push("部分知乎检索暂时失败，已保留成功取得的真实结果。");
    }
  }

  const evidence = dedupeEvidence(gathered);

  if (evidence.length === 0) {
    return RetrieveResultSchema.parse({
      status: terminalSearchStatus ?? (hadSearchFailure ? "unavailable" : "success"),
      evidenceStatus: "insufficient",
      queries,
      evidence: [],
      existingCoverage: [],
      knowledgeGaps: [],
      ...(warnings.length ? { warnings } : {})
    });
  }

  try {
    const coverageRaw = await generate(
      CoverageAnalysisSchema,
      COVERAGE_SYSTEM_PROMPT,
      buildCoveragePrompt({
        rawQuestion: input.rawQuestion,
        clarificationAnswers: input.clarificationAnswers,
        evidence
      })
    );
    const coverage = CoverageAnalysisSchema.parse(coverageRaw);

    return RetrieveResultSchema.parse({
      status: resolvedRetrievalStatus(terminalSearchStatus, hadSearchFailure),
      evidenceStatus: coverage.evidenceStatus,
      queries,
      evidence,
      existingCoverage: coverage.existingCoverage,
      knowledgeGaps: coverage.knowledgeGaps,
      ...(warnings.length ? { warnings } : {})
    });
  } catch {
    warnings.push("覆盖分析暂时不可用，已保留真实知乎检索结果，可以继续编译。");
    return RetrieveResultSchema.parse({
      status: terminalSearchStatus === "quota_limited" ? "quota_limited" : "partial",
      evidenceStatus: "partial",
      queries,
      evidence,
      existingCoverage: [],
      knowledgeGaps: [],
      warnings
    });
  }
}
