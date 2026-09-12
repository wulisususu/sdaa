import { describe, expect, test } from "vitest";
import { MemoryCache } from "./memory-cache";

describe("MemoryCache", () => {
  test("returns cached values before TTL expires", async () => {
    let now = 1_000;
    const cache = new MemoryCache(() => now);

    await cache.set("key", { value: 1 }, 10);
    expect(await cache.get("key")).toEqual({ value: 1 });

    now = 10_999;
    expect(await cache.get("key")).toEqual({ value: 1 });
  });

  test("drops cached values after TTL expires", async () => {
    let now = 1_000;
    const cache = new MemoryCache(() => now);

    await cache.set("key", "cached", 1);
    now = 2_001;

    expect(await cache.get("key")).toBeNull();
  });
});
