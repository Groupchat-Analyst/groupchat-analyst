# Next-session handoff

## Final repair patch from the independent Stage 2 review (application `2343167`)

- Patch base `f4eae5c` applied cleanly to the same branch/HEAD, with a clean worktree before application. No newer local edits were present.
- Fixed foreign-team resolution across all catalog fixtures: fixture aliases are recognized in one non-cascading pass; aliases from other fixtures are preserved individually and rejected, including when either original team name appears in the opinion. Such opinions are not sent to a supplied model provider and return no attributed team statistics/evidence.
- Unknown explicit comparison opponents now prompt for clarification rather than silently using the current fixture’s other team. Regression coverage checks both team orders, aliases/case, negation, possession and shot comparisons, unsupported teams/players, plus ordinary descriptive and completed-pass comparisons to guard against false positives.
- Homepage limits copy now refers to every fictional match; the 20-second walkthrough has explicit submission for the Return-match compound example, and the direct `/demo` route is documented as part of the guided flow.
- Rehearsed the direct route in browser emulation with the local provider: prepared opinion and 57′ scope with 0 analyze calls; explicit submit=1; replay move=0 additional; explicit 58′ recheck=1 additional. Both expected replies and comparison appeared.
- API build and **308/308 API tests** pass; web typecheck, lint, build and **121/121 web tests** pass. Baseline remains `fb5335ff…1044` (70 passes, 17 turnovers); asserted language matrix remains 42/42 PASS; `git diff --check` clean. No live model call, deployment or Azure change.

## Final Stage 2 review follow-up (application `36ce40c`)

- Reproduced foreign-team handling on Westhaven/Kingswell and Redmere/Alderwick: names from the original fixtures could be read by the local parser as a current-team subject, and different foreign names collapsed into one placeholder. Foreign-team opinions now bypass any supplied model provider, return an explicit unrecognized limitation, preserve each name separately, and carry no team attribution, statistics or claim evidence.
- Fixed slot translation to recognize a fixture alias before checking foreign slot names and to replace internal slot names in one pass, so a display name containing the other slot name cannot cascade into the wrong team. API regressions cover both foreign-opponent orders, provider bypass, distinct fixture aliases and slot-like names.
- Share-card receipts and the homepage illustrative receipt now include the fixture's team pairing as well as fixture title/version; share receipts continue to name the actual provider. Tests cover all four fixture identities and homepage metadata.
- Rehearsed `TEAM_DEMO.md`'s direct route, `#/match/northbridge-eastport-analysis-demo/demo`, in the browser: it prepared the 57′ opinion with 0 analyze calls; explicit submit made 1, moving replay to 58′ added none, and explicit recheck made the second call and showed the expected comparison. The share preview showed `Northbridge v Eastport · Original match v3.0.0 · read by local rules`.
- Final local checks: API 303/303, web 121/121, API build, web typecheck/lint/build and `git diff --check` pass. Baseline remains `fb5335ff…1044` (70 passes, 17 turnovers); asserted language matrix remains 42/42 PASS. No live model calls or deployment.

## Corrected submission brief: Stage 2 (two more fictional fixtures)

- New fixtures: **Westhaven FC v Kingswell City** (`westhaven-kingswell-demo`, goalless: 9 shots/5 on target v 3/0, Kingswell hold the ball late) and **Redmere FC v Alderwick United** (`redmere-alderwick-demo`, goals 33′, 61′ and a 78′ substitute’s 88′ winner; three goals make “before the goal” ambiguous). Rosters are synthetic fixtures using roster-snapshot names (sources/date in `apps/shared/DATA_DICTIONARY.md`). Both pass `validateFixtureIntegrity`; the original two and the baseline hash are untouched.
- Team handling: a slot adapter (`teamNaming.ts`). New fixtures keep internal slots `Northbridge`/`Eastport`; the API translates the opinion in and the response out (display names and aliases such as “Westhaven”). Foreign slot names are preserved individually, explicitly rejected without team attribution or claim evidence, and never sent to a model provider. Web reads team names from the catalog and the response (header, replay validation, pass map, squads, player picker).
- Checks: API 246/246 (`new-fixtures.test.mjs` is new; labelled constructed-stub Foundry test added), web 121/121, tsc/lint/build/`git diff --check` clean, baseline hash `fb5335ff…1044 70 17`, 42-case matrix still runs on the local provider.
- Verified in the browser (emulation, scaled ordinary mouse events): both new fixtures at 1280/390/320 px load with correct names, monograms and score, no horizontal overflow, 0 analyze calls on load; an example only prefills; submit makes one request; the Analyst view, squads and pass map show the fixture’s team names. Screenshots: `s2-home-*`, `s2-matches-*`, `s2-convo-*` (d = 1280 px, m = 390 px).
- Not verified: live Foundry for any fixture (the Foundry path for the new fixtures is offline-stub only and would carry slot-named context), real device, screen reader, native share on a phone. Local rules do not read “completed more passes than” (reported as unrecognised, same as the original match).

