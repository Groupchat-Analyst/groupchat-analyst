# Groupchat Analyst

Groupchat Analyst helps football fans assess group-chat opinions using relevant, traceable match evidence. The intended flow is: enter an opinion, identify its separate claims, retrieve evidence for and against each claim, assess what the evidence establishes, and produce a shareable explanation.

## Current prototype

The mobile-friendly React website calls a local TypeScript API instead of calculating match statistics or assessing claims in the browser. The original fixture retains 16 fictional shot/score events for regression coverage. A deterministic richer companion fixture adds 26 possession intervals across both halves, synthetic passes with passer and intended-receiver IDs, outcomes and normalized locations, player-attributed shots/turnovers/recoveries/selected pressure observations, 20-player matchday squads and substitutions. The simulated squads use player names from the official Arsenal-inspired and Manchester United-inspired rosters referenced in the data dictionary; every match performance and result remains fictional. No portraits, crests, real performance statistics, or injury information are used. This is an architectural demonstration, not a reproduction of Arsenal's internal analysis system or any professional club's proprietary data.

The API calculates possession duration/percentage, pass attempts/completions/accuracy, pass-turnover locations and completed-pass entries into the final third from those records. Player questions retrieve only player-attributed evidence and calculate passing, shots, shots on target, goals, selected-window minutes, and recorded recovery/pressure observations. Player pass completion is unavailable for zero attempts; player receiving actions are not counted as passes made. Statistical comparison requests return descriptive figures, while precise factual comparisons are assessed against the recorded player values. Sparse attributed actions do not establish an overall player rating. Running distance and other physical measurements are not recorded.

A small versioned synthetic sample explicitly annotates build-up sequences and links their possession, passes, turnovers and selected pressure context. It is partial, not a match-wide filter. Team and player build-up questions report only eligible annotated losses with locations and linked records; they identify the coverage limitation and do not claim tactical causes. Phase-specific pass counts, rates and comparisons are not calculated from this sample, and the API reports that limitation rather than substituting full-match totals. Other turnover questions may show an all-pass breakdown, clearly distinguished from the annotated sample. A precise comparison such as “Northbridge had more possession than Eastport” is assessed from controlled-possession percentages. Broader claims such as “dominated possession” show supporting and challenging possession context—without treating possession share as proof of overall dominance.

The local server interpreter separates simple claims while preserving coordinated team/player names in one statistical request. It resolves full names, unique surnames, case variants and unaccented spellings; “Bruno” asks whether the user means Bruno Fernandes or Bruno Guimarães. It recognizes bounded factual comparisons, possession, passing and “against the run of play” evidence needs. It asks for clarification when a subject is ambiguous and withholds claim-specific evidence until clarified. Unrecognized wording and unavailable metrics do not fall through to unrelated match events. The “against the run of play” assessment is anchored to Northbridge's 45+3′ goal (`event-07`) and compares recorded match play strictly before that goal. The goal is shown separately from the pre-goal evidence. Possession share is available as a synthetic interval-derived measure; it cannot establish territorial control, chance quality, or by itself prove that a team “controlled” the match.

> “Eastport controlled possession of the game, Northbridge scored against the run of play.”

is represented as two claims. The first can show the recorded possession-share comparison as relevant context, but does not redefine “controlled” as “had more possession” or reach a definitive control verdict from that metric alone. The second is anchored to Northbridge’s goal at `45+3′` (`event-07`) and retrieves recorded events **strictly before** that goal. The goal appears separately as the historical anchor, not as evidence inside the before-goal period. Where available, recorded pre-goal possession shares are shown as context, not as a verdict. Missing territorial-control and chance-quality information is stated specifically; available shots and other events remain context, not substitutes for missing evidence.

The browser sends only the opinion, selected match clock, and selected evidence period. It never sends fixture events or calculated statistics. Statistics and event filtering run in server-side TypeScript. Model output is validated against a typed claim contract before it is used; invalid output fails explicitly. The local rule-based interpreter is the default and is not a Microsoft AI model. A Microsoft Foundry structured-output adapter is prepared but disabled unless `CLAIM_INTERPRETER_PROVIDER=foundry` is explicitly configured.

The concise server-generated answer appears first and is the exact text copied by the share control. Claim details are behind one “View evidence” control; calculation traces are separately expandable. The evidence foundation is also closed by default and includes a player selector and optional roster participation view without showing 40 player cards on the initial screen. First-half stoppage time is shown as `45+N`; second-half stoppage time as `90+N`. Recent-minute windows exclude half-time and include both boundaries. A historical “before event” period uses a strict exclusive cutoff. Possession intervals are clipped to the selected window, and future end reasons/outcomes are not exposed. Events after the selected match time are not sent to the interpreter, included in score/stat calculations, or returned as references.

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

