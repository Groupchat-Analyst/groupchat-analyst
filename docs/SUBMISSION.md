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
- An accessible language selector provides English, Spanish, French, German and Arabic throughout the interface and receipts. Language changes do not submit or rerun analysis and preserve the active draft and conversation.
- Arabic presentation transliterates every canonical team and player name across all four fixtures without changing identity. Arabic aliases are recognized as input while shared-name ambiguity remains explicit; the original submitted wording stays intact.

## Arabic identity completion (application commit `d61bd5d`)

Arabic generated text now uses correct player interpolation, translated metric and period metadata, count-appropriate forms, localized status and accessibility labels, and fully translated receipt text. The omitted-event count in share cards is localized. Regressions cover fixture-scoped name mappings and aliases, ambiguous Bruno/Martin/Pedro names, direct full-name resolution, metric agreement, metadata and the absence of undefined output.

Offline browser verification used local rules only. In Return (`northbridge-eastport-return-demo` v1.0.0), “كم تمريرة أكمل برونو؟” resolved to Bruno Fernandes at 57′ Match so far with 18 attributed completed passes. The evidence list contains only his records through 53′; no post-cutoff evidence was shown. Expanded details keep the original English records available in a collapsed section labeled as English source wording. Switching Arabic↔French preserved the answer, original wording, unsent draft and selected scope, with zero analysis requests.

The actual Arabic UI download after player selection is a valid 2160×1932 PNG, 409,242 bytes, SHA-256 `600BB8C7ACFCA150F8B1D2A0A8D515CC2E67C8DD8FEFD4D87FE0F87CC8CBF06D`; it was visually inspected for the transliterated player/team identities, original opinion, 18-pass figure, 57′ scope, Return/version, local-provider and user-selection disclosures, event times and RTL mixed-script layout. Desktop and 390×844 mobile emulation were checked; the mobile document width was 375 px with no horizontal overflow.

The inspected Arabic journey had no remaining generated English beyond canonical `Groupchat Analyst` branding, the native language name “English” in the selector, technical IDs/version strings and the explicitly labeled original English source section. This is offline localization verification only, not live multilingual Foundry verification. Independent native-speaker, screen-reader and real-device review remain outstanding. Fixture source blobs match the parent commit; the historical semantic digest was not recomputed.

## Accurate AI architecture

- The public candidate is configured to use a **local rule-based interpreter**. No model is called and no credentials are present.
- An optional Microsoft Foundry structured-output adapter exists, disabled by default. If enabled, the model only interprets wording into a validated structure; all statistics, evidence selection and assessments are computed in application code. Invalid or failed model output is an explicit error, never a guessed answer.
- A bounded live run against application `2343167` made three of six authorised requests and stopped after a time-scope presentation mismatch: at 60′, the Return-match response called 62 elapsed participation minutes “minutes played” in the selected period. The offline repair at application `14bb52314a70370851900726fbf620f0fb42e309` names the figure as elapsed participation within recorded coverage and traces the match-clock and elapsed boundaries. A later authorised run against that repaired application confirmed the corrected call-3 presentation, then stopped at call 4; see both the unchanged [original ledger](./foundry-2343167-bounded-live-ledger.json) and the [later run ledger](./foundry-14bb523-bounded-live-ledger.json).
- A separately authorised run against application `14bb52314a70370851900726fbf620f0fb42e309` made four of six permitted requests and stopped when call 4's Bruno ambiguity interpretation failed semantic validation. Calls 1–3 met expectations; calls 5–6 were not run. See the [sanitized ledger](./foundry-14bb523-bounded-live-ledger.json). This does not establish broad Foundry reliability.

## Verification summary

