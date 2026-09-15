import { afterEach, describe, expect, it, vi } from "vitest";

const productionOrigin = "https://ask.wulisu.icu";

describe("classifyNavigation", () => {
  it("keeps same-origin HTTPS navigation inside the WebView", async () => {
    const { classifyNavigation } = await import("./navigation-policy");

    expect(classifyNavigation("https://ask.wulisu.icu/")).toEqual({ kind: "internal" });
    expect(classifyNavigation("https://ask.wulisu.icu/?x=1")).toEqual({ kind: "internal" });
  });

  it("hands ordinary external and Android handler URLs outside the WebView", async () => {
    const { classifyNavigation } = await import("./navigation-policy");

    expect(classifyNavigation("https://www.zhihu.com/")).toEqual({
      kind: "external",
      url: "https://www.zhihu.com/"
    });
    expect(classifyNavigation("mailto:test@example.com")).toEqual({
      kind: "external",
      url: "mailto:test@example.com"
    });
    expect(classifyNavigation("tel:10086")).toEqual({ kind: "external", url: "tel:10086" });
  });

  it("blocks executable, embedded-data, malformed, and unsupported schemes", async () => {
    const { classifyNavigation } = await import("./navigation-policy");

    expect(classifyNavigation("javascript:alert(1)")).toEqual({ kind: "blocked" });
    expect(classifyNavigation("data:text/html,test")).toEqual({ kind: "blocked" });
    expect(classifyNavigation("intent://scan/#Intent;scheme=zxing;end")).toEqual({ kind: "blocked" });
    expect(classifyNavigation("not a url")).toEqual({ kind: "blocked" });
  });

  it("compares parsed origins rather than URL prefixes", async () => {
    const { classifyNavigation } = await import("./navigation-policy");

    expect(classifyNavigation("https://ask.wulisu.icu.evil.example/")).toEqual({
      kind: "external",
      url: "https://ask.wulisu.icu.evil.example/"
    });
    expect(classifyNavigation("https://ask.wulisu.icu/path", productionOrigin)).toEqual({
      kind: "internal"
    });
  });
});

describe("Ask Better Web origin config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to the deployed Ask Better HTTPS origin", async () => {
    vi.stubEnv("EXPO_PUBLIC_ASK_BETTER_URL", "");
    vi.resetModules();

    const config = await import("./config");

    expect(config.ASK_BETTER_WEB_URL).toBe("https://ask.wulisu.icu");
    expect(config.ASK_BETTER_ORIGIN).toBe(productionOrigin);
  });

  it("accepts only a URL on the deployed Ask Better HTTPS origin", async () => {
    vi.stubEnv("EXPO_PUBLIC_ASK_BETTER_URL", "https://ask.wulisu.icu/mobile?source=apk");
    vi.resetModules();

    const config = await import("./config");

    expect(config.ASK_BETTER_WEB_URL).toBe("https://ask.wulisu.icu/mobile?source=apk");
    expect(config.ASK_BETTER_ORIGIN).toBe(productionOrigin);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "https://evil.example/",
    "http://ask.wulisu.icu/"
  ])("falls back to production for disallowed EXPO_PUBLIC_ASK_BETTER_URL=%s", async (value) => {
    vi.stubEnv("EXPO_PUBLIC_ASK_BETTER_URL", value);
    vi.resetModules();

    const config = await import("./config");

    expect(config.ASK_BETTER_WEB_URL).toBe("https://ask.wulisu.icu");
    expect(config.ASK_BETTER_ORIGIN).toBe(productionOrigin);
  });
});
