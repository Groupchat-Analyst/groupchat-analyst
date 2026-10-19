# Groupchat Analyst

Groupchat Analyst helps football fans assess group-chat opinions using relevant, traceable match evidence. The intended flow is: enter an opinion, identify its separate claims, retrieve evidence for and against each claim, assess what the evidence establishes, and produce a shareable explanation.

## Current prototype

The mobile-friendly React website calls a local TypeScript API instead of calculating match statistics or assessing claims in the browser. A shared, clearly labelled synthetic fixture contains 16 events for fictional Northbridge vs Eastport. The API loads that fixture, validates the selected match time and period, filters events, calculates the score and statistics, and returns each claim with its evidence, limitations, and a concise summary.

The local server interpreter separates simple clauses and recognizes the existing narrow factual comparisons, plus possession and “against the run of play” evidence needs. It resolves a pronoun-led clause to a team when exactly one team is explicitly named in that same clause; otherwise, it asks which team the user means and withholds claim-specific and full event lists until clarified. Subjective opinions such as “comfortable” receive relevant events as context, not as proof. The acceptance example,

> “Eastport controlled possession of the game, Northbridge scored against the run of play.”

is represented as two claims. The first requests unavailable possession data. The second is anchored to Northbridge’s goal at `45+3′` (`event-07`) and retrieves recorded events **strictly before** that goal. The goal appears separately as the historical anchor, not as evidence inside the before-goal period. Missing possession and territorial-control information is stated specifically; available shots and other events remain context, not substitutes for missing evidence.

The browser sends only the opinion, selected match clock, and selected evidence period. It never sends fixture events or calculated statistics. Statistics and event filtering run in server-side TypeScript. Model output is validated against a typed claim contract before it is used; invalid output fails explicitly. The local rule-based interpreter is the default and is not a Microsoft AI model. A Microsoft Foundry structured-output adapter is prepared but disabled unless `CLAIM_INTERPRETER_PROVIDER=foundry` is explicitly configured.

All returned claim evidence is available in the app, including the full event list for the selected period and expandable claim references. First-half stoppage time is shown as `45+N`; second-half stoppage time as `90+N`. Recent-minute windows exclude half-time and include both boundaries. A historical “before event” period uses a strict exclusive cutoff. Events after the selected match time are not sent to the interpreter, included in score/stat calculations, or returned as references.

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

Open the Vite address printed in that terminal (usually `http://localhost:5173/`). Vite proxies `/api` requests to the Functions host at `http://127.0.0.1:7071`. Keep both servers running while using the app. `local.settings.json` and environment files are ignored by Git.

## Local browser-to-API verification

Verified locally with Azure Functions Core Tools `4.16.0`, Node.js `22.23.3`, and npm `10.9.9`:

- The Functions host registered `POST http://localhost:7071/api/analyze`.
- The browser app ran at `http://127.0.0.1:5174/` because another Vite process already occupied port 5173. Its `/api/analyze` request reached the Functions host through Vite's proxy and returned HTTP 200.
- Submitting the exact compound example rendered two claims. Possession was identified as unavailable with no shooting statistics substituted. The Northbridge evidence list ended at `event-06` (`45+2′`); `event-07`, Northbridge's goal at `45+3′`, appeared separately as the anchor. The copied summary matched the displayed server summary.
- “Eastport had more shots on target than Northbridge” was contradicted at 57′ (2–2) and supported at 58′ (2–3), both through HTTP 200 requests.
- With the Functions host stopped, the browser received the Vite proxy's HTTP 502, showed “The analysis service is unavailable (HTTP 502). Start the local Azure Functions API and try again.”, and cleared the prior assessment rather than presenting it as new.

The HTTP-only Functions host starts and serves requests without Azurite when `AzureWebJobsStorage` is omitted. Core Tools did emit an unhealthy storage health-check warning because no storage connection was configured; the registered HTTP function remained available and returned successful responses. This API has no storage-backed bindings, so Azurite was not installed or started.

## Checks

Run from the project root:

```powershell
cd apps\api
npm.cmd test
```

This compiles the API and runs its service tests, including the exact two-claim example, unavailable possession evidence, schema rejection, negation, historical cutoff boundaries, and exclusion of future events.

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

The local interpreter is intentionally bounded and is not a general language model. Its clause splitting and supported comparison language are limited. The fictional fixture has no possession percentages/sequences, territory, pressure, players, passing, or chance-quality data. Shot counts and the small event log cannot establish possession control, “run of play,” overall dominance, luck, or which team played better. The Foundry adapter is unenabled and has not been tested against a live deployment.

The project licence remains undecided.
