# Public local-rules football evidence experience

## Summary

This PR brings the `feature/explore-more-matches` candidate into `main`. It provides a match replay and evidence workflow across four fictional fixtures: a user enters an opinion, selects a match time and evidence period, receives a validated interpretation and application-calculated supporting/counter evidence, and can compare a later recheck or share a receipt.

The public release is intentionally local-rules-only. Foundry remains disabled and no model call is made by this candidate.

## Included functionality

- Four selectable synthetic fixtures with server-owned replay frames, fixture identity/version, selected-time filtering and player attribution.
- Bounded claim interpretation that separates statistical requests, factual claims, subjective judgments, unavailable metrics and clarification. Statistics are calculated in application code.
- Fan and Analyst presentations, evidence and limitations, deterministic rechecks/comparisons, copied receipts and generated PNG receipts.
- English, Spanish, French, German and Arabic presentation, including Arabic identity aliases, RTL layout and mixed-script isolation. Changing language does not submit analysis or clear the current match/conversation/draft.
- Signed server-side player clarification and no-extra-interpreter-call selection, with original request scope preserved.
- 1′ ordinary replay entry without future outcome spoilers; explicit 57′→58′ guided comparison; ordered/cancelled replay requests, playback lifecycle handling, localized loading errors and explicit retry.
- Manual Static Web Apps deployment from `main`, pinned to the exact workflow-dispatch SHA.

## Verification

- API: 363/363 tests passed.
- Web: 151/151 tests passed.
- Web TypeScript build, production build and lint passed.
- `git diff --check` passed.
- Local browser acceptance covered all four fixtures at 1′ in five languages, replay ordering and retry, and the guided 57′→58′ comparison. The guided answers were 2–2 at 57′ and Eastport 3–Northbridge 2 at 58′.
- Built frontend smoke used a local API proxy. It was not hosted verification.

All current acceptance and build verification used the local provider. Prior live Foundry records are for earlier commits and do not verify this candidate.

## Deployment and configuration

See [the release runbook](./DEPLOYMENT_RUNBOOK.md) for backend application settings, signing-key format and rotation behavior, exact manual deployment sequence, and hosted acceptance.

The production backend must set `NODE_ENV=production`, `CLAIM_INTERPRETER_PROVIDER=local`, and `PLAYER_RESOLUTION_SIGNING_KEY` (32 random bytes, canonical unpadded base64url). Keep the key server-only and identical across all API instances. The workflow consumes only the repository Actions secret `AZURE_STATIC_WEB_APPS_API_TOKEN`. Do not configure Foundry settings.

The workflow runs only when manually dispatched from `main`; it checks out `${{ github.sha }}` so the deployed source is the exact selected commit. The deployed frontend calls same-origin `/api`, not localhost.

## Limitations and release gates

- Hosted Azure acceptance and actual iPhone native sharing remain unverified.
- The public API routes are anonymous and there is no durable enforced request allowance. The release owner must accept this exposure or block public release pending shared, atomic allowance enforcement and tests.
- No judge-accessible Foundry route or durable AI allowance is implemented. Do not enable Foundry. A separately authorized, commit-pinned live verification remains outstanding.
- Independent native-speaker/screen-reader review and load testing remain outstanding.
- No merge, deployment, Azure resource change, credential change or live model call was made in this preparation.
