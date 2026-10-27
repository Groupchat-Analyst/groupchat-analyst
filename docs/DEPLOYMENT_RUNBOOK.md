# Release and deployment runbook

Status: **prepared, not executed**. No Azure resource has been created and no deployment has run. The release candidate is `feature/explore-more-matches`; application work is in `4d845e3`, with the branch release handoff at `01f1ee9`. The public release must use the local-rules provider. This runbook does not authorize a merge, deployment, Foundry enablement or Azure change.

## Candidate and workflow

| Item | Value |
| --- | --- |
| PR base | `main` |
| Candidate branch | `feature/explore-more-matches` |
| Application candidate | `4d845e3` |
| Current documented branch head | `01f1ee9` |
| Workflow | `.github/workflows/shared-preview.yml` |
| Trigger | `workflow_dispatch` only; job runs only when dispatched from `main` |
| Source pin | `actions/checkout` checks out `${{ github.sha }}` so the workflow deploys the exact commit selected at dispatch |
| Build/deploy | Azure Static Web Apps action builds `apps/web` and `apps/api` |
| Frontend API URL | Same-origin `/api`; no deployed `localhost` URL or `API_PROXY_TARGET` |
| API runtime | Node 22, declared in `apps/web/public/staticwebapp.config.json` |
| Access | Public, no sign-in; API functions use anonymous authorization |

The workflow has no automatic push or PR deployment, no GitHub environment approval gate, and no integration tests in its deployment job. Build verification must pass before merge and hosted acceptance is a separate release gate.

## Required configuration

Configure backend values in the Static Web App's **Settings → Environment variables → Production**. These settings are available to the backend API and are not frontend build-time variables.

| Name | Required value/format | Purpose |
| --- | --- | --- |
| `CLAIM_INTERPRETER_PROVIDER` | Literal `local` | Explicitly selects the rule-based interpreter. Keep this value for the public release. |
| `NODE_ENV` | Literal `production` | Activates the production signing-key guard. Do not rely on an implicit platform default. |
| `PLAYER_RESOLUTION_SIGNING_KEY` | 32 cryptographically random bytes, encoded as canonical unpadded base64url (43 characters) | HMAC-SHA256 signing key for player-clarification continuation tokens. Keep it server-only in the Static Web App API environment variables. Never put it in source, a GitHub build variable, frontend configuration, logs, screenshots or a PR. |

The application fails explicitly for player clarification when `NODE_ENV=production` and the signing key is absent, and rejects a malformed key. The process-local development key is used only when the production guard is not active; therefore `NODE_ENV=production` is a release prerequisite, not an optional optimization. Before opening the public URL, verify both production settings are present without displaying or copying the key value.

All API instances must receive the **same** signing key. A process-local development key is intentionally not shared across instances or restarts and must never be used for production. Changing the production key requires applying the same replacement to the environment and restarting/redeploying the API instances; otherwise a continuation issued by one instance can fail on another. Continuation tokens currently have no explicit expiry. Rotating the key invalidates every still-held token signed with the old key, so users must submit the original opinion again to obtain a new clarification.

### GitHub Actions secret

| Name | Location | Purpose |
| --- | --- | --- |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Repository Actions secret | Opaque deployment token consumed by the Static Web Apps deploy action. Do not expose its value. |

### Do not configure for this release

- Do not set `CLAIM_INTERPRETER_PROVIDER=foundry`.
- Do not configure `FOUNDRY_OPENAI_BASE_URL`, `FOUNDRY_API_KEY`, `FOUNDRY_MODEL_DEPLOYMENT`, or `FOUNDRY_CAPTURE_RAW_OUTPUT`.
- `API_PROXY_TARGET` is a local Vite development/preview setting only. The deployed frontend calls same-origin `/api`.
- `FUNCTIONS_WORKER_RUNTIME` appears in local Functions settings; the deployed managed API runtime is selected by `apiRuntime: node:22` in the Static Web Apps configuration.

Microsoft documents that Static Web Apps API application settings are configured per environment in the Azure portal and made available to the backend API as environment variables: [Configure application settings for Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/application-settings).

## Exact release sequence

1. Review the complete PR diff into `main`, confirm the final PR head and all required checks, and resolve or explicitly accept the public unauthenticated API exposure described below. Do not merge until the release owner approves.
2. Before production traffic, create/configure the approved Static Web App resource, verify Node 22 and public access expectations, and set the three backend values above in its **Production** environment. Add `AZURE_STATIC_WEB_APPS_API_TOKEN` to repository Actions secrets. Do not set any Foundry configuration.
3. Have the authorized owner merge the PR. Record the resulting `main` merge commit SHA (`M`); this will not be known before merge.
4. On GitHub Actions, manually dispatch **Deploy shared preview** with the `main` ref at `M`. The workflow rejects non-main dispatches and checks out `${{ github.sha }}`, so it deploys the exact selected `main` commit. Verify the run's event SHA and checkout SHA both equal `M`; stop and investigate if they differ. This document does not dispatch the workflow.
5. Once the workflow succeeds, open the deployed HTTPS URL in a fresh private browser context and perform the hosted acceptance below. Verify the configured provider and signing behavior using app responses/UI without printing or exporting secrets. Do not infer success from the workflow status alone.

