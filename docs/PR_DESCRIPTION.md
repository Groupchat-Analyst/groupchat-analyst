# Complete multilingual responses and player clarification across all fixtures

## Summary

Based on `Origin/main` `e22e76a2a4d415d2107101e8e4956804c7fec2a0` (PR #11). Fixes the hosted failures where native-language and Foundry player questions produced repeated English clarification text without buttons, and extends structured, locale-driven presentation to the clarification, comparison and status surfaces. Public anonymous AI, the explicit local-rules option, the `FoundryJudging` allowance, credentials and the signing key are unchanged.

## Changes

- **One player-resolution path for both providers.** After interpretation, unresolved or wrongly shaped claims are reconciled against the selected fixture's roster by application code. Generic clarification prose, paraphrases and incomplete categories from Foundry now yield structured choices and a signed continuation, as local rules do. Provider prose never decides behaviour.
- **Structured claim state.** `ClaimResult.resolution` is one of `player-choice`, `player-not-in-fixture`, `unsupported-wording`, `needs-clarification`, rendered from locale resources (`resolutionLocale.ts`, `claimState.ts`). Clarification renders once; it is not repeated as a limitation; provider wording is kept only in a labelled details block.
- **Native question families** (`playerQuestions.ts`): performance and pass-completion questions in English, Spanish, French, German and Arabic ("How did / was / was … good", etc.), bounded and explicit. Exact full names and aliases win over fuzzy matches; Gomes/Gomez and Martin/Martínez stay distinct; a team qualifier only resolves a candidate when it identifies one. A name absent from the fixture gives a localized missing-player state; players are never borrowed from another fixture.
- **Stale-state invalidation.** A foreign-team override now drops candidates, `resolution` and the signed continuation, so a superseded claim cannot expose buttons or accept a continuation.
- **Sharing.** Copy, card, download, native share and previews are hidden while any claim is unresolved (`hasUnresolvedClaims`), and shown after resolution.
- **Localization.** Comparison ("What changed") not-comparable states, fallback replies, loading, "Moving to …", clock status and attribution strings are now template-driven in all five languages (`comparisonLocale.ts`); the same templates generate and translate the English, so they cannot drift.
- **Saved responses.** Responses without `resolution` fall back to their signed continuation, or to a generic localized clarification; evidence and original wording are preserved and nothing is guessed.

## Verification

Automated (offline, stubbed providers):

- API: **398/398** pass, including the actual Azure Table client against local Azurite (emulator, not Azure).
- Web: **168/168** pass; TypeScript/production builds and lint pass (existing Vite bundle-size warning). `git diff --check` clean.
- Matrix: 4 fixtures × 5 languages × local and stubbed-Foundry (generic prose, paraphrase, incomplete category) × 1′ / 58′ / 90+4′; both candidate selections per ambiguity with zero additional interpreter calls; Gomes/Gomez, Martin/Martínez, absent players, pronouns/noun phrases, unsupported wording, mixed (one resolved + one pending) claims, foreign-team override, legacy responses, comparison template translation.

Browser (local-rules API, Vite dev server, desktop Chromium; **no Foundry**):

- All five languages: pending Bruno question → localized choice with two buttons, no share controls; selecting a candidate made exactly one `resolve-player` request and revealed share controls.
- Arabic at 390 px and 320 px: RTL, no horizontal overflow; switching language with a pending choice preserved the choice and an unsent draft.
- Keyboard: focus and Enter on a candidate button; Spanish populated Analyst view with no English fragments.
- Original fixture 57′→58′ comparison in Arabic and German showed (and was fixed for) untranslated comparison sentences.
- A downloaded Arabic card (2160×1692) was inspected: correct shaping, RTL alignment, original wording, scope and provider footer.
- Static pages (home, matches, four fixtures) scanned in es/fr/de/ar: no English fragments.

## Remaining limitations and unverified

- **Hosted Foundry, hosted Azure Table and the deployed site are not verified.** Foundry behaviour is covered only by stubs and replayed captures.
- Application-owned prose outside the clarification/comparison/status surfaces (statistic and player answers, evidence descriptions) still uses the existing dictionary/regex localization over English text; it is not yet generated from structured fields. Treat full structured generation as incomplete.
- The Arabic/other-language statistical question families beyond performance and pass completions are not extended (e.g. an Arabic shots question is reported as unsupported in a localized state).
- Compound questions that are not split by the interpreter (e.g. "… and … ?" in one sentence) remain a single claim.
- Browser checks used desktop Chromium viewport emulation only: no real device, no iPhone native share, no screen reader, no native-speaker review. Clipboard copy could not be exercised in the automation browser; copy text relies on the same builders as the card (unit-tested), not a browser clipboard read. Only Arabic and a subset of languages were rendered as downloaded cards.
- Not exercised in a browser: Redmere/Westhaven/Return populated Analyst views in every language (covered by API/web matrix tests only).
## Production settings

Configure these only in the Static Web App's **Production backend environment variables**. Keep the existing signing key unchanged and server-only. Preserve the existing `FoundryJudging` table and counts. Do not configure or use a judge access code.

| Backend setting | Required value/format | Purpose |
|---|---|---|
| `CLAIM_INTERPRETER_PROVIDER` | `local` | Public provider factory stays local; the explicit backend gate selects Foundry. |
| `FOUNDRY_PUBLIC_ENABLED` | `true` after backend configuration is verified | Enables anonymous AI server-side. Set `false` to disable AI while retaining local rules. |
| `NODE_ENV` | `production` | Enforces production signing-key validation. |
| `PLAYER_RESOLUTION_SIGNING_KEY` | Keep current production value; canonical unpadded base64url, 43 characters | Server-only player-continuation signing key, same on all API instances. Do not rotate as part of this repair. |
| `FOUNDRY_OPENAI_BASE_URL` | `<HTTPS-FOUNDRY-OPENAI-COMPATIBLE-ENDPOINT>` | Server-side endpoint. |
| `FOUNDRY_API_KEY` | `<FOUNDRY-DEPLOYMENT-CREDENTIAL>` | Server-only credential. |
| `FOUNDRY_MODEL_DEPLOYMENT` | `<EXACT-DEPLOYMENT-NAME>` | Server-side deployment selector. |
| `FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING` | `<AZURE-TABLE-STORAGE-CONNECTION-STRING>` | Shared backend-only allowance storage; do not substitute `AzureWebJobsStorage`. |
| `FOUNDRY_ALLOWANCE_TABLE_NAME` | `FoundryJudging` | Existing allowance table; do not create a replacement to reset its count. |
| `FOUNDRY_ALLOWANCE_MAX_REQUESTS` | `200` | Authoritative shared attempt ceiling. |
| `FOUNDRY_ALLOWANCE_MAX_PER_CLIENT` | `200` | Per-client ceiling equal to the global ceiling. Client identity is a forwarded-IP hash, not a judge identity. |
| `FOUNDRY_ALLOWANCE_WINDOW_HOURS` | `8760` | Fixed epoch-aligned UTC window; no startup reset. |

`AZURE_STATIC_WEB_APPS_API_TOKEN` remains a repository Actions secret for the existing deployment workflow, not an application setting. The deployed frontend calls same-origin `/api`, not localhost.

## Release and manual deployment steps

1. Review and merge this repair PR only when approved; do not overwrite or reset the existing allowance table.
2. Verify backend setting names and the existing shared table/counts without logging secrets. Preserve the current production `PLAYER_RESOLUTION_SIGNING_KEY`.
3. Use the existing authorized workflow to deploy the selected `main` commit; confirm the workflow event SHA and checkout SHA match.
4. After the API restarts, set `FOUNDRY_PUBLIC_ENABLED=true` only when all backend settings and shared storage are verified. No access code is needed.
5. In hosted smoke checks, confirm anonymous analysis is labelled Foundry, local rules can be selected explicitly, and unavailable/exhausted allowance fails closed with a localized local-rules option. Keep local, built-preview and hosted results distinct.

No merge, deployment, Azure change, credential change or live model call was performed for this repair.