| Check | Result |
| --- | --- |
| API tests | 363 pass, including captured-call replay, fixture, duration, player-resolution, Arabic identity and language regressions |
| Web tests | 144 pass |
| API/web typecheck, web lint and production build | Pass |
| `git diff --check` | Pass |
| Baseline fixture verification | Fixture source blobs remain unchanged; 70 passes and 17 turnovers. The historical semantic digest is `fb5335ff63f326246b93182dda7adb4462d8b67efd4ce8133ae575f989ee1044` and was not recomputed in this release. |
| Event-detail localization | Structured match events plus representative completed/incomplete passes, linked passes, turnovers and selected pressure records from all four fixtures are covered in Spanish, French, German and Arabic. Comparison details, copied text, receipt SVGs, expanded evidence and labeled English source records are covered. |
| Language matrices | English corpus: 42/42 PASS. Five languages: 30/30 PASS (six asserted behavior classes per language). Broader non-English rule coverage and all live Foundry interpretation are unverified. |
| Browser (local rules) | Existing walkthrough checks remain; all five player-selection flows passed with pointer and keyboard choice, preserving original opinion, language, draft, scope and one conversation turn. Five analysis and five explicit selection API requests; no interpreter call during selection. Explicit retry after an injected failure made no automatic retry or duplicate turn. A→B late success and A→B→A late failure did not alter the new draft, conversation or error state. |
| Arabic receipt | Earlier receipt captures are retained in the historical notes below. For application `d61bd5d`, the UI download anchor produced a 2160×1932 PNG, 409,242 bytes; SHA-256 `600BB8C7ACFCA150F8B1D2A0A8D515CC2E67C8DD8FEFD4D87FE0F87CC8CBF06D`. Visually inspected after selecting Bruno Fernandes in Return v1.0.0: Arabic opinion, 18 completed passes, 57′ Match so far, selected-player identity, team/player evidence, local-provider and no-extra-call disclosures, Arabic event detail and RTL mixed-script layout. |
| Native share on a real phone | **Unverified** |
| Remaining Arabic English | Canonical product branding, the native “English” language name, technical IDs/version strings, and original English records in the explicitly labeled collapsed source section. No other generated English was observed in the inspected journeys. |
| Live multilingual Foundry | **Not run**. Language acceptance used local rules only; no prompt/schema/credential changes. |
| Live Foundry for application `2343167` | 3 requests; calls 1–2 met expectations; stopped after call 3 ambiguously labeled 62 minutes at 60′. Offline replay later confirmed the value as elapsed participation in recorded coverage, not future play. Calls 4–6 not run; no broad reliability claim. |
| Offline call-3 duration repair | Captured interpretation replayed through the real validation/service path with stubbed transport; Fan/Analyst/copy/card-label regressions pass. The repaired call-3 presentation later matched in one bounded live run. The PNG from that Foundry run remains uninspected; the separate local Arabic PNG inspection above does not change that result. |
| Live Foundry for application `14bb523` | 4 requests; calls 1–3 met expectations; stopped after call 4's semantic-validation failure. Calls 5–6 not run. Comparison, copied receipt and share preview checked with existing responses; actual PNG bytes not independently inspected. No additional analysis requests during receipt inspection. |
| Offline Bruno clarification repair (`86dd8d1`) | Exact call-4 capture replays through adapter, validation and service with a stub transport. Six focused regressions and 316 API tests pass; isolated browser replay shows the clarification and Foundry label. No live retest. |

## Event-detail localization release (`c153f14`)

Event descriptions now localize dynamic completed/incomplete passes (including linked-pass wording), incomplete-pass turnovers and selected pressure observations. Actor names are resolved from each fixture’s structured roster. Times, teams, pitch thirds, linked associations and partial/context-only qualifications are retained. The evidence-coverage details for recorded passing and possession losses are localized. Fixture source data was not altered.

Expanded technical records show the translated description and identify the original English source wording explicitly; that source wording and the stable record IDs remain unchanged. The four-fixture regression covers fixture match events and representative structured pass/turnover/pressure details through the conversation evidence path, comparisons, copied card text and generated receipt SVGs in all four non-English languages.

An isolated browser run used the local rule interpreter: one Bruno ambiguity analysis and its existing zero-interpreter-call selection continuation. Locale changes made **zero analysis requests** and preserved the answer, original opinion, draft and then-current replay clock/period. The Arabic receipt was captured from the actual download anchor and visually inspected. The web suite is 140/140; API and web typecheck/build, web lint and `git diff --check` pass. The four canonical fixture sources match the parent commit byte-for-byte; the historical semantic digest was not recomputed.

