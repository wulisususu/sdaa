import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(here, "..");

function read(relativePath: string): string {
  return readFileSync(resolve(mobileRoot, relativePath), "utf8");
}

describe("initial WebView failure policy", () => {
  it("shows native recovery only for the initial main document failure", async () => {
    const { shouldShowNativeLoadError } = await import("./webview-shell-state");

    expect(
      shouldShowNativeLoadError({
        hasLoadedMainDocument: false,
        failedUrl: "https://ask.wulisu.icu/",
        mainDocumentUrl: "https://ask.wulisu.icu"
      })
    ).toBe(true);
  });

  it("keeps errors in the Web UI after the main page has loaded", async () => {
    const { shouldShowNativeLoadError } = await import("./webview-shell-state");

    expect(
      shouldShowNativeLoadError({
        hasLoadedMainDocument: true,
        failedUrl: "https://ask.wulisu.icu/api/question/analyze",
        mainDocumentUrl: "https://ask.wulisu.icu"
      })
    ).toBe(false);
  });

  it("does not turn a subresource HTTP failure into a native fatal screen", async () => {
    const { shouldShowNativeLoadError } = await import("./webview-shell-state");

    expect(
      shouldShowNativeLoadError({
        hasLoadedMainDocument: false,
        failedUrl: "https://ask.wulisu.icu/favicon.ico",
        mainDocumentUrl: "https://ask.wulisu.icu"
      })
    ).toBe(false);
  });
});

describe("WebView shell contract", () => {
  it("wires the required WebView security/navigation/runtime props", () => {
    const source = read("src/components/AskBetterWebView.tsx");

    for (const token of [
      "originWhitelist",
      "javaScriptEnabled",
      "domStorageEnabled",
      "cacheEnabled",
      "sharedCookiesEnabled",
      "thirdPartyCookiesEnabled",
      "setSupportMultipleWindows={false}",
      "startInLoadingState",
      "onShouldStartLoadWithRequest",
      "onOpenWindow",
      "onError",
      "onHttpError",
      "classifyNavigation",
      "Linking.openURL"
    ]) {
      expect(source).toContain(token);
    }
  });

  it("keeps loading and recovery copy in native components", () => {
    expect(read("src/components/LoadingView.tsx")).toContain("正在打开「问得更好」…");

    const errorSource = read("src/components/WebErrorView.tsx");
    expect(errorSource).toContain("重新加载");
    expect(errorSource).toContain("在浏览器中打开");
  });

  it("mounts only the WebView shell from the Expo Router entry screen", () => {
    const indexSource = read("app/index.tsx");
    expect(indexSource).toContain("AskBetterWebView");
    expect(indexSource).not.toMatch(/Analyze|Clarify|Diagnose|Coverage|Result|QuestionSession/);
  });
});
