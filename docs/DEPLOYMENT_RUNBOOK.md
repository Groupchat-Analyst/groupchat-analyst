# Release and deployment runbook

Status: **post-deadline public-AI access repair prepared, not deployed**. It is a separate repair based on the current `Origin/main`; it does not change the currently deployed version. Anonymous Foundry analysis is enabled only by backend configuration and is protected by the shared durable Azure Table allowance. No deployment, live model request, Azure resource change or credential change has occurred. Deploying this repair requires a separate owner decision.

## Candidate and workflow

| Item | Value |
| --- | --- |
| PR base | `main` |
| Repair branch | `repair/public-ai-access` |
| Base commit | `0f4eb271bcff5a534878eea2c052d27b929210d0` |
| Candidate commit | See the repair branch head and focused PR |
| `Origin/main` at last fetch | `0f4eb271bcff5a534878eea2c052d27b929210d0` |
| Branch relation | Created from current `Origin/main`; no merge, rebase or reset |
| Workflow | `.github/workflows/shared-preview.yml` |
| Trigger | `workflow_dispatch` only; job runs only when dispatched from `main` |
| Source pin | `actions/checkout` checks out `${{ github.sha }}` |
| Build/deploy | Azure Static Web Apps action builds `apps/web` and `apps/api` |
| Frontend API URL | Same-origin `/api`; no deployed `localhost` URL or `API_PROXY_TARGET` |
| API runtime | Node 22, declared in `apps/web/public/staticwebapp.config.json` |
| Access | Public, no sign-in; API functions use anonymous authorization |

The workflow has no automatic push or PR deployment, no GitHub environment approval gate, and no integration tests in its deployment job. Build verification must pass before merge and hosted acceptance is a separate release gate. Verify the event SHA and checked-out SHA for every dispatch.

## Backend configuration

Configure values in the Static Web App's **Settings → Environment variables → Production**. They are backend settings, not frontend build-time variables. The public provider factory remains local; `FOUNDRY_PUBLIC_ENABLED` is the server-only switch that routes anonymous analysis to Foundry. The browser cannot enable Foundry. Keep the public switch false until every Foundry setting and allowance dependency is ready.

### Public experience and signing

| Name | Required value/format | Purpose |
| --- | --- | --- |
| `CLAIM_INTERPRETER_PROVIDER` | Literal `local` | Public analysis uses the deterministic local interpreter. The generic provider factory rejects a Foundry override. |
| `NODE_ENV` | Literal `production` | Activates the production signing-key guard. Do not rely on an implicit platform default. |
| `PLAYER_RESOLUTION_SIGNING_KEY` | 32 cryptographically random bytes encoded as canonical unpadded base64url (43 characters) | HMAC-SHA256 signing key for player-clarification continuation tokens. Server-only; never put it in source, a GitHub build variable, frontend configuration, logs, screenshots or a PR. |

When `NODE_ENV=production`, missing or malformed signing-key configuration fails explicitly; the process-local development key cannot be used as a fallback. All API instances must receive the **same** production key. Apply it only to server environment variables and restart/redeploy all API instances after changing it. Otherwise a continuation issued by one instance may fail on another. Continuation tokens currently have no explicit expiry; key rotation invalidates outstanding tokens.

### Anonymous Foundry interpretation — disabled until configured

| Name | Required value/format | Purpose |
| --- | --- | --- |
| `FOUNDRY_PUBLIC_ENABLED` | `false` by default; literal `true` to enable public AI | Server-side access switch. No account, payment or access code is required. |
| `FOUNDRY_OPENAI_BASE_URL` | HTTPS Foundry OpenAI-compatible endpoint URL | Server-side provider endpoint. |
| `FOUNDRY_API_KEY` | Credential issued for the approved Foundry deployment | Server-side only; never in browser bundles, URLs, local storage, logs, receipts, screenshots or source archives. |
| `FOUNDRY_MODEL_DEPLOYMENT` | Exact deployed model/deployment name | Server-side deployment selector. |
| `FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING` | Azure Storage connection string with Table service access | Dedicated backend-only connection used by the allowance adapter. Use the same account and table for every API instance. |
| `FOUNDRY_ALLOWANCE_TABLE_NAME` | `FoundryJudging` | Existing shared allowance table. The application does not create, clear or reset it at startup. |
| `FOUNDRY_ALLOWANCE_MAX_REQUESTS` | `200` | Authoritative shared maximum outbound Foundry attempts in the fixed UTC window. |
| `FOUNDRY_ALLOWANCE_MAX_PER_CLIENT` | `200` | Per-client maximum; equal to the shared cap so it cannot impose a smaller IP limit. |
| `FOUNDRY_ALLOWANCE_WINDOW_HOURS` | `8760` | Fixed epoch-aligned UTC allowance-window length in hours. |

`FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING` is intentionally distinct from `AzureWebJobsStorage`. The allowance adapter reads the former directly to construct its Azure Table client. Microsoft documents `AzureWebJobsStorage` as the connection used by the Functions runtime for normal operations, and documents Static Web Apps API application settings as backend environment variables; setting the former for this application would therefore also configure a Functions host setting, not just the app's Table client. Leave it to the platform/Functions configuration and use the dedicated setting for allowance storage. The separate setting removes that coupling; hosted managed-runtime behavior has not been exercised. See [Functions `AzureWebJobsStorage`](https://learn.microsoft.com/azure/azure-functions/functions-app-settings#azurewebjobsstorage) and [Static Web Apps API application settings](https://learn.microsoft.com/azure/static-web-apps/application-settings).

The owner has authorized the shared ceiling of 200 requests for this repair. The per-client identity is a SHA-256 hash of the first valid address in `X-Forwarded-For`; it is a pseudonymous network-address bucket, not an authenticated user. People behind one IP share that bucket, and behavior depends on the hosting proxy's forwarded-header handling. Since the per-client cap equals the shared cap, it does not impose a lower limit than the authoritative total. Missing or invalid IP information shares an `unknown` bucket.

An authorized owner must configure the shared Azure Storage account and preserve the `FoundryJudging` table and its existing row. The application does not create, clear or reset Azure resources or table data. The adapter verifies the table and reserves with ETag-conditional updates; absent, malformed or unavailable storage blocks model calls. Reservations occur **before** each outbound attempt, so failed and timed-out calls count; there is no automatic model retry. Player clarification continuations do not invoke the interpreter or consume another allowance.

Keep the provider's existing input limits, 8192 completion-token ceiling, 30-second timeout, structured-output validation and no-retry behavior. Do not enable raw-output capture. The ordinary public route uses Foundry only when `FOUNDRY_PUBLIC_ENABLED=true`; users can explicitly select local rules, and a client can never grant itself AI access.

### GitHub Actions secret

| Name | Location | Purpose |
| --- | --- | --- |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Repository Actions secret | Opaque deployment token consumed by the Static Web Apps deploy action. Do not expose its value. |

`API_PROXY_TARGET` is a local Vite development/preview setting only. The deployed frontend calls same-origin `/api`. `FUNCTIONS_WORKER_RUNTIME` appears in local Functions settings; the deployed managed API runtime is selected by `apiRuntime: node:22`.

Microsoft documents that Static Web Apps API application settings are configured per environment in the Azure portal and made available to the backend API as environment variables: [Configure application settings for Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/application-settings).

### Owner setup checklist (placeholders only)

1. Keep `CLAIM_INTERPRETER_PROVIDER=local` and `NODE_ENV=production`. Preserve the existing production `PLAYER_RESOLUTION_SIGNING_KEY` unchanged and use the same value on every API instance.
2. Verify that Azure Table Storage contains the existing `FoundryJudging` table and existing allowance row. Do not delete, clear, recreate or reset it. Do not use the Functions host's `AzureWebJobsStorage` setting as the allowance connection.
3. In the Static Web App's **Settings → Environment variables → Production**, put the following application settings in the backend environment only. Keep `FOUNDRY_PUBLIC_ENABLED=false` until Foundry credentials, the shared table, existing counts and the approved 200-attempt limits are verified.

   ```text
   CLAIM_INTERPRETER_PROVIDER=local
   NODE_ENV=production
   PLAYER_RESOLUTION_SIGNING_KEY=<43-CHARACTER-UNPADDED-BASE64URL-KEY>
   FOUNDRY_PUBLIC_ENABLED=false
   FOUNDRY_OPENAI_BASE_URL=<HTTPS-FOUNDRY-OPENAI-COMPATIBLE-ENDPOINT>
   FOUNDRY_API_KEY=<FOUNDRY-DEPLOYMENT-CREDENTIAL>
   FOUNDRY_MODEL_DEPLOYMENT=<EXACT-DEPLOYMENT-NAME>
   FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING=<AZURE-STORAGE-TABLE-CONNECTION-STRING>
   FOUNDRY_ALLOWANCE_TABLE_NAME=FoundryJudging
   FOUNDRY_ALLOWANCE_MAX_REQUESTS=200
   FOUNDRY_ALLOWANCE_MAX_PER_CLIENT=200
   FOUNDRY_ALLOWANCE_WINDOW_HOURS=8760
   ```

4. Preserve Foundry endpoint/key/deployment credentials and the signing key as server-only values. No judge code is required or embedded in the frontend.
5. After changing backend settings, allow the API runtime to restart and verify setting names/presence without recording values. Keep `FOUNDRY_PUBLIC_ENABLED=false` until backend storage access has been verified; then set it to `true` and restart the API. This change is an anonymous public route, so the 200-request shared allowance remains the fail-closed limit.