## Microsoft Foundry integration

The server-side Foundry adapter has been exercised against an existing Microsoft Foundry deployment. No Azure resources were created for this integration. The source defaults to the local interpreter, while this workstation's ignored API settings select Foundry. To use Foundry in another environment, an administrator/user will need:

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

The API still calculates statistics and validates every returned claim. The model interprets language only; it does not decide the score, generate statistics, or supply event evidence. The source-level default remains local rules. No messaging or publishing integration is included.

### First live verification

The first live integration check used the ignored `apps\api\local.settings.json` configuration for provider `foundry`, deployment `gpt-5-mini`, and an HTTPS `/openai/v1` endpoint. The adapter's strict Chat Completions structured-output request succeeded with the deployed model. Sequential live requests returned provider `foundry` and HTTP 200 for:

- Pass completion: Northbridge 30/38 (78.9%); Eastport 23/32 (71.9%).
- Shots on target: at 57′, Eastport 2 and Northbridge 2 (the “more” claim was contradicted); at 58′, Eastport 3 and Northbridge 2 (supported).
- Northbridge's first goal: the historical claim anchored to `event-07` at 45+3′. The claim's contextual evidence ended before the goal; the goal remained a separate anchor.
- Running distance: explicitly unavailable, with no unrelated calculated statistics.
- “Bruno”: clarification identified Bruno Guimarães (Northbridge) and Bruno Fernandes (Eastport), without exposing player IDs in the answer.

In the browser, the pass-comparison response was labelled Foundry. The displayed answer and the value passed by the copy handler matched the API summary exactly. Reading the Windows clipboard showed the same answer with the expected LF-to-CRLF line-ending conversion. The browser request contained only `opinion`, `selectedClock`, and `period`; Foundry credentials remained server-side. A local Azure Functions storage-health warning appeared because no storage connection was configured, but the HTTP-only function was available and completed the analysis requests.

## Current limitations

The local interpreter is intentionally bounded and is not a general language model. Its clause splitting and supported comparison language are limited. The richer synthetic fixture does not reproduce professional match analysis. Its intervals, pass outcomes, locations, and event references are fabricated for demonstration; partial pressure events are not continuous pressing evidence. Possession percentage is defined over recorded controlled minutes and excludes contested/out-of-play time. Thirds/entries are simple normalized-coordinate definitions. The data cannot establish tactical causes, defensive shape, chance quality, physical workload, or whether possession/dominance means a team played better. There is no video or continuous tracking and no calibrated xG. The Foundry integration has passed a small live acceptance set, not broad model evaluation or production reliability testing.

The project licence remains undecided.

## Night Match presentation

The current local interface uses the selected Night Match palette: `#0C110F` page background, `#171E19` cards, `#F2F5EE` primary text, `#ACB6AA` secondary text and `#D4FF63` accent. Inter is served from `apps/web/public/fonts/InterVariable.woff2`; its SIL Open Font License is retained beside it at `apps/web/public/fonts/OFL.txt`. The stylesheet uses `font-display: swap` and Segoe UI/sans-serif fallbacks. Evidence references, calculation traces, interpretation details, coverage definitions and limitations are kept available in keyboard-operable disclosures; the visible answer leads with the claim assessment and relevant statistics.

The styling milestone was based on local checkpoint `bef553c` (the verified functional baseline); visual changes remain uncommitted.

### Presentation verification

Verified locally in the browser at `http://127.0.0.1:5174/` with the local API at `http://127.0.0.1:7071/`:

- Inter loaded locally; blocking the font request left the Segoe UI/sans-serif fallback stack available.
- At a 375px viewport and a narrow 410 CSS-pixel viewport (half the measured 820px layout width, used as a 200%-zoom-equivalent reflow check), document content did not overflow horizontally. Keyboard focus remained visible, and the interpretation/evidence disclosures expanded with the keyboard.
- Expanded claim evidence and the possession/passing foundation were reachable. A simulated pending request displayed the loading state. Aborting an API request showed a visible error and cleared the previous assessment; a subsequent request recovered with HTTP 200.
- Pass-completion comparison returned one statistical request with Northbridge 30/38 (78.9%) and Eastport 23/32 (71.9%). Displayed and copied summaries matched the API response.
- Running distance returned “unavailable data” with no unrelated statistics or evidence.
- The same “same number of goals” comparison was contradicted at 57′ (1–0) and supported at 58′ (1–1). Both responses returned HTTP 200 and matched the displayed summaries.

The browser harness did not expose a browser-level zoom control; the 410px check verifies the responsive reflow expected when a 200% zoom halves an 820px CSS viewport, rather than claiming a direct browser-zoom setting. At the time of this presentation check, Foundry was disabled and both local servers were left running.
