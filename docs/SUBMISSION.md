# Submission summary

## What it is

Groupchat Analyst checks football opinions against recorded match evidence. You type an opinion, choose a moment in a fictional replay, and get an answer that shows how the opinion was understood, the evidence for and against, the limits of that evidence, and a shareable receipt. Move the clock, check again, and see what changed.

Both Northbridge v Eastport matches, their events and player performances are fictional. Player names are used in invented scenarios; the figures are not real player-performance data.

## What works today

- Home page, match selection (Original match, Return match) and a match view with replay controls, key moments and verified example opinions that only prefill.
- Opinion → structured meaning → server-side evidence and calculation → Fan or Analyst explanation. Multiple claims are separated; ambiguity gets a clarification; unavailable physical data, injuries and predictions get explicit limits.
- Broad opinions (for example “Saka has had a horrible game”) get the player’s recorded contributions with no rating.
- “Check again” at a later minute produces a deterministic comparison; the card, copied text and PNG are built from the same content and name the fixture, version and how the opinion was read.
- Dataset selection is allowlisted server-side. Omitting `datasetId` selects the original match; unknown or malformed IDs are rejected.

## Accurate AI architecture

- The public candidate is configured to use a **local rule-based interpreter**. No model is called and no credentials are present.
- An optional Microsoft Foundry structured-output adapter exists, disabled by default. If enabled, the model only interprets wording into a validated structure; all statistics, evidence selection and assessments are computed in application code. Invalid or failed model output is an explicit error, never a guessed answer.
- Foundry has only had small live runs on earlier application versions (ledgers in `docs/`). Captured outputs are replayed offline through the real validation path; that is not live verification.

## Verification summary

| Check | Result |
| --- | --- |
| API tests | 230 pass after the independent offline review (Node 22.23.3) |
| Web tests | 113 pass after the independent offline review (Node 22.23.3) |
| Baseline fixture hash | Unchanged (`fb5335ff…`) |
| Browser (desktop + 390 px emulation, local stack) | Guided 57′→58′ journey, match switching, failure path, pending-request switch, stubbed native share |
| Language matrix | 42 inputs: 42 pass under local rules ([docs/LANGUAGE_ACCEPTANCE.md](./LANGUAGE_ACCEPTANCE.md)); Foundry interpretation of the repaired forms unverified |
| Native share on a real phone | **Unverified** |
| Live Foundry for the current work | **None** |

Independent review note: the additional composition repairs have nine regression tests and the complete 42-case local corpus passes. The captured baseline responses also pass through the actual web comparison/share functions offline. Browser rendering could not be independently repeated in the review runtime; the following interaction results are the supplied candidate's reported checks. Native phone sharing and live Foundry remain unverified.

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

### Proposed fixed live acceptance set (execution NOT authorised)

Six calls, one run, no retries, stopping at the first failure, on the current prompt/schema:

1. “Saka has had a horrible game” — Original, 57′ (player-aware broad opinion).
2. “Saka’s passing has been poor” — Return, 70′ (no-benchmark passing).
3. “Northbridge did not score in the first half” — Original, 57′ (negation). Note: the Foundry schema is unchanged, so this tests how the model expresses it, not the local count-assertion path.
4. “Every Eastport shot was on target” — Original, 57′ (quantifier; same note).
5. “Eastport had more possession than Northbridge but Northbridge had more shots” — Return, 90+4′ (multiple claims, differing metrics).
6. “How many passes did Bruno complete?” — Original, 58′ (clarification regression).

Record the interpretation, provider, assessment, timing and any token usage in a new sanitised ledger.