This was offline localization verification only: no live model or translation calls. Remaining English includes the user’s preserved original wording, proper names, explicitly labeled source text, and non-event interpretation metadata (including the local interpreter’s “What we understood” description). Native-speaker review and real-device sharing remain unverified.

## Multilingual application candidate (`642c6e9`)

English, Spanish, French, German and Arabic now have reusable interface/receipt resources and a bounded local interpretation matrix. Each language passed the same six behavior classes; English additionally passed the 42-case local acceptance corpus. The UI test suite covers translated comparison and receipt content, clarification/errors, provider disclosures, mixed-script Arabic SVG and preserved opinion text. The local browser run confirmed the persisted language preference, RTL direction, state preservation across locale changes, no extra analysis calls, 1280/390/320 px layouts, and visible keyboard focus. Only the Arabic PNG was actually downloaded, decoded and visually inspected.

This is not multilingual Foundry verification. The wider local rule corpus is English-only; non-English interpretation is limited to the documented six cases. Translations have not received independent native-speaker review. No live model calls or external translation services were used.

## Player clarification selection flow (`485440e`)

Ambiguous player claims now receive server-generated full-name/team choices backed by canonical IDs and the selected fixture identity. A signed continuation binds the original opinion, input language, dataset, clock, period, validated claim and candidate set. Selecting a candidate uses the existing validated evidence/statistics path and updates the same conversation turn without another interpreter call. Explicit rechecks retain the chosen identity.

Offline regressions cover both Bruno choices and attributed records, unrelated/foreign/tampered player IDs, scope preservation, mixed answered/unresolved claims, and zero additional provider calls during resolution. The Arabic Bruno opinion is canonicalized only for candidate discovery; the saved user wording remains exact. Player completion replies and the zero-attempt limitation are translated in all four non-English receipt languages.

Browser verification used the local provider only. Each of the five language flows preserved its original input and selected identity; language changes before and during resolution did not submit another request. A simulated 503 required one explicit retry. Delayed late success/failure were tested across A→B and A→B→A navigation. No live Foundry, external translation, Azure or credential changes occurred. A stable `PLAYER_RESOLUTION_SIGNING_KEY` must be configured for production and shared across API instances/restarts; no key is included here.

At that earlier check, the browser automation harness did not expose a download event, so the downloaded bytes were then unverified. The same `svgToPngBlob` export function produced a 2160×1340 Arabic player-selection receipt that was inspected; native sharing on a real device remains unverified. The subsequent release verification below captured the actual download-anchor payload.

## Release verification addendum (application commit `5034094`)

Selection-to-answer and explicit recheck were exercised for both Bruno choices, both “Martin” and “Martín” aliases resolving to Martín Zubimendi/Martin Ødegaard, and “Pedro” resolving to Joao Pedro/Pedro Neto. Player statistics were attributed only to the selected ID, with original time, period and dataset retained; rechecks retained the selected player. Full names for these players bypass selection. In the local browser, the Arabic Bruno flow selected Fernandes at 58′ and rechecked at 83′; the Westhaven flow selected Joao Pedro at 62′ and rechecked at 80′. This uncovered and repaired missing Pedro candidate generation and surname-overlap ambiguity for explicit names.

The latest captured Foundry Bruno interpretation was replayed offline through the real adapter, validation, service and both continuation outcomes with stubbed transport. Exactly one mocked outbound response occurred; resolution added none. Both outcomes retained the original provider and Foundry answer label, with the selected player exposed as user-selected provenance. This is not live Foundry verification.

