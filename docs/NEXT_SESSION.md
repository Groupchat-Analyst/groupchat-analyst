# Next-session handoff

Application code at `feature/take-investigation` commit `76e3037` (timeout fix `41edbc8`, handoff `8f2bbaf`, comparison safeguards `ed7d5c7`). All match data is fictional/synthetic.

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

## 2. Demo outline (110 seconds maximum)

Current walkthrough is **local-provider verified** (local interpreter), not Foundry verified. Use the long wording locally.

| Time | Beat |
| --- | --- |
| 0:00–0:15 (15s) | The problem: football arguments in group chats run on opinion; nobody checks the take against the match. |
| 0:15–0:35 (20s) | At 57′ (Northbridge 1–0), submit "Eastport had more shots on target than Northbridge." Answer: no, level on 2 each. Point to the "Checked against" line. |
| 0:35–0:55 (20s) | Replay to 58′ (equaliser). Press "Check again at 58′" explicitly; nothing auto-submits. |
| 0:55–1:10 (15s) | Explain what changed: now 3 to 2, new recorded Eastport shot at 58′; the tally is not a reason. |
| 1:10–1:35 (25s) | Switch to Analyst: before/after figures, windows, evidence records, coverage. Open "Share what changed" preview and download the receipt. |
| 1:35–1:50 (15s) | Vision only, **not implemented**: a messaging companion that brings this into the group chat. No messaging, accounts or chat ingestion exist today. |

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
