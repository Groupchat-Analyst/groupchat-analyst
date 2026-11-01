# Structured response localisation: completion checklist

Branch `repair/i18n-player-resolution`. A family is **done** only when (a) the server populates a typed
descriptor where the scoring decision is made, (b) one shared renderer produces English, Spanish, French,
German and Arabic from that descriptor, (c) Fan, Analyst, copy reply, card text, preview and downloaded
image use that renderer, and (d) offline tests assert independently written expected content.

Legend: `[x]` done and tested, `[ ]` outstanding.

## Response families

| # | Family | Descriptor | Renderer | Surfaces wired | Tests |
|---|--------|-----------|----------|----------------|-------|
| 1 | Factual comparison (team/player) | `factualPresentation.ts` | yes | [x] | [x] |
| 2 | Statistic requests | `localizedStatistics` | yes | [x] | [x] |
| 3 | Player performance | `localizedPlayerPerformance` | yes | [x] | [x] |
| 4 | Evidence descriptions | `evidenceLocale.ts` | yes | [x] | [x] |
| 5 | Player clarification / resolution states | `resolutionLocale.ts` | yes | [x] | [x] |
| 6 | Count assertions ("every shot", "no shots") | `AnswerFact count-assertion` | `claimPresentationLocale.ts` | [x] | [x] |
| 7 | Goal before half-time (incl. 45+3′) | `half-time` + `MatchClock` | same | [x] | [x] |
| 8 | Historical-circumstance / run-of-play | `historical`, `ScopeFact` | same | [x] | [x] |
| 9 | Subjective and tactical (topic, player-broad, possession dominance) | `topic`, `player-broad`, `possession-dominance`, `subjective-unsettled` | same | [x] | [x] |
| 10 | Coaching (turnover breakdowns) | `coaching` | same | [x] | [x] |
| 11 | Unavailable-data, unrecognized, insufficient-evidence replies and limitations | `unavailable-metric`, `unrecognized`, `insufficient`, 28 limitation + 17 reason codes | same | [x] | [x] |
| 12 | Share-card verdict, limitation and key-fact lines | presentation + `renderStatisticFact` | `localizedPresentation.ts` | [x] | [x] |
| 13 | "What changed": earlier answer from saved snapshot | saved `presentation` | same | [x] | [x] |
| 14 | "What changed": headline, figures, caveats, qualifications, card labels/footer | `Comparison.facts` | `changeLocale.ts` | [x] | [x] |
| 15 | Request errors | typed failure fact | `requestErrorLocale.ts` | [x] | [x] |

## Cross-cutting

- [x] Real `App.tsx` copy action tested (jsdom + esbuild, stubbed fetch/clipboard) with independently written literals (`apps/web/src/appCopy.test.mjs`).
- [x] Fresh downloaded cards generated and inspected in all five languages at the final application commit (390 px).
- [x] Browser matrix at `db54841`: 4 fixtures × es/fr/de/ar Fan/Analyst on local rules; Foundry path via the offline stub (choices, resolved, clarification, transport error, 429 allowance) in all five languages.
- [x] Arabic at 390 px and 320 px: keyboard (focus + Enter) candidate selection, accessible names (no unnamed controls), RTL, no overflow, possession card regenerated.
- [x] Original 57′→58′ comparison via Check again in all five languages plus English-in-Arabic; values, attribution, preserved snapshot, zero requests on language switch.
- [x] Regression: incidental English narrative changes cannot alter structured output.
- [x] Audit of remaining `translateNarrative` uses documented in `PR_DESCRIPTION.md`.
- [x] API (457, incl. Azurite), web (231), build, web lint, `git diff --check`. API lint: not applicable.
- [x] PR description and deployment runbook updated to the final application commit `db54841`.
