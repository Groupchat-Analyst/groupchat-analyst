# Release and deployment runbook

Status: **implementation prepared, not deployed**. This branch contains the public local-rules experience and an opt-in, access-code-protected judge route. No Azure resource or allowance table has been provisioned; no deployment or live model request has occurred. The public route must remain local-rules-only. This runbook does not authorize a merge, deployment, Foundry enablement, Azure change or credential change.

## Candidate and workflow

| Item | Value |
| --- | --- |
| PR base | `main` |
| Candidate branch | `feature/explore-more-matches` |
| Application commit | `208dcbfcdd2a68a11ab6b2e5cc93da9a1be5fb77` |
| `Origin/main` at last fetch | `b2f781de81b37aedd58f681263639d44dbde4abf` |
| Branch relation at last fetch | Four commits ahead and one commit behind; no merge/rebase performed |
| Workflow | `.github/workflows/shared-preview.yml` |
| Trigger | `workflow_dispatch` only; job runs only when dispatched from `main` |
| Source pin | `actions/checkout` checks out `${{ github.sha }}` |
| Build/deploy | Azure Static Web Apps action builds `apps/web` and `apps/api` |
| Frontend API URL | Same-origin `/api`; no deployed `localhost` URL or `API_PROXY_TARGET` |
| API runtime | Node 22, declared in `apps/web/public/staticwebapp.config.json` |
| Access | Public, no sign-in; API functions use anonymous authorization |

The workflow has no automatic push or PR deployment, no GitHub environment approval gate, and no integration tests in its deployment job. Build verification must pass before merge and hosted acceptance is a separate release gate. Verify the event SHA and checked-out SHA for every dispatch.

## Backend configuration

Configure values in the Static Web App's **Settings → Environment variables → Production**. They are backend settings, not frontend build-time variables. Keep the public-analysis provider set to local. The judge route remains unavailable unless the server opt-in, code, Foundry settings and allowance storage are all configured.

### Public experience and signing

| Name | Required value/format | Purpose |
| --- | --- | --- |
| `CLAIM_INTERPRETER_PROVIDER` | Literal `local` | Public analysis uses the deterministic local interpreter. The generic provider factory rejects a Foundry override. |
| `NODE_ENV` | Literal `production` | Activates the production signing-key guard. Do not rely on an implicit platform default. |
| `PLAYER_RESOLUTION_SIGNING_KEY` | 32 cryptographically random bytes encoded as canonical unpadded base64url (43 characters) | HMAC-SHA256 signing key for player-clarification continuation tokens. Server-only; never put it in source, a GitHub build variable, frontend configuration, logs, screenshots or a PR. |

When `NODE_ENV=production`, missing or malformed signing-key configuration fails explicitly; the process-local development key cannot be used as a fallback. All API instances must receive the **same** production key. Apply it only to server environment variables and restart/redeploy all API instances after changing it. Otherwise a continuation issued by one instance may fail on another. Continuation tokens currently have no explicit expiry; key rotation invalidates outstanding tokens.

### Optional controlled judge AI — leave disabled until authorized

| Name | Required value/format | Purpose |
| --- | --- | --- |
| `FOUNDRY_JUDGE_ENABLED` | `false` by default; literal `true` only for an explicitly authorized judging window | Server-side feature gate. An unchecked browser control or `CLAIM_INTERPRETER_PROVIDER` value cannot enable Foundry. |
| `FOUNDRY_JUDGE_ACCESS_CODE` | Separate 32–128 character code using letters, digits, `_` or `-` | Shared judge access credential, checked by the API in constant time. Never reuse `PLAYER_RESOLUTION_SIGNING_KEY`; share only with judges through an approved out-of-band channel. |
| `FOUNDRY_OPENAI_BASE_URL` | HTTPS Foundry OpenAI-compatible endpoint URL | Server-side provider endpoint. |
| `FOUNDRY_API_KEY` | Credential issued for the approved Foundry deployment | Server-side only; never in browser bundles, URLs, local storage, logs, receipts, screenshots or source archives. |
| `FOUNDRY_MODEL_DEPLOYMENT` | Exact deployed model/deployment name | Server-side deployment selector. |
| `FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING` | Azure Storage connection string with Table service access | Dedicated backend-only connection used by the allowance adapter. Use the same account and table for every API instance. |
| `FOUNDRY_ALLOWANCE_TABLE_NAME` | Existing table name matching `[A-Za-z][A-Za-z0-9]{2,62}`; defaults to `FoundryRequestAllowance` | Names the pre-provisioned allowance table. The application does not create it. |
| `FOUNDRY_ALLOWANCE_MAX_REQUESTS` | Positive integer | Authoritative shared maximum outbound Foundry attempts in the fixed UTC window. |
| `FOUNDRY_ALLOWANCE_MAX_PER_CLIENT` | Positive integer no greater than the shared maximum | Additional per-client limit, checked atomically with the shared total. |
| `FOUNDRY_ALLOWANCE_WINDOW_HOURS` | Positive integer, maximum 8760 | Fixed UTC allowance-window length in hours. |

`FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING` is intentionally distinct from `AzureWebJobsStorage`. The allowance adapter reads the former directly to construct its Azure Table client. Microsoft documents `AzureWebJobsStorage` as the connection used by the Functions runtime for normal operations, and documents Static Web Apps API application settings as backend environment variables; setting the former for this application would therefore also configure a Functions host setting, not just the app's Table client. Leave it to the platform/Functions configuration and use the dedicated setting for allowance storage. The separate setting removes that coupling; hosted managed-runtime behavior has not been exercised. See [Functions `AzureWebJobsStorage`](https://learn.microsoft.com/azure/azure-functions/functions-app-settings#azurewebjobsstorage) and [Static Web Apps API application settings](https://learn.microsoft.com/azure/static-web-apps/application-settings).

The eventual judging allowance is **not yet approved**. Before enabling the judge route, the release owner must decide and record:

- The authoritative shared maximum number of outbound attempts for the judging window.
- The fixed UTC window length.
- The supplementary per-client maximum, which cannot exceed the shared maximum.
- How long the API, Foundry deployment, access code and allowance table must remain available, including setup and contingency time, through the judging period.

Do not substitute the acceptance rehearsal limit below for these decisions, and do not enable Foundry with an unreviewed or unlimited allowance. The per-client identity is a SHA-256 hash of the first valid address in `X-Forwarded-For`; it is a pseudonymous network-address bucket, not an authenticated user. Judges behind NAT share a limit, dynamic IPs may move between buckets, and behavior depends on the hosting proxy's forwarded-header handling. Missing or invalid IP information shares an `unknown` bucket. The shared table total remains authoritative.

An authorized owner must provision the Azure Storage account and table and place its connection string only in backend environment settings. The application does not create Azure resources or tables. The adapter verifies the table and reserves with ETag-conditional updates; absent, malformed or unavailable storage blocks model calls. Reservations occur **before** outbound attempts, so failed and timed-out calls count; there is no automatic model retry. The access-code endpoint itself makes no model call.

The judge-code entry is an expanded, user-visible page control. Its input is `type=password` (characters are masked while entered) and `autocomplete=off`; this is not a private owner-configuration surface or a browser security boundary. A judge entering the shared code controls their own browser and can inspect the page/request. The value is held in page memory and sent in the analysis request header over HTTPS, not placed in the URL or local storage. The owner must configure `FOUNDRY_JUDGE_ACCESS_CODE` server-side and distribute it only through an approved out-of-band channel. Never paste an actual code into a PR, issue, screenshot or source file.

Keep the provider's existing input limits, 8192 completion-token ceiling, 30-second timeout, structured-output validation and no-retry behavior. Do not enable raw-output capture. The ordinary public route remains local even when the judge route is configured.

### GitHub Actions secret

| Name | Location | Purpose |
| --- | --- | --- |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Repository Actions secret | Opaque deployment token consumed by the Static Web Apps deploy action. Do not expose its value. |

`API_PROXY_TARGET` is a local Vite development/preview setting only. The deployed frontend calls same-origin `/api`. `FUNCTIONS_WORKER_RUNTIME` appears in local Functions settings; the deployed managed API runtime is selected by `apiRuntime: node:22`.

Microsoft documents that Static Web Apps API application settings are configured per environment in the Azure portal and made available to the backend API as environment variables: [Configure application settings for Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/application-settings).

### Owner setup checklist (placeholders only)

