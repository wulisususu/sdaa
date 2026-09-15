const PRODUCTION_WEB_URL = "https://ask.wulisu.icu";
const PRODUCTION_ORIGIN = new URL(PRODUCTION_WEB_URL).origin;

function resolveAskBetterWebUrl(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) {
    return PRODUCTION_WEB_URL;
  }

  try {
    const parsed = new URL(candidate);
    const isProductionHttpsOrigin =
      parsed.protocol === "https:" && parsed.origin === PRODUCTION_ORIGIN;

    return isProductionHttpsOrigin ? candidate : PRODUCTION_WEB_URL;
  } catch {
    return PRODUCTION_WEB_URL;
  }
}

export const ASK_BETTER_WEB_URL: string = resolveAskBetterWebUrl(
  process.env.EXPO_PUBLIC_ASK_BETTER_URL
);

export const ASK_BETTER_ORIGIN: string = new URL(ASK_BETTER_WEB_URL).origin;