## Post-deadline access repair release sequence

1. Review the separate repair PR and checks. This is post-deadline access repair work; the current deployed version remains unchanged until the owner chooses to release it.
2. Before release, verify all backend configuration and the existing `FoundryJudging` counts. Do not rotate or replace `PLAYER_RESOLUTION_SIGNING_KEY`.
3. Have the authorized owner merge the PR when ready and record the resulting `main` merge SHA (`M`).
4. Manually dispatch **Deploy shared preview** with the `main` ref at `M`. Verify both the event SHA and checkout SHA equal `M`; stop if they differ.
5. Only after the backend environment and shared allowance are verified, set `FOUNDRY_PUBLIC_ENABLED=true` and restart the API. If settings have not been verified, leave AI disabled; public requests then use local rules.
6. After a successful workflow, open the deployed HTTPS URL in a fresh private browser context and confirm anonymous questions, Foundry provider labels, local-rules selection, allowance failures and all five languages. A successful build alone is not hosted acceptance.

## Hosted public acceptance checklist

Record each result with the deployment URL, workflow run URL, deployed SHA, browser/device, language and timestamp. Keep local, built-preview, hosted and real-device results separate.

1. **Fresh entry:** with clean browser storage, visit Home → Try it Out → all four fixture routes. Confirm the selected fixture/version, 1′, 0–0 and no events; later goals/results must not appear ahead of the selected clock. Confirm replay succeeds and entry makes no analysis request.
2. **Replay and comparison:** move through earlier/later times and seek backward. On the baseline fixture, explicitly choose the guided walkthrough: preparing 57′ makes no analysis request; explicit submit returns the 2–2 shots-on-target answer; moving to 58′ makes none; recheck produces Eastport 3–Northbridge 2 and a correctly scoped comparison.
3. **Player clarification and retry:** submit an ambiguous-player request and select each candidate in separate trials. Confirm the selected player's evidence and original fixture/time/period are retained. Exercise a failed choice request, explicit retry and successful resolution; player selection must not make an interpreter call.
4. **Languages:** change among English, Spanish, French, German and Arabic while preserving match, clock, period, draft and conversation. Verify fresh routes and inspect Arabic RTL text, mixed-script identities, score and minutes.
5. **Receipts:** inspect copied reply/card text and a downloaded PNG for original opinion, chosen player where relevant, figures, selected-time scope, fixture/version and accurate provider disclosure. Verify failures are reported. Browser verification does not establish native sharing.
6. **Real iPhone:** on an actual iPhone in Safari, repeat the guided comparison and use the native share sheet with the generated PNG. Record separately from desktop/mobile emulation.
7. **Provider and signing:** confirm anonymous checks report Foundry when enabled and local rules when selected, player clarification completes without an additional interpreter request, and no secret values are exposed in logs or evidence. Verify only the names/presence of configured environment settings.

## Verified versus outstanding

- Offline verification covers anonymous public-AI selection, explicit local rules, server-disabled fallback, the shared/per-client allowance, concurrency and restart persistence through fakes and the actual Azure Table SDK against Azurite, real ETag conflicts, missing-table/storage failure, exhaustion and failed-attempt reservation, continuation without a second interpreter call, and fixture-specific contexts.
- Azurite is a local emulator, not Azure. Hosted app settings, Azure-hosted Table Storage, hosted Foundry calls and a real iPhone are **not verified**.
- Hosted public acceptance, native iPhone sharing, independent native-speaker/screen-reader review and load testing remain outstanding.
- The repair is on a separate branch based on `Origin/main`; no PR was merged into main. No deployment, Azure resource change, credential change or live model/translation call was made.

## Remaining verification

- **Allowance:** the shared 200-attempt ceiling, per-client 200 limit and 8,760-hour window are configured in the runbook; the existing table row must be preserved. Confirm deployed setting values and current stored counts without exposing credentials.
- **Hosted behavior:** Azure Table Storage connectivity and Foundry behavior must be verified after the repair is deployed and configured. Offline transport stubs do not establish hosted provider availability or price.
- **Public availability:** anonymous requests can consume the shared allowance. When the allowance is exhausted or unavailable, the service fails closed and offers local rules.

## Rollback

- For a bad build, dispatch the approved rollback commit from `main` through the same workflow and verify its checked-out SHA.
- For a compromised signing key, replace it consistently for all API instances, restart/redeploy, and expect outstanding clarification continuations to become invalid.
- To disable public AI while retaining the public local-rules experience, set `FOUNDRY_PUBLIC_ENABLED=false` and restart the API. Do not clear the allowance table.
- To take the site offline, the authorized owner can disable/delete the Static Web App and revoke the deployment token. No destructive or Azure action is performed by this runbook.