`PLAYER_RESOLUTION_SIGNING_KEY` format is canonical unpadded base64url for 32 cryptographically random bytes (43 characters). Configure it only in the API server environment and use the same value across instances and restarts. In production (`NODE_ENV=production`), a missing or malformed key fails explicitly with HTTP 502; development without it uses a process-local random key, which can invalidate continuations after worker restart. Signed continuations do not expire. Rotating the key invalidates outstanding continuations; there is no previous-key ring. Automated checks verified missing/malformed configuration, cross-process continuation with a shared test key, altered context/signature rejection and rejection with another key. No production key was generated, printed, committed or configured.

The isolated Azure Functions host restarted its worker because local Azure Storage health was unavailable. A recheck with the intentionally ephemeral development key then correctly failed signature validation; a fresh browser journey with a stable process-only test key passed the 58′→83′ resolved-player recheck. This documents the development limitation and is not a production-secret verification. No Azure resource or configuration was changed.

### Post-deadline public-AI access repair

The separately scoped repair is based on current `Origin/main` (`0f4eb27`) and is not deployed; the currently hosted version remains unchanged. It removes the judge-code gate and enables anonymous Foundry interpretation only through server-side `FOUNDRY_PUBLIC_ENABLED`. The existing Azure Table allowance is used before every outbound attempt, with the owner-authorized `FoundryJudging` table and limits of 200 shared attempts, 200 per client and an 8,760-hour fixed UTC window. Existing stored counts are preserved; startup does not reset them. Failed attempts count and automatic retries remain disabled.

The ordinary analysis route stays local when the server gate is off. Users can explicitly choose local rules, and disabled/unconfigured AI, allowance exhaustion or storage failure presents a localized explanation and local-rules option. No account, payment or access code is required. Foundry credentials and the player-resolution signing key remain server-only.

This is post-deadline access repair work, not the original deployed submission. No merge, deployment, Azure change, credential change or live model request has occurred for this repair. See [the deployment runbook](./DEPLOYMENT_RUNBOOK.md) for exact server settings and the manual release sequence.

Final Stage 2 follow-up (27 October 2026; application commit `2343167`): catalog foreign-team opponents are preserved distinctly and rejected without team attribution, statistics or evidence, and are not sent to a supplied model provider. Uncatalogued comparison opponents now prompt for clarification rather than inheriting the fixture's second team. Valid fixture aliases and descriptive opinions remain covered. Homepage limitations and the compound demonstration route were corrected; the direct guided route was rehearsed with explicit submit/recheck. API 308/308 and web 121/121 pass; baseline hash remains unchanged.

Independent review note: the additional composition repairs have nine regression tests and the complete 42-case local corpus passes. The captured baseline responses also pass through the actual web comparison/share functions offline. Browser rendering could not be independently repeated in the review runtime; the following interaction results are the supplied candidate's reported checks. Native phone sharing remains unverified. The earlier bounded live Foundry run against `2343167` is recorded below and in its linked ledger; it stopped after call 3 and did not verify the remaining inputs.

Browser interaction note: ordinary Playwright pointer clicks (with actionability checks) worked on desktop and 390 px emulation for home, match selection, example, submit, replay controls, Move to 58′, Check again and evidence expansion. The earlier interception was not reproduced; no DOM `click()` was used. Not verified: screen readers, real devices, a full keyboard audit.

## Limitations

- Bounded local wording; shot location is reported as unavailable (shots carry no coordinates). “Before the goal” counts strictly before the resolved goal over all events up to the selected time, not the Last-10-minutes window.
- Sampled fixtures: no tracking, video, xG, running distance or continuous defensive shape.
- Answers live in browser memory; refreshing loses them.
- Previously user-verified deployment: https://polite-smoke-0cfdecd10.3.azurestaticapps.net. This reviewed branch has not been deployed there; record the deployed commit and repeat acceptance after the approved deployment.

## Future vision (not built)

A WhatsApp companion that checks a take from a group chat. No messaging, accounts or chat ingestion exist.

## Outstanding release actions

1. Review the separate post-deadline repair PR to `main`; no PR merge has occurred.
2. Deploy only after owner review and follow [the deployment runbook](./DEPLOYMENT_RUNBOOK.md), including checking the existing `FoundryJudging` counts and backend settings.
3. Perform hosted anonymous-AI and local-rules acceptance after deployment; do not infer hosted Azure or Foundry behavior from offline tests.
4. Real-iPhone check of “Share the receipts” on the hosted build.
5. Continue to describe the previously authorized bounded live runs only by their recorded outcomes below; no live call is authorized by this repair.

