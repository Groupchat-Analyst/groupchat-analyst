# Groupchat Analyst

Groupchat Analyst helps football fans assess group-chat opinions using relevant, traceable match evidence. The intended flow is: enter an opinion, identify its separate claims, retrieve evidence for and against each claim, assess what the evidence establishes, and produce a shareable explanation.

## Current prototype

The mobile-friendly React website calls a local TypeScript API instead of calculating match statistics or assessing claims in the browser. The original fixture retains 16 fictional shot/score events for regression coverage. A deterministic richer companion fixture adds 26 possession intervals across both halves, synthetic passes with player IDs, outcomes and normalized start/end locations, recorded turnovers/recoveries, selected pressure records, lineups and substitutions. It is labelled synthetic throughout and is independently authored, not generated from a user's opinion. It is an architectural demonstration, not a reproduction of Arsenal's internal analysis system or any professional club's proprietary data.

The API calculates possession duration/percentage, pass attempts/completions/accuracy, pass-turnover locations and completed-pass entries into the final third from those records. It distinguishes statistical requests, factual claims, subjective judgements, unavailable metrics, coaching questions, and unrecognized language. A pass-completion request returns attempts, completions, percentage, numerator/denominator definitions and all included pass IDs without assigning a truth verdict. Running distance is explicitly unavailable. Build-up questions return the relevant team's linked turnover/pass records and area counts, but clearly state that no build-up phase is defined, so the counts cover all recorded pass turnovers. A precise comparison such as “Northbridge had more possession than Eastport” is assessed from controlled-possession percentages. Broader claims such as “dominated possession” show supporting and challenging possession context—without treating possession share as proof of overall dominance.

The local server interpreter separates simple claims while preserving coordinated team names in one statistical request. It recognizes bounded factual comparisons, possession, passing and “against the run of play” evidence needs. It resolves a pronoun-led claim to a team when exactly one team is explicitly named in that claim; otherwise, it asks which team the user means and withholds claim-specific evidence until clarified. Unrecognized wording and unavailable metrics do not fall through to unrelated match events. The “against the run of play” assessment is anchored to Northbridge's 45+3′ goal (`event-07`) and compares recorded match play strictly before that goal. The goal is shown separately from the pre-goal evidence. Possession share is available as a synthetic interval-derived measure; it cannot establish territorial control, chance quality, or by itself prove that a team “controlled” the match.

> “Eastport controlled possession of the game, Northbridge scored against the run of play.”

is represented as two claims. The first can show the recorded possession-share comparison as relevant context, but does not redefine “controlled” as “had more possession” or reach a definitive control verdict from that metric alone. The second is anchored to Northbridge’s goal at `45+3′` (`event-07`) and retrieves recorded events **strictly before** that goal. The goal appears separately as the historical anchor, not as evidence inside the before-goal period. Missing territorial-control and chance-quality information is stated specifically; available shots and other events remain context, not substitutes for missing evidence.

The browser sends only the opinion, selected match clock, and selected evidence period. It never sends fixture events or calculated statistics. Statistics and event filtering run in server-side TypeScript. Model output is validated against a typed claim contract before it is used; invalid output fails explicitly. The local rule-based interpreter is the default and is not a Microsoft AI model. A Microsoft Foundry structured-output adapter is prepared but disabled unless `CLAIM_INTERPRETER_PROVIDER=foundry` is explicitly configured.

The concise answer appears first; the expandable evidence foundation includes the capability catalogue, metric definitions, clipped possession intervals, pass/turnover/recovery/pressure references, lineups and substitutions. First-half stoppage time is shown as `45+N`; second-half stoppage time as `90+N`. Recent-minute windows exclude half-time and include both boundaries. A historical “before event” period uses a strict exclusive cutoff. Possession intervals are clipped to the selected window, and future end reasons/outcomes are not exposed. Events after the selected match time are not sent to the interpreter, included in score/stat calculations, or returned as references.

See [the synthetic data dictionary](./apps/shared/DATA_DICTIONARY.md) for the typed record specification, coverage semantics, time conventions, and exact metric definitions.

## Run locally on Windows

Prerequisites for the complete local app:

- Node.js 22 and npm.
- Azure Functions Core Tools v4 (Node.js worker).

