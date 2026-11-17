# Groupchat Analyst

Check a football opinion against a match. Type an opinion, replay a match to a chosen minute, and get a plain-language answer with the evidence, what it can and cannot establish, and a shareable receipt. Replay to a later minute and press **Check again** to see exactly what changed.

> **Synthetic data.** The prototype fixtures are invented. Real-player names in those fixtures are fictionalized identities only; nothing reflects real performances. There is no video, tracking, xG or injury data. The Arsenal–Leicester historical replay is separately labelled and uses only mapped source events.

## What it does

1. **Interprets** an opinion into separate claims and shows how each was understood. Ambiguous wording gets a clarification (for example, "Bruno" asks Bruno Fernandes or Bruno Guimarães); choosing a full-name/team option continues the saved request without another model call.
2. **Retrieves evidence for and against** each claim from the selected fixture, restricted to the selected match time and period. Event IDs and match times are cited.
3. **Assesses** the claim with server-side calculations. Statistical requests return figures without a verdict; broad judgements such as "parked the bus", "dominated" or "Saka has had a horrible game" are labelled "insufficient evidence for a firm conclusion" and never reduced to one statistic or an invented rating.
4. **Explains** in a Fan view (short reply) or Analyst view (calculation traces, records, coverage), with copyable card text, a downloadable PNG card and, where the browser supports it, "Share the receipts". Cards name the fixture, its version and how the opinion was read.
5. **Re-checks** the same opinion at a later minute and shows a deterministic 57′→58′-style comparison, or shows the answers separately when they are not equivalent.
6. **Localizes** the interface in English, Español, Français, Deutsch or العربية. The accessible selector remembers its choice across navigation and refresh; changing language preserves the selected match, clock, period, draft, conversation and comparison without sending another analysis request. User-entered opinions remain unchanged.

The browser sends the opinion, the selected match time and period, and a dataset ID. The server owns the fixtures, validates the dataset ID against an allowlist (omitting it selects the original match; unknown IDs are rejected), and does all filtering, statistics and assessment. AI never calculates anything.

## What you can investigate

Open the home page, choose **Try it out**, then pick a match. The app has hash routes (`#/`, `#/matches`, `#/match/<id>`), so Back, refresh and direct links work. Switching match resets the draft, answers, comparison, replay and prepared share images.

