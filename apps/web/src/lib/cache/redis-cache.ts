import { Redis } from "@upstash/redis";
import type { CacheAdapter } from "./cache";

export class RedisCache implements CacheAdapter {
  private readonly redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async get<T>(key: string): Promise<T | null> {
    return (await this.redis.get<T>(key)) ?? null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, { ex: Math.max(1, Math.trunc(ttlSeconds)) });
  }
}
