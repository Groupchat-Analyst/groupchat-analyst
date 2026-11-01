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
- **Typed factual-comparison and evidence presentation.** Factual comparison answers (shots, shots on target, goals, possession, pass counts/completion, player-vs-player) are rendered from typed facts (`comparisonFactsFromResult` → `formatFactualComparison`, `factualPresentation.ts`) with per-language templates, number formatting and plural forms (including Arabic singular/dual/plural). The same output feeds Fan, Analyst, copy reply, card text, share preview and the downloaded image. Evidence descriptions for turnovers, possession intervals and other events come from `evidenceLocale.ts`, resolved by stable record ID against the evidence foundation; unrecognised legacy references show a localized label plus the original English source wording, clearly marked. Changing incidental English narrative (`reply`, `limitation`, evidence `description`) cannot change this output (regression test).
- **Question-language parity and compound questions.** Bounded multilingual normalisation of team comparisons, shot-count questions, pass counts/rates and distance claims (`localization.ts`); the Arabic «إيستبورت لديه تسديدات على المرمى أكثر من نورثبريدج.» is now an assessed claim. Supported two-proposition questions yield two claims in all five languages; a Foundry response that merges a recognised contrastive compound into one claim becomes an explicit clarification with no partial statistics. No extra model calls.
- **Saved responses.** Responses without `resolution` fall back to their signed continuation, or to a generic localized clarification; evidence and original wording are preserved and nothing is guessed.

## Verification

Automated (offline, stubbed providers):

- API: **457/457** pass, including the actual Azure Table client against local Azurite (emulator, not Azure). The API has no lint script (not applicable).
- Web: **231/231** pass (adds `sourceIntegrity.test.mjs`: no U+FFFD/`????` in sources; possession note is real text in all five languages), including the real-`App.tsx` copy/export integration tests (jsdom + esbuild, stubbed fetch/clipboard) and typed-presentation tests (includes 57′→58′ typed comparison in all five languages, native Arabic question, incidental-English invariance); TypeScript/production builds and lint pass (existing Vite bundle-size warning). `git diff --check` clean.
- Matrix: 4 fixtures × 5 languages × local and stubbed-Foundry (generic prose, paraphrase, incomplete category) × 1′ / 58′ / 90+4′; both candidate selections per ambiguity with zero additional interpreter calls; Gomes/Gomez, Martin/Martínez, absent players, pronouns/noun phrases, unsupported wording, mixed (one resolved + one pending) claims, foreign-team override, legacy responses, comparison template translation.

Release-verification browser checks at application commit `db548417293785c0155b8e0edacbc4ce6950e3c6` (desktop Chromium viewport emulation; labelled by provider):

- **Local rules (real local API, no model):** Fan/Analyst toggle on populated answers across all four fixtures × es/fr/de/ar (32 answers) — Analyst richer than Fan, no unnamed controls. This found and fixed: corrupted possession note (U+FFFD in es/fr/de, `?????` in ar, present since `35a8e1c`), Spanish "1 tiros a puerta" and unlocalized "Not available" in the statistics block, English "Selected period" row, mixed-language understood line for possession comparisons, and unlabelled English denominator text in "How this was calculated" (now labelled as English source wording). Remaining English in Analyst is the labelled "Technical record" source wording and raw provider prose.
- **Original 57′→58′ shots-on-target comparison via Check again** in en, es, fr, de, Arabic-written (320 px) and English-input-displayed-in-Arabic (390 px): 57′ contradicted (Northbridge 2, Eastport 2) → 58′ supported (Eastport 3, Northbridge 2); new record "Matheus Cunha · goal at 58′" attributed to Eastport; earlier 57′ answer preserved; switching language made zero requests and kept the saved snapshot; no horizontal overflow.
- **Offline Foundry STUB (not a real provider; `foundry-stub-server` wrapping the real analyze handler, no network):** problematic provider output (generic clarification prose, incomplete category) rendered as localized clarification with the provider text labelled and untranslated, one analyze request, no share controls; Bruno choice in all five languages (Arabic at 320 px, RTL, no overflow): two candidate buttons, keyboard focus + Enter resolves with exactly one extra request and **zero additional stub interpretation calls**, share controls appear only after resolution, language switch afterwards makes zero requests; transport failure and the exhausted-allowance 429 (`foundry_allowance_exhausted`) show localized messages in all five languages.
- Possession card (Arabic, 390 px) regenerated at this commit: correct shaping/RTL, corrected localized limitation line. The five-language cards inspected at `f80e624` are otherwise unchanged by this commit (only possession-note text and Analyst-only details changed).
- Earlier browser results retained from `f80e624` are listed below.