### Historical Stage 2 audit findings (repository-only, before the authorised 27 October run)

- **What Foundry supports today:** the structured-interpretation schema and prompt cover the original two matches’ vocabulary (team enums `Northbridge`/`Eastport`, Bruno example). Count assertions (negation, “every”, zero), shot location and the repaired composition forms are implemented in local rules only.
- **Captured outputs:** the genuine `cf10c74` captures still replay through the current validator, service, web comparison and share functions with provider `foundry` (offline replay, not new verification). Constructed transport stubs for the Return fixture and for Westhaven FC v Kingswell City check that the selected fixture supplies events, evidence, calculations and metadata. They are not captures and not live results.
- **Team-name assumptions (Stage 2):** the two new fixtures use internal slot names (`Northbridge` = home, `Eastport` = away) so the schema, prompt, validators and local rules stay unchanged. The API translates the opinion to slot names before interpretation and translates the whole response back to display names. Consequence: a live Foundry call for a new fixture would see slot-named context. That is unverified, and the context/schema would need fixture-specific team names before a live run on those fixtures.
- **At the time of this audit, total request allowance:** none enforced. This was subsequently implemented and is now described in the post-deadline access repair section above.

### Bounded live acceptance result (application `2343167`)

The authorised six-input run attempted the first three exact inputs and stopped after call 3. The 60′ Return-match answer described 62 minutes as time played in the selected period without distinguishing nominal match-clock minutes from elapsed participation within recorded coverage. Inputs 4–6 were not run; no retries or replacement calls were made. The later offline replay established that the figure is `[1, 63)` elapsed minutes, not post-60′ activity; the original run was stopped on the ambiguous presentation and its record remains unchanged. Calls 1 and 2 returned the expected 57′ contradiction and 58′ support, and the 57′→58′ comparison and copied receipt showed the correct figures, fixture version and Foundry label. The PNG control reported a download, but the harness did not expose the file for byte-level inspection. Full sanitized details, including exact inputs, request timings, token counts, provider and dataset IDs, are in [the live ledger](./foundry-2343167-bounded-live-ledger.json). This small, stopped run does not establish broad Foundry reliability.

### Offline duration follow-up and bounded live recheck

Application commit `14bb52314a70370851900726fbf620f0fb42e309` replays the captured call-3 interpretation through the actual Foundry response parser/validation and service using only a stub transport. It confirms that selected match clock 60′ maps to elapsed minute 63; recorded coverage and Saka's participation start at 1′ (elapsed minute 1), giving the half-open elapsed interval `[1, 63)` = 62 minutes. The match-clock labels, recorded coverage and player interval are now separately identified; first-half added time is included and half-time excluded. This offline repair did not alter or replace call 3 in the original live ledger; its corrected presentation was later checked during the bounded live run below.

The following six-input plan was tied to application commit `14bb52314a70370851900726fbf620f0fb42e309`, then explicitly authorized and attempted once on 27 October 2026. Its actual outcome and stop condition are recorded below and in the linked ledger. This one-run authorization is spent; the plan is not reusable authorization and does not implement a durable hosted request allowance.

