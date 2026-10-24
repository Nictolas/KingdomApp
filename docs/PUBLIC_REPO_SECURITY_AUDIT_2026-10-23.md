# MyKingdom — pre-publication security review (23 October 2026)

Repository: `Nictolas/KingdomApp`. Scope: current repository and accessible history on **all fetched remote branches**, not just `main` or PR #265.

## Findings

- **Credentials:** scanned 21,253 Git history path-mapped objects and inspected 3,989 text blobs across 2,390 commits for common token, private-key, credential URL, JWT, and hard-coded secret patterns. No recognizable committed real credential was identified. No `.env`, private key, or credential file was identified among tracked paths. This is a **pattern-based audit, not a guarantee** that no secret exists in the repository, history, commit metadata, releases, issues, Actions logs, or external services.
- **False positives:** matches for `pathToken`, `commuteToken`, and related variable names concern internal gameplay state. The legacy `completa-push.ps1` script constructed an authenticated remote URL from an interactively supplied token; no committed token value was identified. The script is being revised so it no longer stores tokens in Git remote URLs.
- **Artwork:** LPC sprite layers have heterogeneous licenses, source authors and attribution obligations. Source records are in `src/character-system/generated/lpc-credits.json`, and extra credit files are committed. See the repository-root `THIRD_PARTY_ASSETS.md`. RhosGFX's **demo** vector RPG overworld tileset is described as CC0 at https://rhosgfx.itch.io/vector-rpg-overworld-demo. Provenance of remaining custom artwork was not independently confirmed.
- **Dependencies:** `npm audit --omit=dev` on 23 October 2026 reported **13 advisories** in the dependency tree: **1 critical, 6 high, 6 moderate**. Among the affected modules are `shell-quote`, `node-forge`, `expo`, `expo-router` and build tooling. Advisory counts are not proof of a remotely exploitable vulnerability in the shipped app. Updates and exploitability assessment remain separate remediation work.
- **Code verification:** PR #265 commit `84c63ca` passed local TypeScript compilation, all **497/497** tests and web export. This does not replace device testing or deployment security testing.
- **GitHub Actions:** failed at job initialization (no steps) due to a GitHub account billing / spending-limit warning, not failed project tests. This limitation is distinct from code safety.

## Publication considerations

When changing a repository from private to public, GitHub makes source code, commit history, branch content and Actions history/logs visible. Commit author metadata and any personal emails that were committed may be visible too. Anyone can clone/fork the repository. Files deleted from the newest commit may still be reachable in history.

Public visibility **does not itself grant third parties permission to reuse all the code/assets**. Specify a deliberate code license separately if desired, respecting the third-party artwork.

## Recommended follow-up

1. Retain the `.gitignore` exclusions for build artifacts and `.env` files; never add credentials or PATs to Git remote URLs.
2. Enable or verify GitHub secret scanning and push protection on the public repository, and use a branch protection policy appropriate for the project.
3. Review and update vulnerable transitive dependencies; prioritize the critical advisory and validate changes via complete tests.
4. Maintain LPC attribution and source license records for each imported layer; confirm provenance for the small custom-art directory.
5. Resolve GitHub Actions account billing/spending permissions separately if CI is needed.
6. Periodically inspect newly committed files and GitHub Actions logs for sensitive information.

### Limits

This is a point-in-time audit. It did not inspect external application secrets, Vercel settings, GitHub Actions historical log contents, npm package source beyond advisories, or private assets not tracked by the repository. No account-billing settings, visibility settings, live credentials or production deployments were changed during this review.