1. Keep the public settings `CLAIM_INTERPRETER_PROVIDER=local` and `NODE_ENV=production`. Configure a production `PLAYER_RESOLUTION_SIGNING_KEY` using the required format above; use the same value on all API instances. Do not reuse it for Foundry access.
2. Before enabling the judge route, create the Azure Storage account and pre-provision the table `FoundryRequestAllowance` (or the approved value of `FOUNDRY_ALLOWANCE_TABLE_NAME`). Do not use the Functions host's `AzureWebJobsStorage` setting as the allowance connection.
3. In the Static Web App's **Settings → Environment variables → Production**, put the application settings below in the backend environment only. Keep `FOUNDRY_JUDGE_ENABLED=false` until the owner has approved the allowance, availability period and rehearsal.

   ```text
   CLAIM_INTERPRETER_PROVIDER=local
   NODE_ENV=production
   PLAYER_RESOLUTION_SIGNING_KEY=<43-CHARACTER-UNPADDED-BASE64URL-KEY>
   FOUNDRY_JUDGE_ENABLED=false
   FOUNDRY_JUDGE_ACCESS_CODE=<SEPARATE-32-TO-128-CHARACTER-CODE>
   FOUNDRY_OPENAI_BASE_URL=<HTTPS-FOUNDRY-OPENAI-COMPATIBLE-ENDPOINT>
   FOUNDRY_API_KEY=<FOUNDRY-DEPLOYMENT-CREDENTIAL>
   FOUNDRY_MODEL_DEPLOYMENT=<EXACT-DEPLOYMENT-NAME>
   FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING=<AZURE-STORAGE-TABLE-CONNECTION-STRING>
   FOUNDRY_ALLOWANCE_TABLE_NAME=FoundryRequestAllowance
   FOUNDRY_ALLOWANCE_MAX_REQUESTS=<OWNER-APPROVED-POSITIVE-INTEGER>
   FOUNDRY_ALLOWANCE_MAX_PER_CLIENT=<OWNER-APPROVED-POSITIVE-INTEGER-NO-GREATER-THAN-TOTAL>
   FOUNDRY_ALLOWANCE_WINDOW_HOURS=<OWNER-APPROVED-POSITIVE-INTEGER-UP-TO-8760>
   ```

4. Configure and distribute the judge code out-of-band only to authorized participants. Judges enter it in the expanded, visible judge-access panel in the app. It is a masked password input, but it is visible to the person entering it and inspectable in their browser/request; do not treat the page field as a secret storage location.
5. After changing backend settings, allow the API runtime to restart and verify the names/presence of settings without recording values. Exercise access and storage checks with the offline stub/emulator before any separately approved live rehearsal. Keep Foundry disabled until the owner is ready for that window.

## Exact public release sequence

1. Review the complete PR diff into `main`, confirm the final PR head and required checks, and have the release owner accept or mitigate the anonymous public API traffic exposure. Do not merge until approved.
2. Configure `NODE_ENV=production`, `CLAIM_INTERPRETER_PROVIDER=local` and a production `PLAYER_RESOLUTION_SIGNING_KEY` in the Static Web App's **Production** backend environment. Add `AZURE_STATIC_WEB_APPS_API_TOKEN` to repository Actions secrets. Do **not** configure or enable Foundry for the public release.
3. Have the authorized owner merge the PR and record the resulting `main` merge SHA (`M`).
4. Manually dispatch **Deploy shared preview** with the `main` ref at `M`. Verify both the event SHA and checkout SHA equal `M`; stop if they differ. No dispatch is performed by this runbook.
5. After a successful workflow, open the deployed HTTPS URL in a fresh private browser context and complete the hosted acceptance checklist below. A successful build alone is not hosted acceptance.

## Hosted public acceptance checklist

Record each result with the deployment URL, workflow run URL, deployed SHA, browser/device, language and timestamp. Keep local, built-preview, hosted and real-device results separate.

1. **Fresh entry:** with clean browser storage, visit Home → Try it Out → all four fixture routes. Confirm the selected fixture/version, 1′, 0–0 and no events; later goals/results must not appear ahead of the selected clock. Confirm replay succeeds and entry makes no analysis request.
2. **Replay and comparison:** move through earlier/later times and seek backward. On the baseline fixture, explicitly choose the guided walkthrough: preparing 57′ makes no analysis request; explicit submit returns the 2–2 shots-on-target answer; moving to 58′ makes none; recheck produces Eastport 3–Northbridge 2 and a correctly scoped comparison.
3. **Player clarification and retry:** submit an ambiguous-player request and select each candidate in separate trials. Confirm the selected player's evidence and original fixture/time/period are retained. Exercise a failed choice request, explicit retry and successful resolution; player selection must not make an interpreter call.
4. **Languages:** change among English, Spanish, French, German and Arabic while preserving match, clock, period, draft and conversation. Verify fresh routes and inspect Arabic RTL text, mixed-script identities, score and minutes.
5. **Receipts:** inspect copied reply/card text and a downloaded PNG for original opinion, chosen player where relevant, figures, selected-time scope, fixture/version and accurate provider disclosure. Verify failures are reported. Browser verification does not establish native sharing.
6. **Real iPhone:** on an actual iPhone in Safari, repeat the guided comparison and use the native share sheet with the generated PNG. Record separately from desktop/mobile emulation.
7. **Provider and signing:** confirm analysis responses say local rules, no Foundry label appears, player clarification completes, and no secret values are exposed in logs or evidence. Verify only the names/presence of configured environment settings.