| Call | Fixture / dataset | Selected clock; period | Exact browser input | Expected result |
| --- | --- | --- | --- | --- |
| 1 | Original / `northbridge-eastport-analysis-demo` v3.0.0 | 57′; Match so far | `Eastport had more shots on target.` | Same interpreted comparison; contradicted, 2–2 shots on target. |
| 2 | Original / `northbridge-eastport-analysis-demo` v3.0.0 | 58′; Match so far | **Check again** on call 1's saved opinion | Supported; Eastport 3–Northbridge 2; direct comparison with call 1. |
| 3 | Return / `northbridge-eastport-return-demo` v1.0.0 | 60′; Match so far | `Saka has had a horrible game` | Resolve Saka; qualified subjective judgement, recorded contributions and no overall rating. State 62 elapsed participation minutes within the selected recorded window; show match-clock 1′–60′ and elapsed interval `[1, 63)`, added time included and half-time excluded. |
| 4 | Original / `northbridge-eastport-analysis-demo` v3.0.0 | 58′; Match so far | `How many passes did Bruno complete?` | Ask Fernandes or Guimarães; no guessed player or pass count. |
| 5 | Westhaven FC v Kingswell City / `westhaven-kingswell-demo` | 90+4′; Match so far | `Kingswell City had no shots on target.` | Resolve the away team and metric correctly; supported, zero recorded shots on target. |
| 6 | Redmere FC v Alderwick United / `redmere-alderwick-demo` | 88′; Match so far | `Abraham has scored` | Resolve Tammy Abraham for Alderwick United; supported by his recorded 88′ goal. |

Controls: six actual outbound Foundry requests maximum for the whole run, sequentially in this order; no warm-up, retry, replacement call or rerun. Call 2 must use **Check again** on call 1. Stop at the first transport/authentication/HTTP error, schema or semantic-validation failure, truncation, timeout, wrong provider or label, incorrect interpretation/result, or request-count breach; submit nothing further. Verify `foundry` in every response and answer label. After call 2, inspect comparison, copied text, share preview and exported receipt using those existing responses and confirm those actions make zero analyze requests. Confirm dataset/version, player/team identity, selected time, period and future-event cutoff.

### Actual bounded Foundry result (27 October 2026; application `14bb523`)

Preflight confirmed the branch was at documentation commit `09b93eac1ce34dcd85083aa56e355ba726baaed2`, application and fixture files matched `14bb52314a70370851900726fbf620f0fb42e309`, and the worktree was clean. An isolated API and UI ran on ports 7417 and 5417 using process-only Foundry/capture overrides; the existing browser service on 5416 and public deployment were left untouched. No warm-up was made.

Four browser submissions produced four Foundry responses and four API analyze invocations, with no retry or replacement request. Calls 1–3 showed the `foundry` provider label and met their expectations:

1. Original (`northbridge-eastport-analysis-demo` v3.0.0), 57′, Match so far: Eastport had more shots on target; contradicted, 2–2.
2. The same saved opinion, rechecked at 58′: supported, Eastport 3–Northbridge 2. The 57′→58′ comparison displayed the updated evidence.
3. Return (`northbridge-eastport-return-demo` v1.0.0), 60′, Match so far: Saka resolved to Bukayo Saka (`north-player-09`); qualified subjective judgement with no overall rating. The 62 minutes were labeled as elapsed participation within recorded coverage, with the selected 1′–60′ match-clock window and elapsed `[1, 63)` trace; added time was included, half-time excluded, and no future events were included.

Call 4 (Original, 58′, “How many passes did Bruno complete?”) was the first failure. Foundry returned structured output recognizing ambiguity between Bruno Fernandes and Bruno Guimarães, but its statistical-request/evidence-request structure failed application semantic validation (`Claim 1 intent does not match its evidence request`). The API returned 502 and the browser displayed an error rather than an answer; therefore no final answer provider label was rendered. Calls 5 and 6 were **not run**, as required by the stop condition.

### Offline Bruno clarification repair (`86dd8d1`)

The captured call-4 output itself—not an older passing capture—was replayed unchanged through the actual Foundry adapter, validator and analysis service with stubbed transport. It had null team and player identity, `playerMetric: pass-completions`, passing evidence, and a non-empty question distinguishing Bruno Fernandes from Bruno Guimarães. The 502 occurred because the clarification-state validator required a null player metric, and a separate condition rejected a populated player metric without an identified player. The earlier passing Bruno capture left the metric null. Validation now permits the requested metric in a strictly constrained statistical clarification: unresolved team/player, no comparison, `other` meaning, non-empty clarification, and evidence matching that metric. It does not assign a player or yield statistics/evidence until identity is resolved.

