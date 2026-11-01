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
| 6 | Count assertions ("every shot", "no shots") | | | [ ] | [ ] |
| 7 | Goal before half-time (incl. 45+3′) | | | [ ] | [ ] |
| 8 | Historical-circumstance / run-of-play | | | [ ] | [ ] |
| 9 | Subjective and tactical (topic, player-broad, possession dominance) | | | [ ] | [ ] |
| 10 | Coaching (turnover breakdowns) | | | [ ] | [ ] |
| 11 | Unavailable-data, unrecognized, insufficient-evidence replies and limitations | | | [ ] | [ ] |
| 12 | Share-card verdict and limitation lines | | | [ ] | [ ] |
| 13 | "What changed": earlier answer from saved snapshot | | | [ ] | [ ] |
| 14 | "What changed": comparison headline, figure lines, caveats | | | [ ] | [ ] |

## Cross-cutting

- [ ] Real `App.tsx` copy action tested with a captured clipboard string and independently written expectations.
- [ ] Fresh downloaded cards generated and inspected in all five languages after the final code change.
- [ ] Browser matrix: 4 fixtures × 5 languages × Fan/Analyst, local rules plus clearly identified offline Foundry stub.
- [ ] Arabic at 390 px and 320 px; keyboard selection; accessible names.
- [ ] Original 57′→58′ shots-on-target comparison (Arabic-written input and English input shown in Arabic).
- [ ] Regression: incidental English narrative changes cannot alter structured output.
- [ ] Audit of remaining `translateNarrative` uses documented.
- [ ] API (incl. Azurite) and web suites, builds, lint, `git diff --check`.
- [ ] PR description and deployment runbook updated to the final commit.
