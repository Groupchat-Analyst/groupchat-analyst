# Targeted live verification of frozen Foundry repair c7bdc56

## Frozen application identity

- Application source commit: `c7bdc56cdf8577649616e30405ddbf8b993a9699`.
- This verification branch is created from that commit. Only this plan and the eventual verification ledger may be added; application code, provider prompt, fixture values, and calculation/validation behavior remain frozen.
- Frozen `apps/api/src/providers/foundry.ts` SHA-256: `dc0f565e510ef96cb6fe394f5ffdf7555b901ebc2ef58e2d3f9f024f7c5d2085`; embedded system-prompt text SHA-256: `c6cfb1c6f7e0bdc1dce9022d4f02d6bfb8015edcdd6ce180f5acd051c3588b17`.
- API TypeScript build passed before calls. Local settings were validated in memory as provider `foundry`, deployment `gpt-5-mini`, valid `/openai/v1` endpoint suffix, and a configured credential; no settings values or credentials are recorded.
- Provider configuration expected from ignored local settings: `foundry`, deployment `gpt-5-mini`, Azure OpenAI-compatible `/openai/v1` base URL. Do not record settings values or credentials.
- Run at selected clock `90+4′`, period `match-so-far`, for all four attempts.
- Hard limit: four upstream calls total, sequentially, exactly one per scheduled case. No retry, browser submission, fallback provider request, or other upstream call. Stop if any hidden retry or additional request is observed.
- Enable only the already-implemented local raw-output capture in process memory. The ignored capture file records the original structured response content and available usage. Do not capture prompts, request headers, credentials, or environment values.

## Expected outcomes frozen before requests

| Attempt | Exact input | Expected interpretation and complete-response requirements |
|---|---|---|
| V01 | `Before Northbridge scored at 45+3, how many passes had they completed?` | `statistical-request`; Northbridge passing count; `timePeriod.kind = before-event`; `historicalEventAnchor.eventId = timePeriod.eventId = event-07`. Calculate 14 completed / 18 attempts = 77.8%. Include event-07 as anchor only, exclude it and later records from passing evidence and calculations. Summary answers the count and clearly states the exclusive cutoff. |
| V02 | `Before their first goal, what was Northbridge’s pass completion rate?` | `statistical-request`; subject Northbridge; resolve “their first goal” to Northbridge goal `event-07`; same exclusive scope and anchor. Calculate 14/18 = 77.8%. Explain numerator/denominator and cutoff; no future or anchor event in calculation records. |
| V03 | `Before Northbridge scored at 45+3, how many passes had they completed?` | Exact repeat of V01, with identical selected clock/period. Expect the same statistical intent, event-07 exclusive anchor, 14/18 = 77.8%, and corresponding evidence/calculation trace. Compare semantic interpretation and complete response with V01; wording may vary. |
| V04 | `Did Eastport's goal at 58 minutes come against the run of play?` | `factual-claim`, `historical-circumstance`; anchor/time period `event-10`, Eastport goal at 58′. Strict exclusive cutoff; event-10 and later events excluded from supporting/context evidence, with the goal shown only as anchor. Qualify as insufficient for a firm run-of-play conclusion; no definitive supported/contradicted verdict. State limits of the available possession/territory/chance-quality evidence. |

Expected values were checked before live calls from fixture calculations: strictly before event-07 Northbridge has 14 completed out of 18 attempted passes (77.8%). The historical cutoff excludes event-07 itself and every later record. The Eastport goal at 58′ is event-10; historical run-of-play evidence must exclude that goal and later events.

## Capture and scoring protocol

For every attempt record the exact input and settings (provider/deployment and selected time/period only), timestamp, frozen application identity, raw structured model output, validated response, interpreted claim fields, assessment, summary, limitations, evidence IDs/times/roles, relevant calculation traces and record IDs, HTTP/error classification, elapsed time, and token usage when returned.

Judge meaning, entity, operation, time scope/anchor, arithmetic and denominators, evidence boundaries, and limitations—not only HTTP status. Categorize complete responses as fully correct, accepted-but-wrong, or rejected/failed. Keep each attempt in the denominator. Record repeat consistency separately.

Sanitize response text and ledger for credentials, authorization tokens/headers, environment values, or unrelated personal data before committing. Raw capture remains Git-ignored. This verification is separate from and does not alter any prior evaluation scores. No repair or prompt edit is allowed during or after the four attempts within this run.
