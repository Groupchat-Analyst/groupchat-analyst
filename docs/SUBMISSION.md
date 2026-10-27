# Submission summary

## What it is

Groupchat Analyst checks football opinions against recorded match evidence. You type an opinion, choose a moment in a fictional replay, and get an answer that shows how the opinion was understood, the evidence for and against, the limits of that evidence, and a shareable receipt. Move the clock, check again, and see what changed.

Four fictional matches (Northbridge v Eastport ×2, Westhaven FC v Kingswell City, Redmere FC v Alderwick United), their events and player performances are synthetic. Real-player names are fictionalised identities in invented scenarios; the figures are not real player-performance data. The two new squads are roster snapshots (sources and retrieval date 27 October 2026 in [DATA_DICTIONARY.md](../apps/shared/DATA_DICTIONARY.md)), used only as names.

## What works today

- Home page, match selection (four fictional matches) and a match view with replay controls, key moments and verified example opinions that only prefill.
- Opinion → structured meaning → server-side evidence and calculation → Fan or Analyst explanation. Multiple claims are separated; ambiguity gets a clarification; unavailable physical data, injuries and predictions get explicit limits.
- Broad opinions (for example “Saka has had a horrible game”) get the player’s recorded contributions with no rating.
- “Check again” at a later minute produces a deterministic comparison; the card, copied text and PNG are built from the same content and name the fixture, version and how the opinion was read.
- Dataset selection is allowlisted server-side. Omitting `datasetId` selects the original match; unknown or malformed IDs are rejected.

## Accurate AI architecture

- The public candidate is configured to use a **local rule-based interpreter**. No model is called and no credentials are present.
- An optional Microsoft Foundry structured-output adapter exists, disabled by default. If enabled, the model only interprets wording into a validated structure; all statistics, evidence selection and assessments are computed in application code. Invalid or failed model output is an explicit error, never a guessed answer.
- A bounded live run against application `2343167` made three of six authorised requests and stopped after a time-scope presentation mismatch: at 60′, the Return-match response called 62 elapsed participation minutes “minutes played” in the selected period. The offline repair at application `14bb52314a70370851900726fbf620f0fb42e309` names the figure as elapsed participation within recorded coverage and traces the match-clock and elapsed boundaries. Calls 4–6 were not run, and the repair has not been verified live. See the [sanitized ledger](./foundry-2343167-bounded-live-ledger.json) for the unchanged original result.

## Verification summary

| Check | Result |
| --- | --- |
| API tests | 313 pass, including stubbed captured-call replay and duration boundary regressions |
| Web tests | 122 pass |
| Web typecheck/build/lint | Pass |
| `git diff --check` | Pass |
| Baseline fixture hash | Unchanged (`fb5335ff…`, 70 passes, 17 turnovers) |
| Browser (desktop + 390 px/320 px emulation, local stack) | Prior Stage 1/2 checks plus current direct demo route: 0 analyze calls on entry, 1 on explicit submit, 0 on replay movement, 1 on explicit recheck. Both new fixture identities and team names verified in replies and exports; see `docs/NEXT_SESSION.md`. |
| Language matrix | 42 inputs: 42 pass, 0 partial, 0 fail under local rules (asserted) ([docs/LANGUAGE_ACCEPTANCE.md](./LANGUAGE_ACCEPTANCE.md)); Foundry interpretation of the repaired forms unverified |
| Native share on a real phone | **Unverified** |
| Live Foundry for application `2343167` | 3 requests; calls 1–2 met expectations; stopped after call 3 ambiguously labeled 62 minutes at 60′. Offline replay later confirmed the value as elapsed participation in recorded coverage, not future play. Calls 4–6 not run; no broad reliability claim. |
| Offline call-3 duration repair | Captured interpretation replayed through the real validation/service path with stubbed transport; Fan/Analyst/copy/card-label regressions pass. No follow-up live call or browser PNG-byte inspection. |

Final Stage 2 follow-up (27 October 2026; application commit `2343167`): catalog foreign-team opponents are preserved distinctly and rejected without team attribution, statistics or evidence, and are not sent to a supplied model provider. Uncatalogued comparison opponents now prompt for clarification rather than inheriting the fixture's second team. Valid fixture aliases and descriptive opinions remain covered. Homepage limitations and the compound demonstration route were corrected; the direct guided route was rehearsed with explicit submit/recheck. API 308/308 and web 121/121 pass; baseline hash remains unchanged.

