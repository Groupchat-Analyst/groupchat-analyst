# Next-session handoff

Branch `feature/take-investigation` at `ed7d5c7`, pushed (remote tracking in sync, worktree clean when written). All match data is fictional/synthetic.

- Comparison: https://github.com/Groupchat-Analyst/groupchat-analyst/compare/feature/matchday-experience...feature/take-investigation
- Baseline review branch: `feature/matchday-experience` (unchanged; its PR is separate).
- Earlier take-investigation commit: `4a57534`.

## 1. Current state

Implemented: "Checked against" line, explicit "Check again at [time]", immutable in-memory snapshots, deterministic what-changed comparison (dataset id/version gate, qualifications from both snapshots, stricter record-accounting check), "Share what changed" card, conversational server-generated `fanReply`.

### Checks performed

| Kind | What |
| --- | --- |
| Offline (unit/automated) | Web 78 tests, API 161 tests, `tsc`, build, lint, `git diff --check`. Includes dataset mismatch, both-snapshot qualifications, accounting downgrades, no-causal-language and wording regressions. Foundry-path behaviour covered only by offline stubs and captured outputs. |
| Mocked | Failed recheck: one `/api/analyze` call forced to HTTP 500 in the browser. Earlier snapshot stayed, no comparison appeared, a real retry then compared against the original 57′ snapshot. Delayed-answer check used a client-side `fetch` wrapper around the real local answer. |
| Real local API (local interpreter, :7072, not Foundry) | 57′ → 58′ "Eastport had more shots on target than Northbridge." walkthrough (2–2 → 2–3 shots on target, contradicted → supported); edited draft vs saved take; triple-click on Check again sent one request; exported comparison card opened and inspected. |

### Limitations

- No client-side timeout on `/api/analyze`; a request that never completes leaves "Checking…" showing.
- Out-of-order response race not verified in the browser (submit is disabled while pending).
- Dataset-mismatch path verified by unit tests only; the local API serves one dataset.
- No component-level automated tests for App interactions; no real-device or screen-reader testing.
- Local interpreter understands only the long wording "…than Northbridge."; the short wording is covered by an offline stub only.
- Snapshots are session memory only (lost on refresh).
- Foundry behaviour for this milestone is **unverified**. No live calls were made.
- Analyst help text still mentions a pass map when none is shown.

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

Do not run without explicit approval after review. Use the existing server-side Foundry host with the stored configuration; do not print credentials.

| # | Exact take | Clock / period | Expected |
| --- | --- | --- | --- |
| 1 | "Eastport had more shots on target." | 57′, match so far | Interpreted as Eastport vs Northbridge shots on target, match so far through 57′; 2–2; "more" contradicted. |
| 2 | "Eastport had more shots on target." (identical text) | 58′, match so far | Same interpretation; Eastport 3, Northbridge 2; supported. Comparison with #1 should be direct. |
| 3 | "Northbridge parked the bus." | 57′, match so far | Not treated as a statistical verdict or silently mapped to low possession; evidence-limited, qualified response saying the data can't establish defensive shape. |
| 4 | "Bruno scored." | 57′, match so far | Clarification asking whether Bruno Fernandes or Bruno Guimarães; no claim evidence until clarified. |

Controls:

- **Output limits:** keep the existing configured maximum output tokens; do not raise it. Record the value used.
- **Capture:** save sanitized raw outputs (no credentials, headers or endpoints), plus usage tokens and timing per call, to a new local ledger file. Do not alter existing ledgers.
- **Stop conditions:** stop at the first transport/auth error, schema failure, unexpected provider label, or if any call exceeds the agreed timeout. Also stop after call 4.
- **No retries** and no automatic extra calls. Mark any failed call as failed rather than substituting a rerun.
- Confirm the UI/provider label reads Foundry for these calls only.

Four calls cannot establish production reliability: consistency across repeat runs, broad phrasing coverage, failure rate, latency distribution, cost at scale, or parity of Foundry wording with local wording.

## 4. Next actions (priority order)

1. Review this plan before spending any model credits.
2. Resolve any demonstrated release-blocking issues (for example, add an analysis-request timeout only if shown to block the demo).
3. Obtain Rob's feedback and prepare deployment/submission materials.