## Corrected submission brief: Stage 1 (entry flow and conversation)

- Home: headline “Your mate’s football opinion. Checked.”, one primary action **Try it Out** to `#/matches` (the secondary button and demo shortcut were removed; the `/demo` route still exists). Match tiles show monograms, `Team v Team`, a scenario line and example count.
- Match page is a chat: opinions right, answers left, each labelled with minute and period; “How this was checked” holds the evidence (open in Analyst view); turns accumulate. A failed check adds an error bubble “That check didn’t finish. Please try again.” with **Try again**; earlier turns, comparison and the edited draft stay. Pending text: “Checking the match…”.
- Copy sample (before → after): “Your mate’s got an opinion. Bring the receipts.” → “Your mate’s football opinion. Checked.”; “Try the 57′ → 58′ demo / Explore both matches” → “Try it Out”; “Built for the arguments happening in your group chat.” → “Built for your group chat.”; step 4 “Recheck and share” → “Check again and share”; answer card → conversation.
- Local verification (Playwright emulation, ordinary mouse events, local-rules stack): home, tile, example, replay movement and preview switching made 0 `/api/analyze` calls; submit, recheck and retry made one each. Failed recheck kept turn 1 and the edited draft; retry added exactly one turn (no duplicate). A→B with late success and A→B→A with late failure left a fresh draft untouched and added no turn or error. No horizontal overflow at 1280, 390 or 320 px; “Try it Out” is above the fold at 390 and 320; focus outline 3 px on every tab stop; lowest measured text contrast 6.6:1 (computed on flat backgrounds; gradients not covered).
- Harness limitation found: this browser pane's mouse coordinates are scaled by (set viewport width ÷ `innerWidth`), so Playwright's native `click()` hits the wrong element after `setViewportSize`. Pointer events were sent with coordinates corrected by that factor. Not a product defect. No real device or screen reader; native share still unverified on a real phone.

## Homepage polish (from `b98ac41`)

Scope: homepage only (`HomePage.tsx`, `landing.css`, `Shell.tsx` wiring, small header/nav fixes in `home.css`). Match selector, conversation, analysis, replay, sharing and language behaviour are untouched.

- Hero, two actions (“Try the 57′ → 58′ demo”, “Explore both matches”), disclosure line, 57′/58′ preview switch (chat plus off-white receipt with “Checked at” stamp), four-step journey, WhatsApp-planned section, and an expandable limits explanation.
- The preview is a static model (`apps/shared/src/homePreview.ts`). `apps/api/tests/home-preview.test.mjs` replays both clocks through the real `analyzeOpinion` and fails if figures, fixture version, assessments or reply text drift. Score (1–0 / 1–1) and shots on target (2–2 / N2–E3) are shown as separate figures.
- Browser checks (Playwright emulation, ordinary pointer clicks, local stack): opening the homepage and switching 57′/58′ make 0 `/api/analyze` calls; the primary action prepares the draft with 0 analyze calls, and the guided journey (submit, Move to 58′, Check again) makes exactly 2; the secondary action goes to `#/matches`. No horizontal overflow at 1280, 390 or 320 px. Tab order has a 3 px outline at every stop. Reduced-motion removes the fade-in.
- Limits: emulation only, no real device, no screen reader, native share still unverified on a real phone, no live Foundry calls. Contrast was inspected visually, not measured with a tool.
- Screenshots: session `files/home-polish-{desktop,390,320}[-full].png`, `home-polish-390-58.png`.

## Independent offline follow-up (27 October 2026; review base `b7f40e4`)

The uploaded source archive identifies `b7f40e441ac915ca43b9ea69731aca229b7e5d29`, later than `01f9c25`. The following is a review patch against that snapshot, not a new upstream commit.

