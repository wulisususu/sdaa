import type { CacheAdapter } from "./cache";

interface Entry {
  value: unknown;
  expiresAt: number;
}

export class MemoryCache implements CacheAdapter {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const boundedTtl = Math.max(1, Math.trunc(ttlSeconds));
    this.entries.set(key, {
      value,
      expiresAt: this.now() + boundedTtl * 1000
    });
  }
}
