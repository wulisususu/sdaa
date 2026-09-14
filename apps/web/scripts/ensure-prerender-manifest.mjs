// Guarantees `.next/prerender-manifest.json` is parseable before `next start`.
//
// `next build` can leave this file zero-length (observed with Next 16.3.4 in this
// environment), and `next start` then dies at boot with a bare
// "SyntaxError: Unexpected end of JSON input" while the port never opens. An empty manifest
// is valid for an app whose only route is statically prerendered and whose API routes are
// dynamic, so restore the minimal shape instead of failing to serve.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const manifestPath = path.resolve(process.cwd(), ".next", "prerender-manifest.json");

const MINIMAL_MANIFEST = {
  version: 4,
  routes: {},
  dynamicRoutes: {},
  notFoundRoutes: [],
  preview: {
    previewModeId: "00000000000000000000000000000000",
    previewModeSigningKey: "0000000000000000000000000000000000000000000000000000000000000000",
    previewModeEncryptionKey: "0000000000000000000000000000000000000000000000000000000000000000"
  }
};

if (!existsSync(manifestPath)) {
  // `next build` may not emit this file at all in this environment; `next start` then aborts
  // before binding the port, so create the minimal manifest rather than refusing to serve.
  writeFileSync(manifestPath, JSON.stringify(MINIMAL_MANIFEST));
  console.log("[prestart] created missing prerender-manifest.json");
  process.exit(0);
}

const raw = readFileSync(manifestPath, "utf8").trim();
let valid = false;
if (raw.length > 0) {
  try {
    JSON.parse(raw);
    valid = true;
  } catch {
    valid = false;
  }
}

if (!valid) {
  writeFileSync(manifestPath, JSON.stringify(MINIMAL_MANIFEST));
  console.log(
    `[prestart] repaired empty/invalid prerender-manifest.json (${statSync(manifestPath).size} bytes)`
  );
}
