// Static-file resolution for the isolated Expo Router preview. Never use this for production hosting.
import { stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";

export async function findStaticPreviewFile(exportRoot, urlPath, { allowSpaFallback = true } = {}) {
  const root = resolve(exportRoot);
  if (!urlPath.startsWith("/")) throw new Error("Expected an absolute URL path");
  const decoded = decodeURIComponent(urlPath);
  const requested = resolve(root, "." + decoded);
  if (requested !== root && !requested.startsWith(root + sep)) {
    throw new Error("Path escapes preview export directory");
  }
  // Expo Router can export /settori-preview as settori-preview.html (static),
  // settori-preview/index.html, or use index.html as the SPA fallback.
  const candidates = decoded === "/" ? [join(root, "index.html")]
    : extname(requested) ? [requested]
    : [requested + ".html", join(requested, "index.html"), ...(allowSpaFallback ? [join(root, "index.html")] : [])];
  for (const file of candidates) {
    const info = await stat(file).catch(() => null);
    if (info?.isFile()) return file;
  }
  return null;
}
