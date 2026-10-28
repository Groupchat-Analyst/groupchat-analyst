# Complete localized player clarification and controlled Foundry allowance

## Summary

This PR extends the already-merged four-fixture replay release with end-to-end player clarification, localized squad/evidence presentation, an explicitly gated Foundry judge path, and a persistent Azure Table request allowance. The ordinary public experience remains on local rules.

Final application commit: `c31c274c1323a71efca99dac6c586500df3eaaca` on `feature/explore-more-matches`.

The feature branch was normally merged with current `Origin/main` at `b2f781de81b37aedd58f681263639d44dbde4abf`. The merge completed without conflicts. `git diff Origin/main...HEAD` is the candidate scope; it preserves the changes already released in PR #8 and adds the branch changes listed below. No rebase, reset, force-push, release-PR merge or deployment was performed.

## Changes beyond current main

- Complete player clarification for statistical and judgement questions, localized squad/player identities and correct player-attributed responses. Resolution continues through the server-validated signed continuation without a second interpreter request.
- Localized structured evidence details and presentation for the supported five display languages, including Arabic identities and RTL.
- Keep ordinary public analysis on local rules. Add a separate, server-authorized judge AI entry with a backend-configured code and server-selected Foundry provider.
- Reserve shared-total and per-client request allowance in Azure Table Storage with conditional ETag updates before each outbound attempt. Fail closed for invalid credentials, absent or invalid configuration/storage, and exhausted allowance. Failed/timed-out attempts count; no automatic retry.
- Separate `FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING` from Functions host `AzureWebJobsStorage`.
- Add an Azurite integration using the real Azure Table client/transport, with concurrent independent-process reservations, ETag conflicts, restart persistence, serialization, exhaustion and fail-closed coverage.

The four synthetic fixtures, ordinary 1′ starting frame, guided 57′→58′ comparison, existing replay safeguards, Fan/Analyst evidence, and receipt behavior are retained.

## Verification

- API: **386/386 tests** pass; TypeScript build passes.
- Azurite: **7/7 integration assertions** pass against the actual Azure Table SDK and local emulator, with Foundry transport stubbed. Coverage includes entity serialization and update, exhausted limits, real stale ETag/412 and retry, two Node processes attempting beyond the shared ceiling, restart persistence, invalid access without reservation, missing table/storage failure/exhaustion without a model attempt, and counting a failed outbound attempt without retry.
- Web: **160/160 tests** pass; TypeScript build, lint and production build pass.
- `git diff --check` passes.
- Production dependency audit is clear. The development dependency audit reports nine findings (six high, three moderate) in Azurite's development-only transitive dependency tree; the available forced downgrade is breaking. No production dependency version changed.
- The judge access input was inspected: it is a visible `type=password` field with `autocomplete=off`. Masking does not make it private from the person entering it or prevent inspection in their browser.

## Backend configuration

The public deployment must keep `CLAIM_INTERPRETER_PROVIDER=local`, `NODE_ENV=production` and a production `PLAYER_RESOLUTION_SIGNING_KEY`. Controlled Foundry remains disabled until its infrastructure, owner-approved allowance and verification gates are ready.

| Backend setting | Required value/format | Purpose |
|---|---|---|
| `CLAIM_INTERPRETER_PROVIDER` | `local` | Keep public analysis on deterministic local rules. |
| `NODE_ENV` | `production` | Enforce production signing-key validation. |
| `PLAYER_RESOLUTION_SIGNING_KEY` | 32 cryptographically random bytes, canonical unpadded base64url (43 characters) | Server-only HMAC signing key; identical across API instances and restarts. Production has no process-local fallback. |
| `FOUNDRY_JUDGE_ENABLED` | `false` until explicitly approved; then literal `true` only for the authorized window | Server-side feature gate. |
| `FOUNDRY_JUDGE_ACCESS_CODE` | Separate 32–128-character code using letters, digits, `_` or `-` | Shared judge credential, validated server-side; never reuse the signing key. |
| `FOUNDRY_OPENAI_BASE_URL` | HTTPS Foundry OpenAI-compatible endpoint URL | Server-side Foundry endpoint. |
| `FOUNDRY_API_KEY` | Credential issued for the approved deployment | Server-side Foundry credential. |
| `FOUNDRY_MODEL_DEPLOYMENT` | Exact deployment name | Foundry model/deployment selector. |
| `FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING` | Azure Storage connection string with Table service access | Dedicated server-side allowance store connection; same account/table across API instances. Do not repurpose `AzureWebJobsStorage`. |
| `FOUNDRY_ALLOWANCE_TABLE_NAME` | Existing table matching `[A-Za-z][A-Za-z0-9]{2,62}`; defaults to `FoundryRequestAllowance` | Names the owner-provisioned allowance table; application does not create it. |
| `FOUNDRY_ALLOWANCE_MAX_REQUESTS` | Owner-approved positive integer | Authoritative shared maximum outbound attempts per fixed UTC window. |
| `FOUNDRY_ALLOWANCE_MAX_PER_CLIENT` | Owner-approved positive integer no greater than the shared maximum | Supplementary client bucket maximum. |
| `FOUNDRY_ALLOWANCE_WINDOW_HOURS` | Owner-approved positive integer, maximum 8760 | Fixed UTC allowance window length in hours. |