If Functions Core Tools is missing, install and verify it from PowerShell:

```powershell
npm.cmd install --global azure-functions-core-tools@4
func.cmd --version
```

This API registers only an HTTP trigger and has no storage bindings, queues, timers, or blob triggers. Its local settings therefore omit `AzureWebJobsStorage`; Azurite is not required. First, from the project root, make a private local settings file:

```powershell
cd apps\api
Copy-Item local.settings.example.json local.settings.json
```

In a PowerShell terminal, start the API:

```powershell
cd apps\api
npm.cmd install
npm.cmd start
```

In a third PowerShell terminal, start the website:

```powershell
cd apps\web
npm.cmd install
npm.cmd run dev
```

To use the currently verified demo address without colliding with an existing Vite process, start the website with:

```powershell
cd apps\web
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Open `http://127.0.0.1:5174/`. Vite proxies `/api` requests to the Functions host at `http://127.0.0.1:7071`. Keep both servers running while using the app. `local.settings.json` and environment files are ignored by Git.

### Earlier event-only baseline browser verification

Verified locally with Azure Functions Core Tools `4.16.0`, Node.js `22.23.3`, and npm `10.9.9`:

- The Functions host registered `POST http://localhost:7071/api/analyze`.
- The browser app ran at `http://127.0.0.1:5174/` because another Vite process already occupied port 5173. Its `/api/analyze` request reached the Functions host through Vite's proxy and returned HTTP 200.
- Submitting the exact compound example rendered two claims. Possession was identified as unavailable with no shooting statistics substituted. The Northbridge evidence list ended at `event-06` (`45+2′`); `event-07`, Northbridge's goal at `45+3′`, appeared separately as the anchor. The copied summary matched the displayed server summary.
- “Eastport had more shots on target than Northbridge” was contradicted at 57′ (shots on target 2–2) and supported at 58′ (shots on target 2–3), both through HTTP 200 requests.
- With the Functions host stopped, the browser received the Vite proxy's HTTP 502, showed “The analysis service is unavailable (HTTP 502). Start the local Azure Functions API and try again.”, and cleared the prior assessment rather than presenting it as new.

The HTTP-only Functions host starts and serves requests without Azurite when `AzureWebJobsStorage` is omitted. Core Tools did emit an unhealthy storage health-check warning because no storage connection was configured; the registered HTTP function remained available and returned successful responses. This API has no storage-backed bindings, so Azurite was not installed or started. These browser results verified the earlier event-only baseline; the richer possession/passing user flows are being separately checked for this milestone.

### Rich possession/passing milestone browser checks

Verified in the browser at `http://127.0.0.1:5174/` against successful HTTP 200 requests to the local API at `http://127.0.0.1:7071/`. The response provider was `local`; Foundry remained disabled.

- The three-claim acceptance input produced exactly three claims with subjects Eastport, Northbridge, and Eastport. Possession-share statistics (Northbridge 56%, Eastport 44%) appeared as context for “controlled possession”; the app did not treat that broad judgement as proven. The “comfortable” claim remained insufficient for a firm conclusion.
- The “against the run of play” claim anchored to `event-07` at `45+3′`. Its pre-goal event references were `event-01` through `event-06`; `event-07` appeared separately as the anchor, with no later event references in that claim. The displayed summary matched the API summary, and the browser clipboard reported “Assessment copied”; clipboard content included the same summary after normalizing line endings/whitespace.
- The factual claim “Eastport had more shots on target than Northbridge” was contradicted at 57′ (score 1–0) and supported at 58′ (score 1–1). Both requests returned HTTP 200 and had no future event references. At 58′ with “Last 10 minutes”, the score remained 1–1; Northbridge had 1 shot/0 on target and Eastport had 1 shot/1 on target.
- “Northbridge had more possession than Eastport” was supported from the interval-derived 56% vs 44% comparison. “Where are we losing possession during build-up?” returned both teams without guessing who “we” meant; recorded turnover counts were Northbridge 8 and Eastport 9, and the limitation stated that locations do not establish why possession was lost.
- The detailed evidence panel showed the synthetic fixture's calculated possession, pass completion, turnover-area and final-third-entry metrics. These are demonstration records, not observed football data.
- At a 375-pixel mobile viewport, the page had no horizontal overflow.

