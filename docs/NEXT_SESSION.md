# Next-session handoff

## 0. Latest: `feature/explore-more-matches` (read this first)

Branch from `main` (after PR #7). Commits: `68f98bd` Saka/player-language repair; `fb523a2` second synthetic fixture and integrity validator; `9ba9e25` dataset catalog + API allowlist + `datasetId`; `d59bc27` omitted-opponent and distance phrasing, catalog moments and verified examples; then the web commit (home, match selector, dataset-aware match view, opinion wording, fixture-named share footer) and docs.

- **Datasets:** Original (`northbridge-eastport-analysis-demo` 3.0.0, hash `fb5335ff…` unchanged) and Return (`northbridge-eastport-return-demo` 1.0.0). Metadata lives in `apps/shared/src/datasetCatalog.ts` (also moments and examples); data resolution is `apps/api/src/datasets.ts`. Requests without `datasetId` keep baseline behaviour; unknown IDs fail with 400.
- **Web:** `Shell.tsx` hash-routes `#/`, `#/matches`, `#/match/<id>[/demo]` (`routes.ts`); `MatchView` in `App.tsx` is keyed by dataset so a switch resets draft, answers, comparison, replay and prepared images. Responses and replay frames whose dataset differs from the request are rejected.
- **Checks:** API 207, web 113, `tsc -b`, lint, build, `git diff --check` pass. Browser (desktop + 390 px emulation, local stack): guided 57′→58′, match switch, failure path, switch during a pending request, stubbed native share (1 PNG, no extra analysis call).
- **Language:** [LANGUAGE_ACCEPTANCE.md](./LANGUAGE_ACCEPTANCE.md): 42 inputs, 35 pass, 2 partial, 5 fail (negated goal, pre-goal chronology, “every”, zero shots on target, shot location). “Saka and Rice have been poor” gives a clumsy clarification.
- **Not verified:** native share on a real phone; any live Foundry call for the current work (prompt and schema unchanged; earlier live ledgers belong to the earlier version); keyboard/screen-reader re-test. The browser harness needed DOM `click()` for several controls.
- **Foundry access recommendation and proposed (unauthorised) live set:** [SUBMISSION.md](./SUBMISSION.md).
- **Known gaps:** the captured Foundry replay tests were not extended to the new fixture; no automated component tests for `MatchView`/`Shell`; the home page and match list were not given a separate accessibility audit.

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