Browser (local-rules API, Vite dev server, desktop Chromium; **no Foundry**) at `f80e624`:

- All five languages: pending Bruno question → localized choice with two buttons, no share controls; selecting a candidate made exactly one `resolve-player` request and revealed share controls.
- Arabic at 390 px and 320 px: RTL, no horizontal overflow; switching language with a pending choice preserved the choice and an unsent draft.
- Keyboard: focus and Enter on a candidate button; Spanish populated Analyst view with no English fragments.
- Original fixture 57′→58′ comparison in Arabic and German showed (and was fixed for) untranslated comparison sentences.
- Final-revision downloaded cards (390 px viewport, local rules, Original fixture, 1′) were generated and inspected in all five languages: correct Arabic shaping and RTL, localized original-wording label, verdict, key facts and footer, no wrapping defects.
- Final revision, 9 responses per language across all four fixtures (local rules, default view) scanned in en/es/fr/de/ar for English fragments: none found; resolved answers show share controls, pending choices do not.
- Final revision, Arabic at 320 px, Arabic-written question: 57′ contradicted (2–2) → 58′ supported (Eastport 2→3, Northbridge 2), localized comparison and new-record line, no horizontal overflow.
- Static pages (home, matches, four fixtures) scanned in es/fr/de/ar: no English fragments.

## Remaining limitations and unverified

- **Hosted Foundry, hosted Azure Table and the deployed site are not verified.** Foundry behaviour is covered only by stubs and replayed captures.
- **Typed presentation for the migrated families (see `docs/LOCALIZATION_MIGRATION_CHECKLIST.md`).** Every `ClaimResult` now carries `presentation` (`claimPresentation.ts`): answer code, entity refs, `MatchClock`s (45+3′ preserved), counts/zero-vs-null, scope, limitation codes (28) and reason codes (17). Populated in `service.ts` where the decision is made, never parsed from English. `claimPresentationLocale.ts` renders it in five languages for count assertions, half-time, historical/run-of-play, possession dominance, topic/tactical, player-broad, coaching, unavailable-metric, subjective-unsettled and insufficient replies, limitations, "What we understood"/"Checked against", share-card verdict/limitation/key-fact lines, and request errors (`requestErrorLocale.ts`). "What changed" (headline, lines, caveats, qualifications, card labels/footer) renders from typed `Comparison.facts` (`changeLocale.ts`); earlier answers render from saved snapshots, so language changes do not recalculate them. Fan, Analyst, copy reply, card text, preview and image share one source (`localizedPresentation.ts`).
- **Legacy/source-only uses of the old English translator remain** (documented, none used for newly generated reply, verdict, limitation or earlier-answer text): responses saved without `presentation` (localized compatibility notice + English source labelled as source), `claim.meaning.description` fallbacks for those, change cards for legacy snapshots, static UI notes/labels, catalogue example titles, the evidence-reference heading, `localizedEvidenceDetail` default, and the Arabic counted `metricLabel`.
- Some Arabic phrasing is functional rather than idiomatic and needs native-speaker review; dataset labels are embedded verbatim; the typed "focus" line is coarse.
- Compound questions: supported connectors are split into separate claims; other compositions fall back to the existing single-claim/clarification behaviour.
- Browser checks used desktop Chromium viewport emulation only: no real device, no iPhone native share, no screen reader, no independent accessibility or native-speaker review. The automation browser blocks the clipboard, so copy was verified instead by the real `App.tsx` jsdom integration test capturing the `navigator.clipboard.writeText` argument against hand-written literals (en/es/fr/de/ar), not by a browser clipboard read.
- Browser matrix used local rules plus the offline Foundry stub described above; hosted/live Foundry is not verified. Keyboard checks covered candidate buttons only (no screen reader). Known cosmetic item: the "Earlier answer" line of the comparison repeats the time ("57′ · 57′").
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