### Evidence-intent regression browser checks

Rechecked against the final local API build on `http://127.0.0.1:7071/` from the browser at `http://127.0.0.1:5174/`. Each exact submission returned HTTP 200 from the `local` provider, and the displayed and copied summary matched the API response.

| Input | Observed result |
|---|---|
| “Compare Northbridge and Eastport's pass completion rates.” | One statistical request, not two claims or a truth verdict. Northbridge: 30/38 completed (78.9%); Eastport: 23/32 (71.9%). The calculation trace covers all 70 pass records, distinguishing each completion numerator from its team attempt denominator. |
| “Eastport ran further than Northbridge.” | Explicitly unavailable: running distance and physical/continuous-tracking data are not recorded. No shooting statistics or unrelated event evidence were returned. |
| “Where are Eastport losing possession during build-up?” | Led with 9 all-pass Eastport turnovers: 0 defensive-third, 7 middle-third, 2 final-third. All nine turnover records and their linked passes were cited. The response states that no build-up-phase filter exists, so these counts do not answer a build-up-only question or explain causes. |
| “Eastport dominated possession during this game and Northbridge scored against the run of play. It was a comfortable match for Eastport.” | Exactly three claims, subjects Eastport/Northbridge/Eastport. The 44% vs 56% possession comparison challenges the possession aspect but does not establish overall dominance. The goal at `event-07` (`45+3′`) is a separate anchor; historical evidence is strictly earlier (`event-01`–`event-06`). “Comfortable” remains insufficient for a firm conclusion. |

The expandable evidence foundation exposes the returned synthetic raw pass and turnover records. Calculation traces include every included record ID and explicitly identify each denominator, so the aggregate values can be independently checked. These observations are browser checks, not inferences from automated tests.

## Checks

Run from the project root:

```powershell
cd apps\api
npm.cmd test
```

This compiles the API and runs service and evidence-calculation tests, including comparison verdicts, historical cutoffs, interval clipping, manually checked possession/pass calculations, halftime boundaries, data provenance, and incomplete-coverage handling.

In a separate terminal, run the existing web/domain checks:

```powershell
cd apps\web
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

## Microsoft Foundry model enablement

No Azure resources have been created and no model service has been called. To enable the prepared adapter later, an administrator/user will need:

1. An Azure subscription and a Microsoft Foundry resource or Azure OpenAI resource in a supported region.
2. A deployed model whose Chat Completions endpoint supports strict JSON Schema structured outputs.
3. The resource's Azure OpenAI-compatible v1 endpoint and a key for key-based authentication. This implementation currently uses the server-side `api-key` header; it does not support browser credentials or Entra ID tokens.
4. The exact model deployment name.

Microsoft documents the endpoint shape as `https://<resource>.openai.azure.com/openai/v1/`, key-based authentication, and deployment naming for the `model` field. See [Microsoft Foundry structured outputs](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) and the [Azure OpenAI v1 API](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle).

Put the values only in the ignored `apps\api\local.settings.json` file or in the server's environment:

```json
{
  "CLAIM_INTERPRETER_PROVIDER": "foundry",
  "FOUNDRY_OPENAI_BASE_URL": "https://<resource>.openai.azure.com/openai/v1",
  "FOUNDRY_API_KEY": "<server-side key>",
  "FOUNDRY_MODEL_DEPLOYMENT": "<deployed model name>"
}
```

The API still calculates statistics and validates every returned claim. The model interprets language only; it does not decide the score, generate statistics, or supply event evidence. The default setting remains local rules, and no cloud, messaging, or publishing integration is included.

## Current limitations

The local interpreter is intentionally bounded and is not a general language model. Its clause splitting and supported comparison language are limited. The richer synthetic fixture does not reproduce professional match analysis. Its intervals, pass outcomes, locations, and event references are fabricated for demonstration; partial pressure events are not continuous pressing evidence. Possession percentage is defined over recorded controlled minutes and excludes contested/out-of-play time. Thirds/entries are simple normalized-coordinate definitions. The data cannot establish tactical causes, defensive shape, chance quality, physical workload, or whether possession/dominance means a team played better. There is no video or continuous tracking and no calibrated xG. The Foundry adapter is unenabled and has not been tested against a live deployment.

The project licence remains undecided.
