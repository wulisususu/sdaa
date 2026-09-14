import { ASK_BETTER_ORIGIN } from "./config";

export type NavigationDecision =
  | { kind: "internal" }
  | { kind: "external"; url: string }
  | { kind: "blocked" };

function normalizeOrigin(origin: string): string | null {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function classifyNavigation(
  url: string,
  appOrigin: string = ASK_BETTER_ORIGIN
): NavigationDecision {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return { kind: "blocked" };
  }

  if (parsed.protocol === "mailto:" || parsed.protocol === "tel:") {
    return { kind: "external", url };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { kind: "blocked" };
  }

  const normalizedAppOrigin = normalizeOrigin(appOrigin);
  if (!normalizedAppOrigin) {
    return { kind: "blocked" };
  }

  if (parsed.origin === normalizedAppOrigin) {
    return { kind: "internal" };
  }

  return { kind: "external", url };
}