| Match | Dataset ID / version | Character |
| --- | --- | --- |
| Original match | `northbridge-eastport-analysis-demo` 3.0.0 | The verified demonstration fixture. 57′→58′ shots-on-target walkthrough. Unchanged (hash `fb5335ff…`). |
| Return match | `northbridge-eastport-return-demo` 1.0.0 | Eastport keep the ball (58.2%), Northbridge take the shots (11–4), 2–1 at 90+4′. Stoppage-time events, a late Northbridge spell that differs from the whole match, zero-attempt players. |
| Westhaven fixture | `westhaven-kingswell-demo` 1.0.0 | Westhaven FC v Kingswell City; includes shot, possession, player-availability and ambiguous “Pedro” examples. |
| Redmere fixture | `redmere-alderwick-demo` 1.0.0 | Redmere FC v Alderwick United; includes multiple goal anchors and a substitute-scoring example. |
| Arsenal 4–3 Leicester · 11 August 2017 | `arsenal-leicester-wyscout-2499719` 1.0.0 | Historical replay of Wyscout match `2499719`. The local snapshot maps 34 shot records and preserves source event IDs. Possession, lineups, passing, shot locations and shot accuracy are unavailable, not zero. Source: Wyscout, Luca Pappalardo and Emanuele Massucco, [Events dataset](https://figshare.com/articles/dataset/Events/7770599), CC BY 4.0. |

Matches offer key-moment chips and example opinions. Examples only fill the box, time and period; nothing is sent until you press **Check this moment**. Synthetic fixtures are illustrative event samples, not complete tracking data: no xG, running distance, video or continuous defensive shape. The two newer synthetic squads use dated roster-snapshot names as fictional identities only. The historical replay is partial source data, not a complete match record; it makes no claims about real-player performance.

To reproduce the historical check, choose **Arsenal v Leicester City**, select the **85′ · Giroud winner** key moment, and submit **“Who had more shots in the ten minutes before Giroud’s winner?”** with **Match so far** selected. The answer counts the inclusive 600-second interval ending just before source event `177960902` at `2H 39:34.621`: Arsenal 5 (IDs `177960786`, `177960827`, `177960831`, `177960849`, `177960899`), Leicester City 0. The evidence view and share card show the exact window, included IDs, source attribution and CC BY 4.0 credit.

The separate last-ten-minutes check at the explicit 86:00 replay cutoff counts Arsenal 6, Leicester City 0; Giroud's goal is the additional shot. Historical source events are filtered at their source-second precision rather than their rounded display minute.

The raw Chelsea 4–2 Watford fixture in `apps/shared/src/data/chelsea-watford-2499799.json` is a frozen test source, not a selectable match. For the 600 seconds from `2H 15:46.860227` inclusive to Batshuayi's 2–2 goal `198369306` at `2H 25:46.860227` exclusive, the source records Watford shots `198369169` (Carrillo) and `198369222` (Richarlison), both blocked, no Chelsea shots, and Watford corners `198369163`, `198369166`, `198369226`. Watford led 2–1 at the start. Wyscout's [tag mapping](https://figshare.com/articles/dataset/Mapping_of_tag_identifiers_to_tag_names/11743818) identifies `2101` as blocked and `1802` as not accurate. The records are from [Wyscout Events](https://figshare.com/articles/dataset/Events/7770599), Pappalardo and Massucco, CC BY 4.0; player identities were checked against [Players](https://figshare.com/articles/dataset/Players/7765196). This fixture has not yet been connected to the analysis path or match picker.

When Foundry is explicitly enabled, its structured interpretation can request a rolling lookback ending at the replay clock, a bounded window before a goal, or play after a goal through the replay clock. Rolling boundaries are inclusive; goal anchors are excluded. It receives only goals eligible at the selected time, with recorded score context and verified scorer aliases where available; the server validates the anchor and calculates the result. For English subjective Arsenal–Leicester questions with a shared, bounded pre-goal or post-goal scope and shot evidence, a second Foundry call may add a short pundit opinion. The server supplies recorded scores, shot origins and the chronological sequence. The model selects application-verified fact phrases using cited tokens; the server substitutes those phrases only when their IDs are supplied, while the window, source IDs, coordinates and limitations remain under **How this was checked**. Token validation does not establish the truth of the model's wider interpretation, which is not a verified tactical fact. If the second allowance cannot be reserved, or generation or validation fails, the existing factual answer remains visible with a notice. Each outbound call consumes a separate reservation; a full check can use two. The revised wording and token handoff have been checked with offline stubs; live model compliance still needs checking.

The interpretation contract distinguishes ambiguous references or meaning from missing evidence. A resolved qualitative team judgement can use available shot context with explicit limitations, rather than asking the fan to identify a team because possession or passing is unavailable; shots do not measure those metrics. Explicit requests for an unrecorded metric remain unavailable, and unresolved subjects or goal anchors still require clarification.

For local diagnostics only, `FOUNDRY_CAPTURE_RAW_OUTPUT=true` appends interpretation output and pundit-generation output to the ignored `apps/api/.local-captures/foundry-raw-output.jsonl`. Generation records include the request invocation ID and a validation field/rule, or a null rejection when accepted. Captures contain model output and may contain user-provided content; keep them local and disable the setting after debugging. The API logs a rejected field and rule with the invocation ID, without the generated text or credentials.

For a local live check, configure the existing ignored `apps/api/local.settings.json` with the Foundry endpoint, key and deployment, the existing allowance Table connection and limits, and `FOUNDRY_PUBLIC_ENABLED=true`; keep `CLAIM_INTERPRETER_PROVIDER=local`. Make sure both shared and client limits have at least two attempts available. Start the API and web as below, open the Arsenal–Leicester match, jump to 85′ and advance to 86′. With **Match so far**, submit “Arsenal were piling on the pressure in the ten minutes before Giroud scored.” Open **How this was checked** for the pre-goal scope and IDs. Foundry may request clarification or return output that fails validation, in which case a generated reply is not guaranteed. To disable model calls, restore `FOUNDRY_PUBLIC_ENABLED=false` and restart the API.

The local interpreter has its broadest bounded phrase coverage in English. All five selector languages have asserted coverage for six opinion classes: the guided shots-on-target comparison, ambiguous Bruno clarification, negated comparison, zero-count claim, qualified Saka judgement, and unavailable running-distance metric. Wider English-only rule coverage includes multiple claims, player statistics, possession and pass comparisons, chronology, quantifiers, and evidence-limited tactical judgements. Uncovered wording is not guessed. See [docs/LANGUAGE_ACCEPTANCE.md](./docs/LANGUAGE_ACCEPTANCE.md) for the 42-case English corpus and the five-language matrix (42/42 and 30/30 PASS under local rules; no live Foundry testing for multilingual wording).

Arabic presentation uses fixture-scoped transliterations for every canonical team and player identity without changing fixture data. Those names are recognized as input aliases, while shared names such as Bruno, Martin/Martín and Pedro remain ambiguous until clarified.

## Quick start (Windows or any OS with Node.js ≥ 22.12)

Requirements: Node.js ≥ 22.12, [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local).

```powershell
# terminal 1 - API on http://127.0.0.1:7071
cd apps\api
npm install
Copy-Item local.settings.example.json local.settings.json   # keeps CLAIM_INTERPRETER_PROVIDER=local
npm run start

# terminal 2 - web on http://127.0.0.1:5173
cd apps\web
npm install
npm run dev
```

Open the Vite URL. To point the dev server at a different API port, set `API_PROXY_TARGET` before `npm run dev`.

Checks: `cd apps\api; npm test` (compiles, then runs all API tests) and `cd apps\web; npm test; npm run lint; npm run build`.

For the focused offline fan evaluation, run `cd apps\api; npm run test:fan-evaluation`. It combines independently checked Arsenal–Leicester and frozen Watford source windows with local-route cases, captured interpretations and mocked Foundry generation, fallback, ambiguity and player-resolution checks. Watford remains source-only: it is not selectable through the analysis route. Constructed interpretations and replies test the contract and deterministic evidence, not whether a live model will interpret or write them correctly; the synthetic player questions use the existing demo fixture. Fresh live questions must be evaluated separately and consume the configured model allowance.

## Interpreter provider modes

| Mode | Setting | Notes |
| --- | --- | --- |
| **Local rules** | `CLAIM_INTERPRETER_PROVIDER=local` or unset, Foundry disabled | Deterministic, bounded phrasing, no model connection. |
| **Foundry** | `FOUNDRY_PUBLIC_ENABLED=true`, server-only credentials and the shared request allowance in [the deployment runbook](./docs/DEPLOYMENT_RUNBOOK.md) | Azure Table conditional updates reserve shared and per-client allowance before each outbound attempt. Interpretation and eligible pundit generation are separate calls, each with a 30 s timeout and no retry. Foundry remains disabled by default. |

Local rules understand a bounded set of phrasings by meaning class. Both "Eastport had more shots on target than Northbridge." and the shorter "Eastport had more shots on target." work locally. Wording outside the covered classes gets clarification or an explicit limitation.

## Verified demonstration

The examples below were exercised against the **local** provider (real local API, browser, synthetic data), plus offline replay of previously captured Foundry outputs through the real service path. **No live Foundry call was made for the current application changes.**

- Statistics: "How many shots did Eastport have?" at 90+4′ → 8 shots with records.
- Broad player opinion: "Saka has had a horrible game" at 57′ → his recorded contributions (1 goal, 2 shots on target, 1 of 2 passes, 1 recovery), no rating.
- Clarification: "How many passes did Bruno complete?" → asks which Bruno, no pass count.
- Unavailable data: "Northbridge covered more distance than Eastport" → running distance not recorded.
- Investigation: "Eastport had more shots on target than Northbridge." at 57′ (2–2, contradicted) → Check again at 58′ (3–2, supported) → direct comparison and "Share what changed" card.
- Return match: "Eastport had more possession than Northbridge but Northbridge had more shots" at 90+4′ → two claims, both supported.

Browser checks (local rules): home, four-match selection and conversation at 1280 px and 390 px; 320 px has no horizontal overflow. Keyboard navigation visibly focuses the language selector. The 57′ submit and 58′ explicit recheck made exactly two analyze requests; replay movement, language changes, navigation, copy and PNG generation made none. Switching through all five locales retained the exact draft, clock and two-turn comparison. An actual downloaded Arabic receipt PNG (2160×2420) was decoded and visually inspected; its copied text and image retain the submitted opinion, 58′ scope, fixture/version, figures, event times and local-provider label. Other-language receipt strings and SVGs have automated regressions. Native sharing on a real phone is **unverified**.

Automated checks: **386/386 API tests** and **160/160 web tests** pass; API and web typechecks, web lint and production build pass. The API allowance adapter was exercised against Azurite using the actual Azure Table SDK, including ETag conflicts and independent processes. The 42-input English matrix and 30-case five-language matrix are asserted per case. Baseline fixture source remains unchanged (70 passes, 17 turnovers). The historical semantic digest `fb5335ff63f326246b93182dda7adb4462d8b67efd4ce8133ae575f989ee1044` was not recomputed for this release. Walkthrough script: [TEAM_DEMO.md](./TEAM_DEMO.md).

Historical Foundry captures in `docs/*ledger.json` belong to earlier application revisions and are not live verification of this controlled route. The new access gate and allowance use offline provider/storage stubs only; no live Foundry request was made for this work.

## Limitations

- The local interpreter is bounded rules, not a language model; unrecognised wording gets clarification or an explicit limitation.
- Spanish, French, German and Arabic interpretation is deliberately bounded to the six tested opinion classes; broader local rule coverage and all multilingual Foundry interpretation remain unverified.
- Translations have not received independent native-speaker review.
- The fixture is partial: build-up annotations cover only a sample, pressure observations are selected moments, there is no continuous tracking, so defensive shape, territorial control, chance quality and tactical causes cannot be established.
- Snapshots are in browser memory and are lost on refresh. Analysis requests have a 75 s client deadline to allow for two sequential model calls; an abort does not guarantee server work stopped.
- No real-device, screen-reader or load testing. Real-phone native sharing is unverified. The controlled judge route and durable Azure Table allowance have offline tests plus local Azurite/SDK integration coverage; no Azure-hosted table/settings compatibility or live Foundry request has been verified. Production settings/table have not been configured. Public analysis remains on local rules. The judging allowance limits and availability window still require owner approval; the proposed six-attempt acceptance rehearsal is separate from those decisions.
- No messaging, accounts, publishing or chat ingestion exist. A messaging companion is a future idea only.
- Production player-clarification continuation requires `PLAYER_RESOLUTION_SIGNING_KEY`: exactly 32 cryptographically random bytes encoded as unpadded base64url (43 characters), shared across API instances and restarts. Configure it only in the API server's environment settings; never in browser/Vite settings or source control. With `NODE_ENV=production`, a missing or malformed key fails the request explicitly (HTTP 502), with no ephemeral fallback. Development without the variable uses a process-local random key. Tokens have no expiry: rotating the key immediately invalidates outstanding clarification/recheck continuations; there is no previous-key verification ring.

## Deployment and further reading

- Hackathon hosting (Azure Static Web Apps, public, local provider only): [docs/DEPLOYMENT_RUNBOOK.md](./docs/DEPLOYMENT_RUNBOOK.md)
- Next-session handoff and verification history: [docs/NEXT_SESSION.md](./docs/NEXT_SESSION.md)
- Detailed implementation notes (previous README): [docs/IMPLEMENTATION_NOTES.md](./docs/IMPLEMENTATION_NOTES.md)
- Data dictionary: [apps/shared/DATA_DICTIONARY.md](./apps/shared/DATA_DICTIONARY.md)
