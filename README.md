# Groupchat Analyst

Check a football take against the match. Type an opinion, replay a fictional match to a chosen minute, and get a plain-language answer with the evidence, what it can and cannot establish, and a shareable receipt. Replay to a later minute and press **Check again** to see exactly what changed.

> **Synthetic data.** Every match, player action and result is invented. Real-player names are used in invented scenarios; nothing here reflects real performances. There is no video, tracking, xG or injury data.

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
| Goalless match | `westhaven-kingswell-demo` 1.0.0 | Westhaven FC v Kingswell City, 0–0: 9 shots (5 on target) v 3 (0), Kingswell hold the ball late. No goal anchor exists, zero shots on target, a no-pass player, an ambiguous “Pedro”. |
| Late winner | `redmere-alderwick-demo` 1.0.0 | Redmere FC v Alderwick United, 1–2: goals at 33′, 61′ and a 78′ substitute’s 88′ winner. Three goals make “before the goal” ambiguous. |

Each match offers key-moment chips and five example opinions. Examples only fill the box, time and period; nothing is sent until you press **Check this moment**. All fixtures are illustrative synthetic event samples, not complete tracking data: no xG, running distance, video or continuous defensive shape. The two newer squads use dated roster-snapshot names as fictional identities only. Internally they share the original team slots; the API translates team names in and out.

The local interpreter has its broadest bounded phrase coverage in English. All five selector languages have asserted coverage for six opinion classes: the guided shots-on-target comparison, ambiguous Bruno clarification, negated comparison, zero-count claim, qualified Saka judgement, and unavailable running-distance metric. Wider English-only rule coverage includes multiple claims, player statistics, possession and pass comparisons, chronology, quantifiers, and evidence-limited tactical judgements. Uncovered wording is not guessed. See [docs/LANGUAGE_ACCEPTANCE.md](./docs/LANGUAGE_ACCEPTANCE.md) for the 42-case English corpus and the five-language matrix (42/42 and 30/30 PASS under local rules; no live Foundry testing for multilingual wording).

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

## Interpreter provider modes

| Mode | Setting | Notes |
| --- | --- | --- |
| **Local rules (default)** | `CLAIM_INTERPRETER_PROVIDER=local` or unset | Deterministic, bounded phrasing, no model connection, no credentials. The interface labels answers "Local rules · no model connection". **This is the only mode intended for the hosted hackathon deployment.** |
| Microsoft Foundry (optional, off by default) | `CLAIM_INTERPRETER_PROVIDER=foundry` plus `FOUNDRY_OPENAI_BASE_URL`, `FOUNDRY_API_KEY`, `FOUNDRY_MODEL_DEPLOYMENT` | Server-side only, structured-output interpretation of language. 8192 completion-token ceiling, 30 s timeout, no retries, output validated before use. Keep credentials in git-ignored `apps/api/local.settings.json` or server environment variables; never in source. |

Local rules understand a bounded set of phrasings by meaning class. Both "Eastport had more shots on target than Northbridge." and the shorter "Eastport had more shots on target." work locally. Wording outside the covered classes gets clarification or an explicit limitation.

## Verified demonstration

All of these were exercised against the **local** provider (real local API, browser, synthetic data), plus offline replay of previously captured Foundry outputs through the real service path. **No live Foundry call was made for the current application changes; the Foundry prompt and schema are unchanged.**

- Statistics: "How many shots did Eastport have?" at 90+4′ → 8 shots with records.
- Broad player opinion: "Saka has had a horrible game" at 57′ → his recorded contributions (1 goal, 2 shots on target, 1 of 2 passes, 1 recovery), no rating.
- Clarification: "How many passes did Bruno complete?" → asks which Bruno, no pass count.
- Unavailable data: "Northbridge covered more distance than Eastport" → running distance not recorded.
- Investigation: "Eastport had more shots on target than Northbridge." at 57′ (2–2, contradicted) → Check again at 58′ (3–2, supported) → direct comparison and "Share what changed" card.
- Return match: "Eastport had more possession than Northbridge but Northbridge had more shots" at 90+4′ → two claims, both supported.

Browser checks (local rules): home, four-match selection and conversation at 1280 px and 390 px; 320 px has no horizontal overflow. Keyboard navigation visibly focuses the language selector. The 57′ submit and 58′ explicit recheck made exactly two analyze requests; replay movement, language changes, navigation, copy and PNG generation made none. Switching through all five locales retained the exact draft, clock and two-turn comparison. An actual downloaded Arabic receipt PNG (2160×2420) was decoded and visually inspected; its copied text and image retain the submitted opinion, 58′ scope, fixture/version, figures, event times and local-provider label. Other-language receipt strings and SVGs have automated regressions. Native sharing on a real phone is **unverified**.

Automated checks: **358/358 API tests** and **137/137 web tests** pass; API and web typechecks, lint and production build pass. The 42-input English matrix and 30-case five-language matrix are asserted per case. Baseline fixture source remains unchanged (70 passes, 17 turnovers). The historical semantic digest `fb5335ff63f326246b93182dda7adb4462d8b67efd4ce8133ae575f989ee1044` was not recomputed for this release. Walkthrough script: [TEAM_DEMO.md](./TEAM_DEMO.md).

Foundry (not used by the hosted candidate): earlier small, bounded live runs are in `docs/*ledger.json`. They belong to earlier application versions; the prompt and schema are unchanged but not re-verified for the new wording classes. They do **not** establish production reliability.

## Limitations

- The local interpreter is bounded rules, not a language model; unrecognised wording gets clarification or an explicit limitation.
- Spanish, French, German and Arabic interpretation is deliberately bounded to the six tested opinion classes; broader local rule coverage and all multilingual Foundry interpretation remain unverified.
- Translations have not received independent native-speaker review.
- The fixture is partial: build-up annotations cover only a sample, pressure observations are selected moments, there is no continuous tracking, so defensive shape, territorial control, chance quality and tactical causes cannot be established.
- Snapshots are in browser memory and are lost on refresh. Analysis requests have a 45 s client deadline; an abort does not guarantee server work stopped.
- No real-device, screen-reader or load testing. Real-phone native sharing is unverified. There is no durable total-request allowance or judge-accessible hosted AI route; the public candidate remains on local rules.
- No messaging, accounts, publishing or chat ingestion exist. A messaging companion is a future idea only.
- Production player-clarification continuation requires `PLAYER_RESOLUTION_SIGNING_KEY`: exactly 32 cryptographically random bytes encoded as unpadded base64url (43 characters), shared across API instances and restarts. Configure it only in the API server's environment settings; never in browser/Vite settings or source control. With `NODE_ENV=production`, a missing or malformed key fails the request explicitly (HTTP 502), with no ephemeral fallback. Development without the variable uses a process-local random key. Tokens have no expiry: rotating the key immediately invalidates outstanding clarification/recheck continuations; there is no previous-key verification ring.

## Deployment and further reading

- Hackathon hosting (Azure Static Web Apps, public, local provider only): [docs/DEPLOYMENT_RUNBOOK.md](./docs/DEPLOYMENT_RUNBOOK.md)
- Next-session handoff and verification history: [docs/NEXT_SESSION.md](./docs/NEXT_SESSION.md)
- Detailed implementation notes (previous README): [docs/IMPLEMENTATION_NOTES.md](./docs/IMPLEMENTATION_NOTES.md)
- Data dictionary: [apps/shared/DATA_DICTIONARY.md](./apps/shared/DATA_DICTIONARY.md)
