# Post-deadline public-AI access repair

## Summary

This focused repair is based on current `Origin/main` and does not change or deploy the currently hosted version. It removes the judge-code gate and makes anonymous Foundry interpretation the default when enabled by server configuration. The public route remains fail-closed behind the shared durable Azure Table allowance.

## Changes

- Ordinary analysis and explicit rechecks select Foundry server-side when `FOUNDRY_PUBLIC_ENABLED=true`; clients cannot enable AI with a request header or provider field.
- Remove the judge-code panel, client-held credential, access header, and access-verification API route.
- Preserve explicit local-rules selection. When AI is disabled, unconfigured, exhausted, or its allowance storage is unavailable, the UI gives a localized explanation and local-rules option.
- Reserve the durable `FoundryJudging` allowance before every outbound attempt. Preserve its existing row and counts; do not reset it during startup. Failed attempts count and automatic model retries remain disabled.
- Keep the owner-authorized limits at 200 shared attempts, 200 per client, and an 8,760-hour fixed UTC window. Preserve the existing completion-token maximum and server-only credentials/signing key.
- Keep clarification continuation, language changes, replay navigation, squad browsing and sharing from issuing additional interpreter requests.

## Verification

- API: **385/385 tests pass**, including TypeScript build and real Azure Table client integration against local Azurite.
- Azurite: **7/7 checks pass**, including updates, exhaustion, a real ETag conflict, two independent processes, restart persistence, storage failure, and failed outbound-attempt counting with stubbed Foundry transport.
- Web: **160/160 tests pass**; TypeScript build, production build and lint pass. Vite reports an existing minified bundle-size warning.
- `git diff --check` passes.
- All provider requests are stubbed. No live Foundry call, deployment, Azure change or credential change was made. Hosted Azure Table/Foundry behavior remains unverified.

## Production settings

Configure these only in the Static Web App's **Production backend environment variables**. Keep the existing signing key unchanged and server-only. Preserve the existing `FoundryJudging` table and counts. Do not configure or use a judge access code.

| Backend setting | Required value/format | Purpose |
|---|---|---|
| `CLAIM_INTERPRETER_PROVIDER` | `local` | Public provider factory stays local; the explicit backend gate selects Foundry. |
| `FOUNDRY_PUBLIC_ENABLED` | `true` after backend configuration is verified | Enables anonymous AI server-side. Set `false` to disable AI while retaining local rules. |
| `NODE_ENV` | `production` | Enforces production signing-key validation. |
| `PLAYER_RESOLUTION_SIGNING_KEY` | Keep current production value; canonical unpadded base64url, 43 characters | Server-only player-continuation signing key, same on all API instances. Do not rotate as part of this repair. |
| `FOUNDRY_OPENAI_BASE_URL` | `<HTTPS-FOUNDRY-OPENAI-COMPATIBLE-ENDPOINT>` | Server-side endpoint. |
| `FOUNDRY_API_KEY` | `<FOUNDRY-DEPLOYMENT-CREDENTIAL>` | Server-only credential. |
| `FOUNDRY_MODEL_DEPLOYMENT` | `<EXACT-DEPLOYMENT-NAME>` | Server-side deployment selector. |
| `FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING` | `<AZURE-TABLE-STORAGE-CONNECTION-STRING>` | Shared backend-only allowance storage; do not substitute `AzureWebJobsStorage`. |
| `FOUNDRY_ALLOWANCE_TABLE_NAME` | `FoundryJudging` | Existing allowance table; do not create a replacement to reset its count. |
| `FOUNDRY_ALLOWANCE_MAX_REQUESTS` | `200` | Authoritative shared attempt ceiling. |
| `FOUNDRY_ALLOWANCE_MAX_PER_CLIENT` | `200` | Per-client ceiling equal to the global ceiling. Client identity is a forwarded-IP hash, not a judge identity. |
| `FOUNDRY_ALLOWANCE_WINDOW_HOURS` | `8760` | Fixed epoch-aligned UTC window; no startup reset. |

`AZURE_STATIC_WEB_APPS_API_TOKEN` remains a repository Actions secret for the existing deployment workflow, not an application setting. The deployed frontend calls same-origin `/api`, not localhost.

## Release and manual deployment steps

1. Review and merge this repair PR only when approved; do not overwrite or reset the existing allowance table.
2. Verify backend setting names and the existing shared table/counts without logging secrets. Preserve the current production `PLAYER_RESOLUTION_SIGNING_KEY`.
3. Use the existing authorized workflow to deploy the selected `main` commit; confirm the workflow event SHA and checkout SHA match.
4. After the API restarts, set `FOUNDRY_PUBLIC_ENABLED=true` only when all backend settings and shared storage are verified. No access code is needed.
5. In hosted smoke checks, confirm anonymous analysis is labelled Foundry, local rules can be selected explicitly, and unavailable/exhausted allowance fails closed with a localized local-rules option. Keep local, built-preview and hosted results distinct.

No merge, deployment, Azure change, credential change or live model call was performed for this repair.
