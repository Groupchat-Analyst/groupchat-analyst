# Add controlled Foundry judge access with durable request limits

## Summary

This PR adds a bounded, access-code-protected Foundry path for an explicitly authorized judging session while preserving the public football evidence demo on local rules. The feature fails closed unless the backend enables it and supplies valid Foundry configuration, a separate judge access code, and a pre-provisioned shared Azure Table allowance.

## Included functionality

- Preserve the public local-rules provider; the public provider factory rejects a Foundry override, and only a server-validated judge request can select the Foundry adapter.
- Validate the judge code server-side in constant time. The web entry is localized in English, Spanish, French, German and Arabic; the code stays in page memory and travels in the request header, not the URL or analysis body.
- Reserve the shared total and per-client allowance using an Azure Table ETag-conditional update before each outbound Foundry attempt. Failed/time-out attempts count; concurrent requests, API instances and restarts share the stored ceiling. Missing, invalid, exhausted or unavailable configuration/storage fails closed with a localized state and local-rules alternative.
- Keep Foundry credentials server-side and independent from `PLAYER_RESOLUTION_SIGNING_KEY`. No production credentials are included or generated.
- Reuse existing structured Foundry interpretation, evidence calculation, validation, signed player continuation, fixture data and interface. Player resolution makes no additional interpreter request.
- Preserve the four synthetic fixtures, 1′ ordinary replay, explicit 57′→58′ guided comparison, five presentation languages, Arabic identity/RTL support, Fan/Analyst evidence and receipts.

## Verification

- API: 379/379 tests passed, including invalid access (zero calls), exactly one authorized call, failed-attempt reservation/no retry, shared/per-client concurrency, shared-state persistence across store instances, restart simulation, rollover, exhaustion/storage/configuration failures, no-call player continuation, and all four fixture contexts.
- Web: 160/160 tests passed, including access-code request transport, no code in the analysis body, and localization-key coverage.
- API TypeScript build, web TypeScript/production build, web lint and `git diff --check` passed.
- Bruno/Martin player-judgement clarification, both candidate selections and pre-question squads were exercised locally with the local-rules provider. The original questions remained verbatim; selected identities had attributed synthetic records and explicit no-overall-rating limitations.
- Local provider behavior and offline transport/storage stubs are not live Foundry verification. The allowance was tested with an in-memory ETag-enforcing fake, not Azurite or Azure Table Storage.

## Required server configuration and infrastructure

The public deployment must keep `CLAIM_INTERPRETER_PROVIDER=local`, `NODE_ENV=production` and a production `PLAYER_RESOLUTION_SIGNING_KEY`. The controlled judge route additionally requires `FOUNDRY_JUDGE_ENABLED=true`, a separate `FOUNDRY_JUDGE_ACCESS_CODE`, `FOUNDRY_OPENAI_BASE_URL`, `FOUNDRY_API_KEY`, `FOUNDRY_MODEL_DEPLOYMENT`, `AzureWebJobsStorage`, and positive `FOUNDRY_ALLOWANCE_MAX_REQUESTS`, `FOUNDRY_ALLOWANCE_MAX_PER_CLIENT` and `FOUNDRY_ALLOWANCE_WINDOW_HOURS`. `FOUNDRY_ALLOWANCE_TABLE_NAME` is optional and defaults to `FoundryRequestAllowance`.

An authorized owner must provision the Azure Storage account/table and configure server-only settings before enabling judging. The code does not create Azure resources or tables. The proposed small judging allowance is six total attempts, three per forwarded client address and 24 hours. Per-client enforcement is IP-derived and supplementary; NAT/dynamic-IP and forwarded-header limitations apply. The shared table count is authoritative.

See [the deployment runbook](./DEPLOYMENT_RUNBOOK.md) for setting formats, signing-key requirements, infrastructure, deployment sequence and the proposed six-call acceptance. Neither Foundry nor Azure Table has been configured or provisioned for this PR.

## Limitations and release gates

- No live Foundry call, hosted Foundry test, Azure Table emulator/integration test, Azure provisioning, deployment or merge was performed.
- A judge access code is a shared gate, not individual judge identity. An approved judge roster and out-of-band code distribution remain operational dependencies.
- A fresh, commit-pinned live acceptance of at most six outbound attempts remains outstanding; no live set is run by this PR preparation.
- The public API remains anonymous and has no public local-rules traffic allowance. The judge-only allowance does not mitigate public traffic/availability exposure.
- Hosted acceptance, real-iPhone sharing, independent native-speaker/screen-reader review and load testing remain outstanding.
- No production signing key, Foundry key or judge access code was generated or changed.

## Deployment

The existing workflow is manual from `main` and checks out the selected `${{ github.sha }}`. The deployed frontend calls same-origin `/api`, not localhost. This PR must not be merged or deployed without explicit release-owner approval. Keep the public provider local; do not enable Foundry until its infrastructure and acceptance gates are approved.