- Fixed additional semantic composition failures: ordinary player goal/no-goal assertions, player first-half scoring validation, and zero/universal shot assertions combined with a strict before-goal scope. Player goal assertions keep only that player's goal metric; a teammate's goal cannot establish the assertion.
- Distinguished “not every shot was on target” from “every shot was not on target”. An ambiguous “Bruno has been poor” now asks which Bruno, while separately named players still receive separate assessments.
- Before-goal count replies keep the exclusive goal anchor and omit internal event IDs from their prose. No interface, fixture, catalog, Foundry prompt/schema or model setting changed.
- Added `apps/api/tests/semantic-composition.test.mjs`: nine regression tests with positive, negative, temporal, entity and ambiguity variants.
- Independent Node **22.23.3** verification: API **230/230**, web **113/113**, typechecking, lint and production build pass. The 42 documented language inputs pass through the real local service path. Genuine baseline Foundry captures were replayed through the current API and actual web snapshot/comparison/share functions: direct contradicted→supported comparison, correct Foundry footer. The second fixture's separately labelled constructed-stub tests also pass. None of these are live model calls.
- The complete baseline evidence object was compared with the uploaded snapshot and is unchanged (70 passes, 17 turnovers). The original fixture, catalog, Foundry adapter and historical ledgers were preserved.
- Local follow-up after applying the patch to `b7f40e4` (local-provider stack, desktop viewport, ordinary Playwright pointer clicks, no DOM `click()` fallback needed): API 230/230, web 113/113, build, lint, `git diff --check` and the baseline hash pass. In the browser, “Saka has not scored” (57′, Original) answers “No — Bukayo Saka has 1 recorded goal”; “Northbridge had no shots on target before the goal” counts strictly before the 45+3′ goal (1 on target of 2); “Saka scored in the first half” answers Yes at 45+3′; “Bruno has been poor” asks which Bruno; on the Return match “Saka has not scored” answers from that fixture. The 57′→58′ walkthrough still compares (didn't hold → holds; Eastport 3 shots on target to 2), the share footer reads “Original match v3.0.0 · read by local rules”, and `/api/analyze` was called only on explicit submit and recheck. Not repeated: 390 px mobile emulation, keyboard audit, PNG download. Real-iPhone native sharing stays unverified.
- Browser verification limitation (review runtime): its cloud browser could not reach localhost, so the independent review claimed no rendered checks; the local follow-up above covers the affected replies only.
- No live calls, merges, deployments or Azure changes. The review environment has no authenticated GitHub checkout, so the patch must be applied, committed and pushed from the existing `feature/explore-more-matches` checkout, preserving any newer work.

## 0. Latest: `feature/explore-more-matches` (read this first)

Branch from `main` (after PR #7). Commits: `68f98bd` Saka/player-language repair; `fb523a2` second synthetic fixture and integrity validator; `9ba9e25` dataset catalog + API allowlist + `datasetId`; `d59bc27` omitted-opponent and distance phrasing, catalog moments and verified examples; then the web commit (home, match selector, dataset-aware match view, opinion wording, fixture-named share footer) and docs.

- **Datasets:** Original (`northbridge-eastport-analysis-demo` 3.0.0, hash `fb5335ff…` unchanged) and Return (`northbridge-eastport-return-demo` 1.0.0). Metadata lives in `apps/shared/src/datasetCatalog.ts` (also moments and examples); data resolution is `apps/api/src/datasets.ts`. Requests without `datasetId` keep baseline behaviour; unknown IDs fail with 400.
- **Web:** `Shell.tsx` hash-routes `#/`, `#/matches`, `#/match/<id>[/demo]` (`routes.ts`); `MatchView` in `App.tsx` is keyed by dataset so a switch resets draft, answers, comparison, replay and prepared images. Responses and replay frames whose dataset differs from the request are rejected.
- **Checks:** API 221, web 113, `tsc -b`, lint, build, `git diff --check` pass. Browser (desktop + 390 px emulation, local stack): guided 57′→58′, match switch, failure path, switch during a pending request, stubbed native share (1 PNG, no extra analysis call). Native pointer clicks (Playwright locator clicks with actionability checks) succeeded for home, match list, example, submit, replay controls, Move to 58′, Check again, Analyst toggle and evidence expansion on both viewports; the earlier interception was not reproducible, so no DOM `click()` was used this time. State preservation (forced-500 recheck keeps answer/snapshots/comparison/draft with a working Try again; held requests Match A→B and A→B→A, late success and late failure never overwrite a fresh draft or show an old answer) was checked in the browser with intercepted routes.
- **Browser checks on the new fixtures (emulation, ordinary pointer clicks; no real device, no screen reader):** Westhaven→Redmere, Westhaven→Redmere→Westhaven, Redmere→Westhaven and Redmere→Westhaven→Redmere with a fresh draft typed before releasing the held `/api/analyze` request, released both as a real success (`continue`) and as a 503: each made exactly one request, left the fresh draft untouched, added no turn and showed no error. A failed recheck at 58′ (503) kept the 57′ answer and the edited draft and showed “Try again”; retry sent one request using the saved opinion, produced one 58′ turn and the what-changed comparison, and left the edited draft. The replay control, navigation and examples made no analyze call. Exports for both new fixtures (copied reply, copied card text, share preview, and the real PNG blob the Download button generates, 543 KB and 457 KB `image/png`) carry display names, original wording, dataset/version (“Late winner v1.0.0”, “Goalless match v1.0.0”), 57′ and “read by local rules”, with no Northbridge/Eastport text. Harness notes: native element clicks missed after a viewport resize, so coordinates were scaled by width/innerWidth and `page.mouse.click` used; the download event is not emitted by this browser tool, so the anchor download was intercepted in-page and the blob rendered as an image (the saved screenshots show it); the PNG itself was not saved as a file. Native sharing on a real phone remains unverified.
- **Language:** [LANGUAGE_ACCEPTANCE.md](./LANGUAGE_ACCEPTANCE.md): 42 inputs, 42 pass, 0 partial, 0 fail under local rules, asserted in `language-matrix.test.mjs` and `topic-context.test.mjs`. Foundry interpretation of the repaired forms is unverified.
- **Not verified:** native share on a real phone; any live Foundry call for the current work (prompt and schema unchanged; earlier live ledgers belong to the earlier version); screen-reader use and real devices. Keyboard Tab order was exercised only through the ordinary browser journey, not a full audit.
- **Foundry access recommendation and proposed (unauthorised) live set:** [SUBMISSION.md](./SUBMISSION.md).
- **Known gaps:** the Return fixture has constructed offline transport-stub coverage, not genuine Foundry captures from that fixture; no automated component tests for `MatchView`/`Shell`; the home page and match list were not given a separate accessibility audit.

The sections below are the earlier handoff, kept for history.

**Hackathon candidate (current):** see [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) and [PR_DESCRIPTION.md](./PR_DESCRIPTION.md). Hosting is now planned as **public, no sign-in, local provider only**; the earlier invited-`preview-user` plan is archived as [PRIVATE_PREVIEW_PLAN_SUPERSEDED.md](./PRIVATE_PREVIEW_PLAN_SUPERSEDED.md), and the long former README is [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md). Section 1c's deployment notes below describe the earlier invited-access arrangement and are superseded by the runbook. Nothing has been deployed; feature development is frozen.

Application code at `feature/take-investigation` commit `76e3037` (timeout fix `41edbc8`, handoff `8f2bbaf`, comparison safeguards `ed7d5c7`); later repairs are listed in sections 1a–1c. All match data is fictional/synthetic.

- Comparison: https://github.com/Groupchat-Analyst/groupchat-analyst/compare/feature/matchday-experience...feature/take-investigation
- Baseline review branch: `feature/matchday-experience` (unchanged; its PR is separate).
- Earlier take-investigation commit: `4a57534`.

## 1. Current state

Implemented: "Checked against" line, explicit "Check again at [time]", immutable in-memory snapshots, deterministic what-changed comparison (dataset id/version gate, qualifications from both snapshots, stricter record-accounting check), "Share what changed" card, conversational server-generated `fanReply`.

### Checks performed

| Kind | What |
| --- | --- |
| Offline (unit/automated) | Web 85 tests, API 164 tests (includes the 8192 ceiling and token-limited-response tests), `tsc`, build, lint, `git diff --check`. Includes dataset mismatch, both-snapshot qualifications, accounting downgrades, no-causal-language and wording regressions. Foundry-path behaviour covered only by offline stubs and captured outputs. |
| Mocked | Failed recheck: one `/api/analyze` call forced to HTTP 500 in the browser. Earlier snapshot stayed, no comparison appeared, a real retry then compared against the original 57′ snapshot. Delayed-answer check used a client-side `fetch` wrapper around the real local answer. |
| Real local API (local interpreter, :7072, not Foundry) | 57′ → 58′ "Eastport had more shots on target than Northbridge." walkthrough (2–2 → 2–3 shots on target, contradicted → supported); edited draft vs saved take; triple-click on Check again sent one request; exported comparison card opened and inspected. |

### Limitations

- ~~No client-side timeout~~ **Fixed:** `/api/analyze` now has a 45 s client deadline (`apps/web/src/analysisClient.ts`; the Foundry provider gives up at 30 s). On timeout the browser request is aborted, late completions are ignored, and an explicit "Try again" is offered (no automatic retry). The earlier answer, snapshots, comparison and edited composer text are kept. The abort does not guarantee the server or model stopped working. Verified offline (unit tests with injected timers) and in the browser against the local interpreter with a temporary 3 s deadline (reverted); the 45 s value itself was not exercised end to end.
- Out-of-order response race not verified in the browser (submit is disabled while pending).
- Dataset-mismatch path verified by unit tests only; the local API serves one dataset.
- No component-level automated tests for App interactions; no real-device or screen-reader testing.
- Local interpreter understands only the long wording "…than Northbridge."; the short wording is covered by an offline stub only.
- Snapshots are session memory only (lost on refresh).
- Foundry behaviour: only the bounded four-call `cf10c74` run (ledger `docs/take-investigation-foundry-verification-ledger.json`, commit `e64c08d`, unchanged) has touched live Foundry; four calls do not establish reliability. See section 1a for what has since been repaired offline.

## 1a. Defects from the cf10c74 Foundry run and their repairs

Repairs are verified **offline by captured-output replay** (the recorded structured outputs, committed as `apps/api/tests/fixtures/foundry-cf10c74-interpretations.json`, replayed through the real `analyzeOpinion` path with a stubbed transport). This is not live Foundry verification; no model calls were made. The ledger and prompts/settings are untouched.

1. **Equivalent-claim comparison.** The web comparison key included model prose, so the two shots outputs (different `text`) were shown as separate answers. Prose is now excluded when a structured comparison exists (subject, players, metric, operator, intent, category, evidence, period and dataset gates are unchanged); claims without a structured comparison still need identical wording, otherwise they stay separate.
2. **"Parked the bus" Fan wording.** A possession-majority template fired for any subjective judgement requiring possession evidence. It now applies only when the claim wording concerns possession/dominance/control and not defensive shape; defensive-shape judgements get an insufficient-evidence reply that says shape/positioning is not recorded and possession doesn't show how a side set up. The wording-based test is a bounded heuristic, not a tactical interpreter.
3. **Bruno clarification.** Validation rejected a statistical request with no resolved subject. It now accepts one only as an explicit clarification state (subject, player and player metric all null, no comparison, non-empty `clarificationNeeds`, pass-related evidence). Executable claims, guessed player metrics and mismatched evidence are still rejected. The reply is the Fernandes/Guimarães question with no pass count.

Replay results: 57′ shots → contradicted ("No — … level on 2 shots on target each."); 58′ → supported ("Yes — Eastport have 3 … to Northbridge's 2."); parked the bus → insufficient evidence with no possession figure; Bruno → clarification needed. Call 1's *live* assessment label was never captured and remains **unverified**; the replay label comes from the deterministic server on the captured interpretation. A new live run would be needed to confirm the repaired behaviour end to end with Foundry. Web 87 tests and API 171 tests pass.
- ~~Analyst help text mentions a pass map when none is shown~~ Fixed: it now mentions the pass map only for passing-related claims.

## 1b. Live confirmation run at 90b7e97 (three of four authorised calls; stopped)

Ledger: `docs/take-investigation-90b7e97-foundry-verification-ledger.json`; artifacts in `docs/verification-artifacts/take-investigation-90b7e97/` (full API responses, desktop and emulated-mobile screenshots, exported what-changed PNG). Browser-driven, gpt-5-mini, 8192 ceiling, 30 s provider timeout, no retries. Known usage 13,937 tokens (11,642 prompt, 2,295 completion).

- Call 1 (57′): contradicted, 2–2, "No — … level on 2 shots on target each." Call 2 (Check again, 58′): supported, Eastport 3 / Northbridge 2. A **direct** 57′→58′ comparison was produced from the real responses; copied text, preview and the opened PNG agree.
- Call 3 ("Northbridge parked the bus." at 57′): Fan reply is evidence-limited with no possession template, **but** the "Checked against" line reads "Northbridge · % possession" and the claim card shows only possession figures, which presents possession as the checked metric. Treated as a required-behaviour failure, so **call 4 (Bruno) was not run** and the clarification repair remains verified by captured replay only. Minor: the Analyst help text mentions a pass map for this claim.
- Open item before any further live run: derive "Checked against" and displayed figures for unsupported tactical judgements so they do not name possession as the metric (no code changed in this run).
- Mobile screenshot is viewport emulation, not a real device.

## 1c. Tactical-assessment presentation repair (offline replay, NOT new Foundry verification)

Commit 32d32b0 repairs the call-3 presentation. Verified only by replaying the captured call-3 interpretation/response through the real application path (API tests with a stubbed provider; browser render of the replayed response through a local-provider stack with the analysis request route-fulfilled from the fixture). No model calls were made; call 4 (Bruno) has still never run live.

- Unsupported tactical judgement (subjective intent, "insufficient evidence", `territorial-control` unavailable) now reads "Checked against Northbridge · defensive shape and positioning (not recorded, so no verdict) · …". Possession figures remain but are labelled "Context only — can't establish defensive shape or positioning" in Fan, Analyst, copied text and share card.
- The Fan reply and the claim display quote the user's wording, not the model paraphrase. Pass-map help/map appear only for non-subjective passing claims.
- A genuine possession question keeps normal "Checked against … possession" and "Key facts"; the 57′/58′ shots pair still compares directly.
- Remaining limitations: the API limitation text still quotes the model's `meaning.description` ("…prevent a firm conclusion about "The claim judges…"") because historical replay tests pin that string; the server `summary` still quotes the paraphrase; with several claims a paraphrase that is not a substring of the opinion falls back to `claim.text`; mismatch detection in `service.ts` is regex-based.

### Deployment preparation (inspected, nothing deployed)

1. Source/workflow: `.github/workflows/shared-preview.yml` ("Deploy shared preview"), `workflow_dispatch` only, job guarded by `github.ref == 'refs/heads/main'`, checks out `main`, deploys `apps/web` + `apps/api` to Azure Static Web Apps. Hosting the current app therefore requires this branch merged to `main`.
2. Prerequisites: `origin/main` (9d81c6b) contains **none** of the workflow, `staticwebapp.config.json` or `TEAM_DEMO.md`; the branch is 0 behind / 37 ahead. Needs review/merge to `main`, Azure Static Web App (Free, deployment source "Other"), repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN`, write-access restriction and `main` protection (no GitHub environment/approval gate on the current plan).
3. Judge access: Entra sign-in; `staticwebapp.config.json` limits `/*` and `/api/*` to role `preview-user`, invited manually per user; verify an uninvited account is denied first. Revocation: remove the role.
4. Foundry settings: not configured and intended to stay disabled. Would be Static Web App application settings (`CLAIM_INTERPRETER_PROVIDER`, `FOUNDRY_OPENAI_BASE_URL`, `FOUNDRY_API_KEY`, `FOUNDRY_MODEL_DEPLOYMENT`); preview uses `CLAIM_INTERPRETER_PROVIDER=local`. Local dev uses git-ignored `apps/api/local.settings.json`.
5. Spend/request controls: role gate, 30 s provider timeout, 8192 completion-token ceiling, no retries, and a 45 s Static Web Apps request limit. **Gap:** no per-user/per-request quota, daily cap or kill switch in the API, and Azure budgets only alert. Do not enable Foundry on a hosted preview until such limits exist. Note: hosted Foundry would also rely on the 30 s provider timeout fitting inside the 45 s platform limit.



Current walkthrough is **local-provider verified** (local interpreter), not Foundry verified. Use the long wording locally.

| Time | Beat |
| --- | --- |
| 0:00–0:15 (15s) | The problem: football arguments in group chats run on opinion; nobody checks the take against the match. |
| 0:15–0:35 (20s) | At 57′ (Northbridge 1–0), submit "Eastport had more shots on target than Northbridge." Answer: no, level on 2 each. Point to the "Checked against" line. |
| 0:35–0:55 (20s) | Replay to 58′ (equaliser). Press "Check again at 58′" explicitly; nothing auto-submits. |
| 0:55–1:10 (15s) | Explain what changed: now 3 to 2, new recorded Eastport shot at 58′; the tally is not a reason. |
| 1:10–1:35 (25s) | Switch to Analyst: before/after figures, windows, evidence records, coverage. Open "Share what changed" preview and download the receipt. |
| 1:35–1:50 (15s) | Vision only, **not implemented**: a messaging companion that brings this into the group chat. No messaging, accounts or chat ingestion exist today. |

## 2a. Guided demo and native sharing (branch feature/submission-clarity)

- "See how one minute changes the take" appears only in the untouched initial state. It seeks the replay to 57′, sets Match so far and fills the draft; it never submits. A compact "Move to 58′" appears after a relevant 57′ answer, and the existing "Check again" appears only once 58′ is committed.
- "Share the receipts" (single card and what-changed card) is shown only where `navigator.canShare({files})` is true. It reuses the download PNG, prepared ahead of the tap and keyed by card content; cancellation is silent; copy/download remain. No delivery is claimed. Sharing makes no analysis requests.
- Verified: unit tests, local-provider browser journey (desktop and 390 px emulation), forced-500 failure path, and request counting with a stubbed `navigator.share`. **Native share is unverified on a real device** until tested on an iPhone against the hosted candidate.

## 3. Proposed Foundry plan (NOT AUTHORISED FOR EXECUTION)

Do not run without explicit approval after review. Use the existing server-side Foundry host with the stored configuration; do not print credentials. All four use **Match so far**.

Provider settings (from source and the git-ignored local settings; values only, no secrets): deployment `gpt-5-mini`; strict JSON-schema Chat Completions; **`max_completion_tokens: 8192`** (added after `41edbc8`; previously no ceiling); provider timeout **30 s** (fixed in code); **no retries** (a single `fetch`, no SDK, no retry loop); no reasoning setting sent. Browser deadline 45 s. Truncation (`finish_reason: length`) is rejected as `incomplete-output` even if the partial content parses (offline-tested).

| # | Exact take | Clock | Expected |
| --- | --- | --- | --- |
| 1 | "Eastport had more shots on target." | 57′ | Eastport vs Northbridge shots on target, match so far through 57′; 2–2; "more" contradicted. If Foundry instead asks for clarification, record it as a **demo limitation**; do not convert it into another claim. |
| 2 | "Eastport had more shots on target." (identical text) | 58′ | Same interpretation; Eastport 3, Northbridge 2; supported; direct comparison with #1. Same clarification rule. |
| 3 | "Northbridge parked the bus." | 57′ | No definitive verdict; not silently mapped to low possession; qualified, evidence-limited response saying the data can't establish defensive shape. |
| 4 | "How many passes did Bruno complete?" | 58′ | Clarification asking Bruno Fernandes or Bruno Guimarães; no pass count until resolved. |

Controls:

- **Output limit:** 8192 completion tokens, set in code. Record `completion_tokens` per call from the usage the server already logs.
- **Capture:** `FOUNDRY_CAPTURE_RAW_OUTPUT=true` via the server environment for the bounded run only (stored settings unchanged). It writes timestamp, the model's structured output string and token usage to `apps/api/.local-captures/foundry-raw-output.jsonl` (git-ignored). It does not record credentials, headers, endpoint, deployment or the request. It does **not** record timing, finish reason or the provider label, so capture those by hand. Captured output can echo the take text. It is written only after an HTTP 2xx, so transport, auth and timeout failures leave no capture. Delete or move the file after review; do not commit it.
- **Stop conditions:** stop at the first transport/auth failure, schema failure, truncation (`incomplete-output`), wrong provider label, 30 s timeout, or a materially incorrect interpretation. Also stop after call 4.
- **No retries**, no manual re-submits (including the UI "Try again"), no automatic extra calls. Mark a failed call as failed rather than rerunning it.
- Confirm the UI/provider label reads Foundry for these calls only.

Four calls cannot establish production reliability: consistency across repeat runs, broad phrasing coverage, failure rate, latency distribution, cost at scale, or parity of Foundry wording with local wording.

## 4. Next actions (priority order)

1. Review this plan before spending any model credits.
2. Resolve any demonstrated release-blocking issues.
3. Obtain Rob's feedback and prepare deployment/submission materials.