`AZURE_STATIC_WEB_APPS_API_TOKEN` is a separate repository Actions secret for the existing deployment workflow, not an application backend setting. The deployed frontend calls same-origin `/api`, not localhost.

The owner must pre-provision Azure Table Storage and enter application values in Static Web App backend environment settings. The Functions host uses `AzureWebJobsStorage` for its own operations; the allowance adapter uses the dedicated setting. Local Azurite does not establish hosted Static Web Apps/Functions compatibility.

## Allowance and release limitations

The eventual judging shared total, per-client maximum, UTC window and availability period have **not** been approved. Do not substitute the acceptance rehearsal cap below as the judging budget, and do not enable Foundry with an unreviewed or unlimited allowance.

Per-client buckets hash the first valid forwarded IP address; they are not authenticated judge identities. NAT users can share a bucket, dynamic IPs can change buckets, missing/invalid forwarded IPs share `unknown`, and correctness depends on proxy forwarding behavior. Shared-table total remains authoritative. Judge-code distribution and the service/table must remain available for the owner-approved judging period. No individual judge roster or registration is implemented or required.

No hosted Azure Table check, live Foundry request, deployment, merge into `main`, or real-iPhone verification was performed. Hosted public acceptance, hosted managed-runtime storage compatibility, owner-approved Foundry acceptance, native iPhone sharing, native-speaker/screen-reader review and load testing remain outstanding. The public anonymous local-rules API has no request allowance; judge-only limits do not mitigate its traffic/availability exposure. No production credentials were generated or changed.

## Proposed six-attempt acceptance rehearsal (not the judging allowance)

Pin the proposal to application commit `c31c274c1323a71efca99dac6c586500df3eaaca`. This is a proposed maximum, not authorization to call the model. The owner must separately authorize the test, choose a temporary window and per-client allowance appropriate for the test client, configure backend secrets, and use an isolated pre-provisioned table. Failed/timed-out outbound calls count. Do not perform a seventh call to prove exhaustion.

1. Submit one prepared Northbridge–Eastport opinion at 57′. Expect one interpreter request, that fixture and selected time, calculated evidence, and Foundry provenance; public route remains local.
2. Submit an ambiguous Bruno judgement at 58′. Expect player choices. Resolve one choice through the signed continuation; expect correct attribution and limitations without another interpreter call.
3. Submit one prepared opinion on each of the other three fixtures. Expect only that fixture's context/evidence in each result.
4. Explicitly recheck the prepared 57′ baseline question at 58′. Expect one correctly scoped additional request and comparison.
5. This six-analysis set uses at most six outbound attempts because resolving the clarification makes no interpreter call. Language switching, replay movement, squad browsing, copy and PNG inspection must add none. Stop earlier for incorrect provider, fixture, identity, time, evidence, allowance count, invalid output, stale content or secret exposure. Do not retry except within the approved cap.

This rehearsal remains unrun. Offline Azurite covers storage exhaustion and concurrency; hosted checks do not.

## Deployment

The existing deployment workflow is manually dispatched from `main` and checks out the selected `${{ github.sha }}`. Do not merge this PR into `main` or deploy without explicit release-owner approval. Keep the public provider local; do not enable Foundry before the owner has approved the allowance, provisioned storage and completed the separate acceptance gates.