## Hosted acceptance checklist

Record each result with the deployment URL, workflow run URL, deployed SHA, browser/device, language and timestamp. Keep local verification separate from hosted results.

1. **Fresh entry:** with clean browser storage, visit Home → Try it Out → each of the four fixture routes. Confirm the selected fixture/version, 1′, 0–0 and no events; later goals/results must not appear ahead of the selected clock. Confirm replay requests succeed and no analysis occurs on entry.
2. **Replay and comparison:** move through earlier/later times and test a backward seek. On the baseline fixture, choose the explicit guided walkthrough: preparing 57′ makes no analysis request; explicit submit returns the 2–2 shots-on-target answer; moving to 58′ makes no request; recheck produces Eastport 3–Northbridge 2 and a correctly scoped comparison.
3. **Player clarification and retry:** submit an ambiguous player request and choose each presented candidate in separate trials. Confirm the selected player's evidence and the original fixture/time/period are retained. Exercise a failed choice request, explicit retry, and successful resolution; verify no extra interpreter call is made for selection.
4. **Languages:** change among English, Español, Français, Deutsch and العربية while preserving the match, selected clock, period, draft and conversation. Verify a fresh route in each language and inspect Arabic RTL text, mixed-script identities, score and minutes.
5. **Receipts:** inspect copied reply and copied card text; download and inspect a generated PNG for original opinion, chosen player where relevant, figures, selected-time scope, fixture/version and accurate provider disclosure. Verify a failed copy/download is reported. Hosted browser verification does not establish native share-sheet behavior.
6. **Real iPhone:** on an actual iPhone, open the HTTPS URL in Safari, repeat the guided comparison and use the native share sheet with the generated PNG. Confirm readability and actual share-sheet behavior. Record this separately from desktop/mobile emulation.
7. **Provider and secrets:** confirm analysis responses and disclosures say `local`/local rules; no Foundry provider or model label appears. Confirm a player clarification completes, which exercises signing without logging the key. Inspect the Azure environment-variable names/presence only; never reveal values in test logs or evidence.

## Verified versus outstanding

- Local verification for the candidate includes 151/151 web tests, 363/363 API tests, web build/typecheck/lint and `git diff --check`; browser acceptance used local rules and local services.
- Built-frontend smoke testing used Vite preview with a local API proxy; it did **not** exercise Azure, a hosted URL, hosted app settings or a real device.
- Hosted acceptance and real-iPhone sharing are **not yet verified**. Do not label local checks as hosted verification.
- Current deployment workflow uses the GitHub Actions token and Azure Static Web Apps configuration; no deployment or Azure resource changes were performed for this candidate.

## Release blockers and exposure

- **Durable request allowance:** not implemented. Before relying on the public endpoint, decide the allowed volume/window and exhaustion behavior, add durable shared state and atomic enforcement across API instances, define any reset/expiry and abuse identity model, expose a clear limit response, and test concurrency, restart and multi-instance behavior. Agree on monitoring and an operator response. Until then, the API is anonymous and has no enforced total-request allowance.
- **Judge-accessible Foundry route:** not implemented or enabled. Separately approve who can access it and how they authenticate; isolate it from the public local-rules route; define a bounded request/token budget and exhaustion UX; configure server-side credentials; and add provider-specific acceptance and failure tests before any route is made available.
- **Outstanding live verification:** no live model call was made for this release candidate. Obtain fresh explicit authorization, pin the exact application commit and provider configuration, agree the bounded acceptance inputs/expected results and stop conditions, and record a sanitized ledger before a future run. Historical live ledgers apply to earlier application commits and do not verify this candidate.
- **Public API exposure:** both API routes are anonymous; the durable allowance is absent. Removing Foundry avoids model spend, but does not eliminate availability/traffic risk. Decide whether this is acceptable, protect repository write access and `main`, set an Azure budget alert, and confirm plan quotas/costs in the target subscription before public release.
- **Other outstanding checks:** hosted verification, native share on a real iPhone, independent native-speaker/screen-reader review and load testing.

## Rollback

- For a bad build, dispatch the approved rollback commit from `main` through the same workflow and verify its checked-out SHA.
- For a compromised signing key, replace it consistently for all API instances, restart/redeploy, and expect outstanding clarification continuations to become invalid.
- To take the site offline, the authorized owner can disable/delete the Static Web App and revoke the deployment token. No destructive or Azure action is performed by this runbook.
