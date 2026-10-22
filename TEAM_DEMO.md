# Groupchat Analyst shared preview

## Status and access

This is a deployment handoff, not a live preview: no preview URL or Azure resource has been created. The prepared source is based on reviewed commit `65cc0f59a868e810d952085f961d6a81672b9ef8`.

After the owner approves deployment, Rob will receive an invitation to the Azure Static Web App role `preview-user` at his chosen Microsoft account address. He opens the resulting HTTPS URL and signs in with that same account. The app and `/api/*` routes require that role; an authenticated but uninvited account is not granted access. The initial deployment must keep `CLAIM_INTERPRETER_PROVIDER=local`, so preview traffic cannot spend Foundry tokens. The API is served as the Static Web App's managed Functions API, not as a separate public Function App.

The invitation, URL, deployment token, and any future service credentials must be handled outside source control. Do not configure Foundry credentials for the initial preview.

## What Rob can try

The prototype analyses one complete **fictional match** using synthetic events, possessions, passes, player actions, and annotations. It returns claim-specific statistics, evidence, historical cutoffs, clarifications, and limitations. The data is a demonstration, not footage or observed professional performance. The local interpreter recognizes a bounded question vocabulary; it is not a general-purpose chat model.

Suggested walkthrough:

1. **Statistics:** ask “How many passes did Northbridge complete?” and inspect the counts, calculation trace, and evidence records.
2. **Historical evidence:** select `90+4′` and Match so far, then ask “Before Northbridge scored at 45+3, how many passes had they completed?” The fixture supports 14 of 18 passes (77.8%) strictly before the goal anchor.
3. **Clarification:** ask “How many passes did Bruno complete?” The fixture has two players named Bruno, so the app should ask which one.
4. **Unavailable measurements:** ask how far a player ran. Running distance is not recorded; the response should say so rather than substitute unrelated statistics.

Explicit build-up phase-scoped passing counts, rates, and comparisons are unsupported. The build-up-loss annotations cover only a partial sample. Possession, shots, sparse player actions, and these annotations cannot establish overall performance, territorial control, tactical causes, or a complete player rating. Past live evaluations were small and do not establish production reliability.

## Reporting a problem

Send the report privately to the project owner; do not include credentials, access tokens, or personal information beyond what is necessary.

```text
Exact question:
Selected match time:
Selected period:
Expected behavior:
Actual response:
Browser address and approximate time:
```

## Proposed hosting and access setup

| Component | Proposal | Current state |
| --- | --- | --- |
| Web app and HTTP API | Azure Static Web Apps Free, with its managed Azure Functions API | Configuration prepared; resource not created |
| API runtime | Managed Functions Node.js 22, selected in `staticwebapp.config.json` | Matches the project's Node 22 baseline; not cloud-tested |
| Access | Microsoft Entra sign-in and a manually invited `preview-user` role; route rules protect both the site and API | Configuration prepared; Rob's invitation requires a deployed resource |
| Interpreter | Local deterministic interpreter | Must be explicitly selected in the Static Web App's server-side application settings |
| Foundry | Disabled for this preview | No credentials or model deployment configured |
| Deployment | Manually dispatched GitHub Actions workflow, protected by the `shared-preview` environment | Workflow prepared; Azure deployment token and environment approval are not configured |

Azure CLI and Azure PowerShell modules are not installed in the current workspace, so no active subscription or existing Azure resource could be inspected. The plan above is a proposal; it does not assume any resource already exists.

## Owner deployment handoff

1. Review and approve this setup and the cost assumptions below. In Azure, create a Static Web App on the **Free** plan in the desired region, connected to the intended repository. Do not enable Foundry.
2. In GitHub repository settings, create the `shared-preview` environment and require owner approval. Add the Static Web Apps deployment token as the environment secret `AZURE_STATIC_WEB_APPS_API_TOKEN`; never place its value in a file or log.
3. Configure the Static Web App application setting `CLAIM_INTERPRETER_PROVIDER=local`. Do not add `FOUNDRY_API_KEY`, `FOUNDRY_OPENAI_BASE_URL`, or `FOUNDRY_MODEL_DEPLOYMENT`.
4. After the reviewed branch is merged through the normal review process, manually run **Deploy shared preview** from the approved default-branch revision. The workflow builds `apps/web` and `apps/api`; it is not triggered by pushes or pull requests.
5. In the Static Web App's role management, invite Rob's chosen Microsoft account with role `preview-user`. Share the HTTPS address privately and verify an uninvited account is denied before inviting him.
6. Smoke-test the four walkthroughs above and confirm the displayed response and copy action agree. Share the URL only with invited users.

### Cost and operational limits

- The Azure Static Web Apps **Free** plan is listed as free, with 100 GB included monthly bandwidth at the subscription level. The managed Functions API is part of the Static Web Apps integration; this proposal adds no standalone Function App, API Management instance, database, or Application Insights resource.
- With the local interpreter selected, Foundry usage is **$0**. No model calls are part of this deployment. GitHub Actions consumption is separate and depends on the repository's plan and remaining allowance.
- Static Web Apps API requests have a documented 45-second maximum duration. Free-plan quotas and current eligibility must be checked in the target subscription before deployment. Pricing and availability vary by region and account; verify in the Azure Pricing Calculator before approving.
- This role gate limits access to explicitly invited users, but it is not a durable per-user request quota. Do not enable Foundry on this preview until a separately reviewed spend-control design adds enforceable request/token limits and an operational shutdown path. Azure budget alerts alone are notifications, not hard spending caps.

### Disable and clean up

To revoke Rob's access, remove his `preview-user` role assignment in Static Web Apps role management. To take the preview offline and stop its Azure resource billing, delete the Static Web App in the Azure portal and remove the deployment token from the GitHub environment. If a Foundry deployment is ever separately enabled, disable or delete it independently; deleting the website does not delete a separate model deployment.

## Official references

- [Static Web Apps plans and features](https://learn.microsoft.com/azure/static-web-apps/plans)
- [Static Web Apps quotas](https://learn.microsoft.com/azure/static-web-apps/quotas)
- [Static Web Apps routing, roles, and configuration](https://learn.microsoft.com/azure/static-web-apps/configuration)
- [Static Web Apps authentication and authorization](https://learn.microsoft.com/azure/static-web-apps/authentication-authorization)
- [Managed Functions API support and constraints](https://learn.microsoft.com/azure/static-web-apps/apis-functions)
- [Static Web Apps supported API runtimes](https://learn.microsoft.com/azure/static-web-apps/languages-runtimes#api)
- [Azure Static Web Apps pricing](https://azure.microsoft.com/pricing/details/app-service/static/)
- [Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/)
- [Azure Functions pricing](https://azure.microsoft.com/pricing/details/functions/)
- [Microsoft Foundry pricing](https://azure.microsoft.com/pricing/details/microsoft-foundry/)