Independent review note: the additional composition repairs have nine regression tests and the complete 42-case local corpus passes. The captured baseline responses also pass through the actual web comparison/share functions offline. Browser rendering could not be independently repeated in the review runtime; the following interaction results are the supplied candidate's reported checks. Native phone sharing remains unverified. The bounded live Foundry run is recorded below and in the linked ledger; it stopped after call 3 and did not verify the remaining inputs.

Browser interaction note: ordinary Playwright pointer clicks (with actionability checks) worked on desktop and 390 px emulation for home, match selection, example, submit, replay controls, Move to 58′, Check again and evidence expansion. The earlier interception was not reproduced; no DOM `click()` was used. Not verified: screen readers, real devices, a full keyboard audit.

## Limitations

- Bounded local wording; shot location is reported as unavailable (shots carry no coordinates). “Before the goal” counts strictly before the resolved goal over all events up to the selected time, not the Last-10-minutes window.
- Sampled fixtures: no tracking, video, xG, running distance or continuous defensive shape.
- Answers live in browser memory; refreshing loses them.
- Previously user-verified deployment: https://polite-smoke-0cfdecd10.3.azurestaticapps.net. This reviewed branch has not been deployed there; record the deployed commit and repeat acceptance after the approved deployment.

## Future vision (not built)

A WhatsApp companion that checks a take from a group chat. No messaging, accounts or chat ingestion exist.

## Outstanding actions

1. Open the PR to `main`, review, merge (not done here).
2. Deploy per [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) and record the public URL.
3. Real-iPhone check of “Share the receipts” on the hosted build.
4. Decide whether the Foundry schema should gain the repaired forms (count assertions, shot location); today they are local-rules only.
5. Decide whether to pursue judge-accessible Foundry (below).

## Foundry access recommendation (judge-accessible, enforced allowance)

**Recommendation: do not enable Foundry on the public site as it is.** The existing controls (8192 token ceiling, 30 s timeout, no retries) bound a *single request*, not total spend. Nothing in the repository enforces a global request allowance.

Smallest credible route:

