# Release and deployment runbook

Status: **implementation prepared, not deployed**. This branch contains the public local-rules experience and an opt-in, access-code-protected judge route. No Azure resource or allowance table has been provisioned; no deployment or live model request has occurred. The public route must remain local-rules-only. This runbook does not authorize a merge, deployment, Foundry enablement, Azure change or credential change.

## Candidate and workflow

| Item | Value |
| --- | --- |
| PR base | `main` |
| Candidate branch | `feature/explore-more-matches` |
| Application commit | Record the final pushed branch SHA after review |
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
| `AzureWebJobsStorage` | Storage-account connection string accessible to the API | Shared persistent Azure Table Storage used for reservations. Use the same account and table for every API instance. |
| `FOUNDRY_ALLOWANCE_TABLE_NAME` | Existing table name matching `[A-Za-z][A-Za-z0-9]{2,62}`; defaults to `FoundryRequestAllowance` | Names the pre-provisioned allowance table. The application does not create it. |
| `FOUNDRY_ALLOWANCE_MAX_REQUESTS` | Positive integer | Authoritative shared maximum outbound Foundry attempts in the fixed UTC window. |
| `FOUNDRY_ALLOWANCE_MAX_PER_CLIENT` | Positive integer no greater than the shared maximum | Additional per-client limit, checked atomically with the shared total. |
| `FOUNDRY_ALLOWANCE_WINDOW_HOURS` | Positive integer, maximum 8760 | Fixed UTC allowance-window length in hours. |

A suggested small rehearsal configuration is a shared maximum of **6**, per-client maximum of **3**, and **24** hours. The per-client identity is SHA-256 of the first valid address in `X-Forwarded-For`; it is a pseudonymous network-address bucket, not an authenticated user. NAT users share a limit, dynamic IPs may change buckets, and correctness depends on the hosting proxy's forwarded-header behavior. Missing or invalid IP information shares an `unknown` bucket. This limit is supplementary; the shared table total remains authoritative.

Before enabling judge access, an authorized owner must provision the Azure Storage account/table and configure its secret connection string. The API only checks the pre-provisioned table and reserves a row with ETag-conditional updates; absent, malformed or unavailable storage blocks model calls. Requests reserve allowance **before** the outbound attempt, so failed and timed-out calls count. There is no automatic model retry. The code/access endpoint itself makes no model call. No Azure provisioning is part of this change.

Keep the provider's existing input limits, 8192 completion-token ceiling, 30-second timeout, structured-output validation and no-retry behavior. Do not enable raw-output capture. The ordinary public route remains local even when the judge route is configured.

### GitHub Actions secret

| Name | Location | Purpose |
| --- | --- | --- |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Repository Actions secret | Opaque deployment token consumed by the Static Web Apps deploy action. Do not expose its value. |

`API_PROXY_TARGET` is a local Vite development/preview setting only. The deployed frontend calls same-origin `/api`. `FUNCTIONS_WORKER_RUNTIME` appears in local Functions settings; the deployed managed API runtime is selected by `apiRuntime: node:22`.

Microsoft documents that Static Web Apps API application settings are configured per environment in the Azure portal and made available to the backend API as environment variables: [Configure application settings for Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/application-settings).

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

## Optional controlled judge rehearsal (separate authorization)

Do not run this sequence until the authorized owner has provisioned Azure Table Storage, configured the listed server settings and supplied an explicit rehearsal window/code. It is **not** part of the public release or completed verification. Keep the total at no more than six outbound attempts; failed attempts count. Use no more than six submitted analyses, including retries, and stop immediately on unexpected provider, fixture, identity, selected-time, allowance or export behavior.

1. **One baseline request:** valid access code, one prepared opinion on Northbridge–Eastport at 57′. Expect one Foundry interpreter call, correct fixture/time/evidence and Foundry provenance; public local mode must still report local rules.
2. **One clarification:** ambiguous Bruno judgement at 58′. Expect two player choices; resolving either choice must use the signed continuation, attribute the selected identity's records, retain limitations and make no second interpreter call.
3. **Three fixture-specific requests:** one prepared opinion each on Westhaven–Kingswell, Redmere–Alderwick, and the fourth fixture selected before the window. Expect each response to use only its fixture context and calculated evidence; stop on cross-fixture leakage or incorrect scope.
4. **Sixth request:** recheck the prepared 57′ baseline question at 58′. Expect one additional, correctly scoped interpreter call and comparison. This brings the total to six outbound attempts; do not make further successful judge requests.
5. **No-call checks:** switch language, inspect copied reply/PNG, browse squads and resolve the pending player without additional model calls. Verify output localization, exact identity/scope, limitation and provider; stop on secret leakage or stale/mixed-scope content.
6. **Exhaustion control:** after six reservations, send one explicit test request and expect a localized allowance denial with zero additional outbound model calls. Exercise concurrency only with the offline stub/emulator, not with excess hosted calls.

Expected outcomes for each live call must be captured before the rehearsal. If provider output is invalid or disagrees with validated evidence, stop; do not retry unless an explicitly budgeted attempt remains. Record sanitized request counts/statuses, never access codes, keys or raw credentials. This plan is a proposal only; it has not been run.

## Verified versus outstanding

- Offline verification covers the local public path, access-code rejection, shared/per-client limits, concurrency across store instances, restart persistence through shared state, storage/configuration failure, exhausted limits, failed-attempt reservation, continuation without a second interpreter call, and fixture-specific contexts.
- Azure Table SDK/emulator integration, hosted app settings, hosted Foundry calls and a real iPhone are **not verified**. The allowance behavior was exercised with an in-memory ETag-enforcing fake, not Azure.
- Hosted public acceptance, native iPhone sharing, independent native-speaker/screen-reader review and load testing remain outstanding.
- No merge, deployment, Azure resource change, credential change or live model/translation call was made.

## Remaining AI release blockers

- **Enforced request allowance:** implemented in code, but requires a pre-provisioned shared Azure Table and production configuration; neither exists in this change's verified environment. Cross-instance guarantees have only been tested with the ETag-enforcing fake, not Azure.
- **Judge access arrangement:** code-based server validation exists, but an approved judge roster/access-code distribution and operational window have not been established. The access code is a shared gate, not individual judge identity or authorization.
- **Foundry verification:** no live model call was made. A separately authorized, commit-pinned rehearsal of at most six calls remains outstanding, including expected outputs, observed allowance counts and stop conditions. Historical captures and constructed stubs are offline evidence only.
- **Public API exposure:** routes are anonymous and public analysis has no request allowance. The judge-only allowance does not mitigate public local-rules traffic. The release owner must accept or mitigate this availability exposure.

## Rollback

- For a bad build, dispatch the approved rollback commit from `main` through the same workflow and verify its checked-out SHA.
- For a compromised signing key, replace it consistently for all API instances, restart/redeploy, and expect outstanding clarification continuations to become invalid.
- For a compromised judge access code, disable `FOUNDRY_JUDGE_ENABLED`, rotate the code out-of-band, and restart/redeploy the API. This does not reset the shared allowance.
- To take the site offline, the authorized owner can disable/delete the Static Web App and revoke the deployment token. No destructive or Azure action is performed by this runbook.
