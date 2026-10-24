/**
 * Pagine che non disegnano un proprio pulsante di uscita nel footer.
 * Le altre schermate conservano i loro comandi specifici (es. «Esci dal Bosco»).
 * Mantenere questo elenco sincronizzato con il controllo in tests/back-footer-coverage.test.mjs.
 */
const PAGES_WITHOUT_LOCAL_FOOTER = new Set([
  "/amministrazione",
  "/emporio",
  "/fucina",
  "/menu",
  "/miniera",
  "/multiplayer",
  "/nudismo",
  "/obiettivi",
  "/richezza",
  "/serra",
  "/timore"
]);

export function needsBottomBackFooter(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (
    PAGES_WITHOUT_LOCAL_FOOTER.has(path) ||
    path.startsWith("/lavori/") ||
    path.startsWith("/impresa/")
  );
}
