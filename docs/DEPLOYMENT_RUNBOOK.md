# Hackathon deployment runbook (public, local-provider only)

Status: **prepared, not executed.** No Azure resource exists, nothing has been deployed, and no billing has been changed. All match data is synthetic.

## Candidate

| Item | Value |
| --- | --- |
| Source branch | `feature/take-investigation` |
| Candidate commit | the head of the consolidated PR to `main` (record the exact SHA on the PR; the deployment must be built from `main` after merge, so the deployed SHA is the merge commit) |
| Workflow | `.github/workflows/shared-preview.yml` ("Deploy shared preview"): `workflow_dispatch` only, runs only on `main`, builds `apps/web` and `apps/api`, no GitHub environment |
| Access | **Public, no sign-in.** `apps/web/public/staticwebapp.config.json` has no route rules or roles |
| Interpreter | `CLAIM_INTERPRETER_PROVIDER=local`. No Foundry settings are set |

## Azure resource settings

| Setting | Value |
| --- | --- |
| Resource type | Static Web App (one) |
| Plan | **Free** |
| Region | any supported; choose one near judges |
| Deployment source | **Other** (do not connect GitHub in the wizard, so Azure does not add a push-triggered workflow) |
| API | managed Functions, Node 22 (from `platform.apiRuntime`) |
| Application setting | `CLAIM_INTERPRETER_PROVIDER` = `local` |
| Do NOT add | `FOUNDRY_API_KEY`, `FOUNDRY_OPENAI_BASE_URL`, `FOUNDRY_MODEL_DEPLOYMENT` |
| Custom roles / Entra | none required; do not invite users |
| Not created | no Function App, API Management, database, storage, Application Insights or Foundry resource |

## Secret names

| Where | Name | Purpose |
| --- | --- | --- |
| GitHub repository Actions secret | `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deployment token for this Static Web App. The only secret the workflow reads |
| Static Web App application settings | `CLAIM_INTERPRETER_PROVIDER` (not secret) | Selects local rules |

Never put the token or any credential in a file, log or PR comment.

## Deployment steps (after approval)

1. Review and merge the consolidated PR to `main` (owner decision; this runbook does not merge).
2. Restrict repository write access and protect `main`. The workflow has no approval gate: anyone with write access can dispatch it.
3. In Azure, create the Static Web App as above. Copy its deployment token into the repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.
4. In the Static Web App, set application setting `CLAIM_INTERPRETER_PROVIDER=local`.
5. GitHub → Actions → **Deploy shared preview** → Run workflow on `main`. Note the run's commit SHA.

## Verification steps

1. Open the HTTPS URL in a private window: the page loads with no sign-in prompt.
2. Run the walkthrough in [TEAM_DEMO.md](../TEAM_DEMO.md): 57′ shots-on-target answer (2–2, contradicted), Check again at 58′ (3–2, supported), direct comparison, Share what changed card (copy and PNG).
3. Confirm each answer is labelled "Local rules · no model connection" and no answer says Foundry. Check the API response: `provider` is `local`.
4. `POST /api/analyze` with `{"opinion":"How many shots did Eastport have?","selectedClock":{"period":2,"minute":90,"stoppageMinutes":4},"period":"match-so-far"}` returns 200 with 8 shots; an over-2,000-character opinion returns 400.
5. Confirm the Static Web App has no Foundry application settings.

## Rollback

- **Bad build:** re-run the workflow from `main` after reverting the offending commit; the previous production build is replaced.
- **Take offline immediately:** delete the Static Web App in the Azure portal (stops the site, API and billing for that resource) and remove `AZURE_STATIC_WEB_APPS_API_TOKEN` from repository secrets. To pause without deleting, rotate the deployment token in Azure so the workflow can no longer deploy.
- Nothing else needs unwinding: no database, no Foundry deployment and no other Azure resources are created.

## Exposure and cost (inspected, not load-tested)

What the code does: two POST routes (`/api/analyze`, `/api/replay`) with `authLevel: anonymous`; no secrets, no outbound calls and no persistence with the local provider. Opinions are capped at 2,000 characters and at most 8 claims; the clock is validated against the fixture. Measured locally: ~10 ms per request, ~60 KB response; oversized or pathological opinions are rejected in ≤ 10 ms. `request.json()` parses the body before validation, but the platform's documented request-size limit is 30 MB.

Material exposure, stated plainly:

- **Anyone can call the API without limit.** Static Web Apps has no per-client rate limiting and, on the Free plan, no IP restrictions or private endpoints. An anonymous client can generate sustained traffic. Removing Foundry removes model-token spend and credential risk; it does **not** make hosting unlimited or free of cost.
- **Free-plan quota.** Documented: 100 GB included bandwidth per month per subscription, with overage "unavailable" on Free (so bandwidth abuse risks the quota or throttling rather than a bill, but exact behaviour was not tested). At ~60 KB per analysis response that is roughly 1.6 million analyses before the quota, ignoring page assets.
- **Compute.** Managed Functions run on the platform's consumption model; the Free plan lists no separate charge, but this was not verified in a subscription. Billing terms and quotas must be checked in the target subscription before approval.
- **No monitoring.** No Application Insights is configured, so abuse would not be visible except through the portal's metrics.
- **Essential protection:** keep Foundry out of this deployment (enforced by tests and the runbook), restrict repo write/`main` and the deployment token, set an Azure budget alert on the subscription, and be ready to delete the app or rotate the token. If the event expects hostile traffic, a Standard plan (IP restrictions) or a fronting service with rate limiting would be required; that is not part of this candidate.
- GitHub Actions minutes for the manual deployment are separate from Azure and depend on the organisation plan.

## Approval checklist

- [ ] Consolidated PR reviewed and merged to `main` by the owner
- [ ] Azure subscription, region and budget alert agreed; Free plan quotas confirmed
- [ ] `main` protected; deployment secret added
- [ ] Decision on whether unauthenticated, unlimited public access is acceptable for the event
- [ ] Repository visibility decision (this runbook does not change it; history was scanned, see the PR description)
