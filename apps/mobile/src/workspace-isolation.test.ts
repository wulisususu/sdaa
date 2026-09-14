import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(here, "..");

describe("mobile workspace isolation", () => {
  it("keeps Android build out of the root Turbo build graph", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(mobileRoot, "package.json"), "utf8")
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.build).toBeUndefined();
    expect(packageJson.scripts).toMatchObject({
      start: "expo start",
      android: "expo run:android",
      "android:release": "expo run:android --variant release",
      test: "vitest run",
      typecheck: "tsc --noEmit"
    });
  });

  it("documents only the public Ask Better origin", () => {
    const envExample = readFileSync(resolve(mobileRoot, ".env.example"), "utf8").trim();

    expect(envExample).toBe("EXPO_PUBLIC_ASK_BETTER_URL=https://ask.wulisu.icu");
    expect(envExample).not.toMatch(/SECRET|API_KEY|REDIS|TOKEN/i);
  });
});