## Proposed six-attempt acceptance rehearsal (separate from judging limits)

This is a proposed, capped acceptance rehearsal, not an approved judging allowance. Do **not** run it until the authorized owner approves it, provisions the required backend resources, supplies the judge code out-of-band and authorizes a temporary test configuration. Use an isolated table with a fresh allowance window, a shared cap no greater than six, and a per-client cap sufficient for the planned requests from the test client. The owner chooses a window long enough to finish. Failed and timed-out outbound attempts count. Never copy these rehearsal limits into the eventual judging configuration.

Pin the run to application commit `0bda367ab0d7b9ff3f3da78b9b7c031ac8df1b56`. The proposed maximum set is:

1. Submit one prepared Northbridge–Eastport opinion at 57′. Expect one Foundry interpreter call, correct fixture/time/evidence and Foundry provenance; the ordinary public route must still report local rules.
2. Submit an ambiguous Bruno judgement at 58′. Expect the player choices. Resolve one choice through the signed continuation; expect attributed records and limitations with **no additional interpreter call**.
3. Submit one prepared opinion for each of the other three fixtures. Expect every response to use only its fixture context and calculated evidence.
4. Explicitly recheck the prepared 57′ baseline opinion at 58′. Expect one correctly scoped additional call and comparison.
5. This planned set uses at most six outbound attempts. Do not send an extra request to demonstrate exhaustion; explicit denial-at-exhaustion and concurrent overflow are already tested offline against Azurite. Language changes, player selection, replay movement, squad browsing, copy and PNG inspection must not create additional calls.

Capture expected outcomes before any authorized run. Stop immediately for an unexpected provider, fixture, identity, selected time, evidence, allowance count, secret exposure, invalid output or stale/mixed-scope content. Do not retry unless the retry is part of the six-call budget. Record sanitized request counts/statuses only, never access codes, keys or raw credentials. This plan is a proposal only; it has not been run.

## Verified versus outstanding

- Offline verification covers the local public path, access-code rejection, shared/per-client limits, concurrency and restart persistence through fakes and the actual Azure Table SDK against Azurite, real ETag conflicts, missing-table/storage failure, exhaustion and failed-attempt reservation, continuation without a second interpreter call, and fixture-specific contexts.
- Azurite is a local emulator, not Azure. Hosted app settings, Azure-hosted Table Storage, hosted Foundry calls and a real iPhone are **not verified**.
- Hosted public acceptance, native iPhone sharing, independent native-speaker/screen-reader review and load testing remain outstanding.
- No merge, deployment, Azure resource change, credential change or live model/translation call was made.

## Remaining AI release blockers

- **Enforced request allowance:** implemented and verified locally with Azurite and the actual Azure Table SDK, including independent processes, restart persistence and real ETag conflicts. It still requires a pre-provisioned Azure table and hosted configuration; hosted service compatibility has not been tested.
- **Judge access arrangement:** code-based server validation exists, but the owner has not approved the eventual total/window/per-client limits, availability period or out-of-band code distribution. The access code is a shared gate, not individual judge identity or authorization; no judge roster is implemented or required.
- **Foundry verification:** no live model call was made. A fresh, final-commit-pinned rehearsal of at most six calls remains outstanding and requires separate owner authorization; it is not the eventual judging allowance. Historical captures and constructed stubs are offline evidence only.
- **Public API exposure:** routes are anonymous and public analysis has no request allowance. The judge-only allowance does not mitigate public local-rules traffic. The release owner must accept or mitigate this availability exposure.

## Rollback

- For a bad build, dispatch the approved rollback commit from `main` through the same workflow and verify its checked-out SHA.
- For a compromised signing key, replace it consistently for all API instances, restart/redeploy, and expect outstanding clarification continuations to become invalid.
- For a compromised judge access code, disable `FOUNDRY_JUDGE_ENABLED`, rotate the code out-of-band, and restart/redeploy the API. This does not reset the shared allowance.
- To take the site offline, the authorized owner can disable/delete the Static Web App and revoke the deployment token. No destructive or Azure action is performed by this runbook.