1. Put Foundry behind a **durable server-side allowance**: a small table (for example Azure Table Storage or Cosmos DB) holding a counter updated with optimistic concurrency / conditional writes, checked and incremented *before* the model call. It must work across concurrent requests, instance scale-out and restarts. Fix a daily and a total cap, and decide whether failed provider calls consume allowance (recommended: yes).
2. Define behaviour at exhaustion: return an explicit “live-AI allowance used up” status and fall back to the local interpreter, labelled as such. Never present a local answer as Foundry.
3. Add a per-client limit (for example API Management or a hashed-IP key in the same table) so one visitor cannot spend the whole allowance.
4. Keep a platform **budget alert and a Foundry throughput quota** as backstops. TPM/RPM quotas constrain the rate of requests, not cumulative currency spend; they do not replace the durable allowance. A budget alert, an in-memory counter or a browser-side counter is not a total-spend cap. See [Microsoft quota documentation](https://learn.microsoft.com/azure/foundry/openai/how-to/quota).
5. Credentials only as server settings, with the provider flag off by default.

Dependencies: a new storage resource and a code change in the API; both need explicit approval. Not implemented.

### Stage 2 audit findings (repository-only, before the authorised 27 October run; no model calls or Azure changes)

- **What Foundry supports today:** the structured-interpretation schema and prompt cover the original two matches’ vocabulary (team enums `Northbridge`/`Eastport`, Bruno example). Count assertions (negation, “every”, zero), shot location and the repaired composition forms are implemented in local rules only.
- **Captured outputs:** the genuine `cf10c74` captures still replay through the current validator, service, web comparison and share functions with provider `foundry` (offline replay, not new verification). Constructed transport stubs for the Return fixture and for Westhaven FC v Kingswell City check that the selected fixture supplies events, evidence, calculations and metadata. They are not captures and not live results.
- **Team-name assumptions (Stage 2):** the two new fixtures use internal slot names (`Northbridge` = home, `Eastport` = away) so the schema, prompt, validators and local rules stay unchanged. The API translates the opinion to slot names before interpretation and translates the whole response back to display names. Consequence: a live Foundry call for a new fixture would see slot-named context. That is unverified, and the context/schema would need fixture-specific team names before a live run on those fixtures.
- **Total request allowance:** none enforced. Token ceiling and timeout are per request only.

### Minimum work for a judge-accessible Foundry experience (PROPOSED, not implemented)

1. A durable counter (for example Azure Table Storage) with conditional writes, checked and incremented *before* each call: total cap and per-client cap, shared across instances and restarts.
2. Failure behaviour: a failed provider call consumes allowance; storage unavailable ⇒ refuse Foundry and fall back to local rules, labelled.
3. An off switch (the existing provider flag, default local) and exhausted/fallback labels (“live-AI allowance used up — answered by local rules”).
4. Fixture-aware team names in the Foundry context/schema for the two new fixtures.
5. Approvals needed: a storage resource, server settings for credentials/caps, enabling the flag on a hosted instance. None has been requested or performed.

### Bounded live acceptance result (application `2343167`)

The authorised six-input run attempted the first three exact inputs and stopped after call 3. The 60′ Return-match answer described 62 minutes as time played in the selected period without distinguishing nominal match-clock minutes from elapsed participation within recorded coverage. Inputs 4–6 were not run; no retries or replacement calls were made. The later offline replay established that the figure is `[1, 63)` elapsed minutes, not post-60′ activity; the original run was stopped on the ambiguous presentation and its record remains unchanged. Calls 1 and 2 returned the expected 57′ contradiction and 58′ support, and the 57′→58′ comparison and copied receipt showed the correct figures, fixture version and Foundry label. The PNG control reported a download, but the harness did not expose the file for byte-level inspection. Full sanitized details, including exact inputs, request timings, token counts, provider and dataset IDs, are in [the live ledger](./foundry-2343167-bounded-live-ledger.json). This small, stopped run does not establish broad Foundry reliability.

### Offline duration follow-up and proposed recheck

Application commit `14bb52314a70370851900726fbf620f0fb42e309` replays the captured call-3 interpretation through the actual Foundry response parser/validation and service using only a stub transport. It confirms that selected match clock 60′ maps to elapsed minute 63; recorded coverage and Saka's participation start at 1′ (elapsed minute 1), giving the half-open elapsed interval `[1, 63)` = 62 minutes. The match-clock labels, recorded coverage and player interval are now separately identified; first-half added time is included and half-time excluded. This corrects the presentation and calculation trace offline; it does not alter or replace call 3 in the original live ledger, and no new live call was made.

The following is a **proposal only**, tied to the exact application commit above. It is not authorized or executed. It is a standalone bounded verification plan, not implementation of a durable hosted request allowance.

| Call | Fixture / dataset | Selected clock; period | Exact browser input | Expected result |
| --- | --- | --- | --- | --- |
| 1 | Original / `northbridge-eastport-analysis-demo` v3.0.0 | 57′; Match so far | `Eastport had more shots on target.` | Same interpreted comparison; contradicted, 2–2 shots on target. |
| 2 | Original / `northbridge-eastport-analysis-demo` v3.0.0 | 58′; Match so far | **Check again** on call 1's saved opinion | Supported; Eastport 3–Northbridge 2; direct comparison with call 1. |
| 3 | Return / `northbridge-eastport-return-demo` v1.0.0 | 60′; Match so far | `Saka has had a horrible game` | Resolve Saka; qualified subjective judgement, recorded contributions and no overall rating. State 62 elapsed participation minutes within the selected recorded window; show match-clock 1′–60′ and elapsed interval `[1, 63)`, added time included and half-time excluded. |
| 4 | Original / `northbridge-eastport-analysis-demo` v3.0.0 | 58′; Match so far | `How many passes did Bruno complete?` | Ask Fernandes or Guimarães; no guessed player or pass count. |
| 5 | Westhaven FC v Kingswell City / `westhaven-kingswell-demo` | 90+4′; Match so far | `Kingswell City had no shots on target.` | Resolve the away team and metric correctly; supported, zero recorded shots on target. |
| 6 | Redmere FC v Alderwick United / `redmere-alderwick-demo` | 88′; Match so far | `Abraham has scored` | Resolve Tammy Abraham for Alderwick United; supported by his recorded 88′ goal. |

Controls: six actual outbound Foundry requests maximum for the whole run, sequentially in this order; no warm-up, retry, replacement call or rerun. Call 2 must use **Check again** on call 1. Stop at the first transport/authentication/HTTP error, schema or semantic-validation failure, truncation, timeout, wrong provider or label, incorrect interpretation/result, or request-count breach; submit nothing further. Verify `foundry` in every response and answer label. After call 2, inspect comparison, copied text, share preview and exported receipt using those existing responses and confirm those actions make zero analyze requests. Confirm dataset/version, player/team identity, selected time, period and future-event cutoff. This proposal does not claim that a Foundry run, the remaining three earlier inputs, a durable allowance, public enablement or native phone sharing has been verified.