The offline result preserves the submitted opinion and Original fixture/version at 58′ Match so far, asks which Bruno, and yields no player/team statistics, calculation, pass count, or claim evidence. The isolated browser replay rendered this clarification and the actual Foundry provider label. Regressions retain rejection of missing clarification, incompatible metric/evidence, malformed output, contradictory identity and intent, while confirming explicitly named Bruno Fernandes uses only his attributed records. API build and 316/316 tests pass; focused Bruno cases 6/6 pass. This is an offline repair, not live Foundry verification; no prompts, settings, historical captures, fixtures or the earlier shots/Saka behaviors were changed.

After call 2, the comparison, share preview and copied receipt were checked; the copied text matched the preview and named the fixture/version and Foundry. These inspections made zero additional analysis requests. The PNG button reported a successful download, but the browser harness did not expose a download event and the generated PNG bytes could not be located for independent inspection. This remains unverified. Four calls cannot establish broad Foundry reliability. Full sanitized inputs, figures, timings and token usage are in [the run ledger](./foundry-14bb523-bounded-live-ledger.json); raw captures remain ignored and local. The isolated API/UI were stopped; no application, Azure, credential or public deployment changes were made.

### 1′ starting view and replay acceptance follow-up

The normal match view now starts at 1′. Fixture names and descriptions are neutral, later key-moment labels remain generic until their time is displayed, and prepared examples do not appear before their own recorded time. The 57′/58′ Home walkthrough remains a separate, explicitly illustrative preview. Visible “take” wording was replaced by “opinion” in the Home demo action, comparison headline and README. Dataset IDs, team/player identities, canonical event/evidence fixtures, analysis calculations, selected-time behavior and comparison logic were not rewritten.

#### Fresh-entry matrix and navigation

A fresh local origin had no saved local-storage keys. Home → Try it Out → match selection was exercised for each of the four fixtures in English, Spanish, French, German and Arabic: **20 combinations**. All 20 returned a successful HTTP 200 replay response with the correct dataset ID/version and `selectedTime: 1′`; the scoreboard was 0–0, the event list was empty, later timeline labels were neutral, future prepared examples were hidden, and the empty state was localized. Entry and language selection generated **zero** analysis requests. In Vite development, React StrictMode deliberately performs an effect cleanup/restart: the network log contained 40 replay attempts, 20 aborted development attempts and 20 successful responses. No hidden or automatic retry loop was observed.

Direct fixture links, refresh and browser Back/Forward were checked and restored the correct match at 1′. Desktop and 390×844 mobile Arabic views of Westhaven/Kingswell at 1′ were captured and inspected. Mobile document width was 375 px, with no horizontal overflow. The displayed 0–0 score, selected clock, latest-moment empty state and event-list cutoff all belonged to the returned `westhaven-kingswell-demo` v1.0.0 frame.

#### Explicit local-rules example submissions

| Fixture | Prepared opinion | Selected time / period | Local result |
| --- | --- | --- | --- |
| Original v3.0.0 | `Eastport had more shots on target than Northbridge.` | 57′ / Match so far | Contradicted |
| Return v1.0.0 | `Northbridge had more possession than Eastport` | 88′ / Last 10 minutes | Supported |
| Westhaven v1.0.0 | `Kingswell City had no shots on target.` | 90+4′ / Match so far | Supported |
| Redmere v1.0.0 | `Abraham has scored` | 88′ / Match so far | Supported |

Each opinion was selected from that fixture’s prepared examples and explicitly submitted. The request’s dataset, selected clock and period matched the prepared example; the response carried the same dataset ID/version and selected time with `provider: local`.

#### Replay lifecycle and failure handling

The controller regression deliberately released 20′ before a stale 58′ response after 1′ → 58′ → 20′. Only the 20′ frame remained displayed; fixture identity, time, score, event list and latest event stayed coherent. Additional regressions cover A → B → A late completion, disposal while playing, one playback dwell timer, first-half added time, the 45+3′ → 46′ boundary, the final 90+4′ stop, timeout and explicit-only retry.

