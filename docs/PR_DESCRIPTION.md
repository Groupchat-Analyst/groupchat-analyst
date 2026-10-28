# Add controlled Foundry judge access with durable request limits

## Summary

This PR adds a backend-authorized, access-code-protected Foundry path for an explicitly approved judging session while preserving the public football evidence demo on local rules. The feature fails closed unless the backend enables it and supplies valid Foundry configuration, a separate judge access code, and a pre-provisioned shared Azure Table allowance.

Application commit: `0bda367ab0d7b9ff3f3da78b9b7c031ac8df1b56` on `feature/explore-more-matches`.

At the last fetch, `Origin/main` was `b2f781de81b37aedd58f681263639d44dbde4abf`, whose only main-exclusive commit is that merge commit. The candidate differs from that tree across shared/API/web behavior and has overlapping modifications/deletions; expect conflicts if integrating it. No merge, rebase or reset was performed.

## Included functionality

- Preserve the public local-rules provider; public provider selection cannot enable Foundry. Only a server-validated judge request can select the Foundry adapter.
- Validate the judge code server-side in constant time. The web entry is localized in English, Spanish, French, German and Arabic; the code is held in page memory and sent in the analysis request header, not the URL or analysis body.
- Reserve shared-total and per-client allowances using Azure Table ETag-conditional updates before each outbound Foundry attempt. Failed and timed-out calls count. Missing, invalid, exhausted or unavailable configuration/storage fails closed with a localized state and local-rules alternative.
- Keep Foundry credentials server-side and independent from `PLAYER_RESOLUTION_SIGNING_KEY`. No production credentials are included or generated.
- Reuse existing structured Foundry interpretation, evidence calculation, validation, signed player continuation, fixture data and interface. Player resolution makes no additional interpreter request.
- Preserve the four synthetic fixtures, 1′ ordinary replay, explicit 57′→58′ guided comparison, five presentation languages, Arabic identity/RTL support, Fan/Analyst evidence and receipts.

## Verification

- Local Azurite integration uses the actual `@azure/data-tables` client and transport, not the in-memory fake. It verifies initial writes, updates and stored serialization, exhaustion, a stale ETag rejection, a real 412 race with adapter retry, two independent Node processes attempting beyond the shared ceiling, restart persistence, and zero outbound model attempts for invalid credentials, missing table, storage outage and exhausted allowance. A failed stubbed outbound attempt remains counted and is not retried.
- The Foundry transport is stubbed for all emulator tests. This is local emulator verification, not hosted Azure Table or live Foundry verification.
- API: **386/386 tests** pass, including the seven-test Azurite integration, and the TypeScript build passes.
- Web: **160/160 tests** pass; TypeScript build, lint and production build pass.
- `git diff --check` passes.
- The judge-code input was checked in the UI: it is user-visible, `type=password`, and `autocomplete=off`. Masking does not make it private from the person using the browser; out-of-band distribution is required.

## Required server configuration and infrastructure

Keep the public deployment on `CLAIM_INTERPRETER_PROVIDER=local`, `NODE_ENV=production` and a production `PLAYER_RESOLUTION_SIGNING_KEY`. The controlled judge route additionally requires `FOUNDRY_JUDGE_ENABLED`, a separate `FOUNDRY_JUDGE_ACCESS_CODE`, `FOUNDRY_OPENAI_BASE_URL`, `FOUNDRY_API_KEY`, `FOUNDRY_MODEL_DEPLOYMENT`, `FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING`, `FOUNDRY_ALLOWANCE_MAX_REQUESTS`, `FOUNDRY_ALLOWANCE_MAX_PER_CLIENT` and `FOUNDRY_ALLOWANCE_WINDOW_HOURS`. `FOUNDRY_ALLOWANCE_TABLE_NAME` is optional and defaults to `FoundryRequestAllowance`.

`FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING` is dedicated to the application allowance. Do not reuse `AzureWebJobsStorage`, which belongs to Functions host storage configuration. The owner must provision the Azure Storage account/table and configure backend-only application settings; the app does not create resources. Hosted managed-runtime storage compatibility remains unverified.

The eventual judging total, per-client limit, UTC window and service availability period have **not** been approved. The per-client identity is IP-derived and supplementary: NAT users share a bucket, dynamic IPs may change buckets, and missing/invalid forwarded IPs share `unknown`. The shared Table count is authoritative. The judge code is a shared gate, not individual judge identity; no roster or registration is implemented or required.

See [the deployment runbook](./DEPLOYMENT_RUNBOOK.md) for owner setup steps, secret placeholders, limitations and the proposed acceptance plan. That proposed rehearsal is capped at six outbound attempts and is separate from the eventual judging allowance. It has not been run.

## Limitations and release gates

- No live Foundry call, hosted Foundry test, Azure provisioning, deployment or merge was performed.
- Local Azurite verifies the Azure Table adapter and SDK behavior, but is not Azure-hosted verification. Hosted settings, platform compatibility and a live, owner-authorized acceptance rehearsal remain outstanding.
- The judging allowance and service availability window require owner decisions before enabling the route.
- The public API remains anonymous and has no public local-rules request allowance. The judge-only allowance does not mitigate public traffic/availability exposure.
- Hosted public acceptance, real-iPhone sharing, independent native-speaker/screen-reader review and load testing remain outstanding.
- No production signing key, Foundry key or judge access code was generated or changed.
- The production-only API dependency audit is clear. The full development dependency audit reports nine findings (six high, three moderate) in Azurite's development-only transitive dependency tree; no compatible automatic fix is available from the current lockfile, and the suggested forced Azurite downgrade is breaking. This does not add those packages to production dependencies.

## Deployment

The existing workflow is manual from `main` and checks out the selected `${{ github.sha }}`. The deployed frontend calls same-origin `/api`, not localhost. Do not merge or deploy without explicit release-owner approval. Keep the public provider local; do not enable Foundry until its infrastructure, approved allowance and acceptance gates are ready.
