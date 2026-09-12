import { createHash } from "node:crypto";
import { MemoryCache } from "./memory-cache";
import { RedisCache } from "./redis-cache";

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

const processMemoryCache = new MemoryCache();

export function normalizeCacheQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

export function buildSearchCacheKey(query: string): string {
  const hash = createHash("sha256").update(normalizeCacheQuery(query), "utf8").digest("hex");
  return `zhihu:search:v1:${hash}`;
}

export function createCache(env: Record<string, string | undefined> = process.env): CacheAdapter {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (url && token) {
    return new RedisCache(url, token);
  }

  return processMemoryCache;
}