A controlled browser failure in the earlier uncommitted run aborted local `/api/replay` and exposed “Failed to fetch.” The repair now replaces transport, HTTP, invalid-frame and timeout details with one shared localized match-loading message and explicit retry, retaining the last valid frame and failed requested clock. Offline controller regressions distinguish transport rejection from HTTP failure; browser injection verified localized failure and retry in all five languages, plus a separate HTTP 503 path. Neither path retries automatically. A pre-existing StrictMode cancellation remains silent. The original failing preview's startup/routing configuration is unavailable in the records; its cause remains **unconfirmed**.

App-owned scrollbars use a thin dark track and muted thumb. Arabic desktop/mobile checks found no horizontal page overflow; horizontal moment chips remained keyboard-focusable and the event list scrolled with keyboard input. A scrollbar supplied by the external preview wrapper is outside the app DOM and was not inspected.

The guided walkthrough was exercised from an ordinary 1′ visit: selecting it prepared 57′ and the opinion without analysis; submit made one request; moving to 58′ made none; recheck made the second request. Both responses used `provider: local`, with the 57′ tie at 2–2 and the 58′ result Eastport 3–Northbridge 2. The comparison and share-card preview were inspected. Desktop guided-comparison, Arabic desktop/mobile, and built-preview smoke screenshots are saved in the current Copilot session's files as `guided-comparison-receipt-58-desktop.png`, `guided-arabic-desktop-full.png`, `guided-arabic-mobile-full.png`, and `built-preview-1-minute-smoke.png`.

The built frontend was served at **http://127.0.0.1:5196/** and browser-tested against the local API: the replay returned HTTP 200 with the expected fixture/version at 1′, 0–0 and no events, with zero analysis requests. Vite `preview.proxy` now mirrors the local `/api` proxy. That bounded smoke server was stopped after the check. The local review preview remains available at **http://localhost:5195/** with the detached Vite server on port 5195 and local Azure Functions API on port 6174, forced to `CLAIM_INTERPRETER_PROVIDER=local`. It is not the publicly hosted site and has not been deployed. Because the original failing preview startup/routing configuration is unavailable, the original failure cause remains unconfirmed; the current local configuration and built-preview path do not establish it.

Final checks for this follow-up: **151/151 web tests**, **363/363 API tests**, web build/typecheck, lint and `git diff --check` passed. Canonical fixture source files were unchanged; the historical semantic digest was not recomputed. Production signing-key configuration, hosted verification, real-phone sharing and remaining Foundry verification are still open. The durable allowance and judge-accessible AI route remain separate, unimplemented work. No live model call, external translation, merge, deployment, Azure change or credential change was made.

Application repair commit: `4d845e3` (`Harden replay navigation and localized recovery`). This documentation update is committed separately for review.

## Post-deadline public-AI access repair (separate branch; not deployed)

The separate `repair/public-ai-access` branch is based directly on fetched `Origin/main` at `0f4eb27`. It removes the judge-code panel and access endpoint; anonymous analysis uses Foundry only when `FOUNDRY_PUBLIC_ENABLED=true` is set in the backend. The user can explicitly select local rules. Exhaustion, unavailable storage and missing Foundry configuration fail closed with localized messaging and a local-rules option. The durable allowance is reserved before each outbound attempt; the existing `FoundryJudging` row/counts are preserved, with the authorized 200 shared / 200 per-client caps and 8,760-hour window. The existing 8,192 completion-token limit, no-retry behavior, server-only credentials and signing key remain.

Checks on this branch: **385/385 API tests**, including **7/7 Azurite assertions**, **160/160 web tests**, API/web builds, web lint and `git diff --check` pass. Tests use stubbed Foundry transport; no new live model request was made. Hosted Azure, hosted Foundry and real-device behavior are not verified. The currently deployed version remains unchanged; no merge, deployment, Azure or credential change has occurred. See [the focused PR description](./PR_DESCRIPTION.md) and [deployment runbook](./DEPLOYMENT_RUNBOOK.md) for backend settings and manual release steps.
