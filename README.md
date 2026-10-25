# Groupchat Analyst

Check a football take against the match. Type an opinion, replay a fictional match to a chosen minute, and get a plain-language answer with the evidence, what it can and cannot establish, and a shareable receipt. Replay to a later minute and press **Check again** to see exactly what changed.

> **Synthetic data.** Every match, player action and result is invented. Real-player names are fictionalized identities only; nothing here reflects real performances. There is no video, tracking, xG or injury data.

## What it does

1. **Interprets** a take into separate claims and shows how each was understood. Ambiguous wording gets a clarification (for example, "Bruno" asks Bruno Fernandes or Bruno Guimarães).
2. **Retrieves evidence for and against** each claim from the fixture, restricted to the selected match time and period. Event IDs and match times are cited.
3. **Assesses** the claim with server-side calculations. Statistical requests return figures without a verdict; broad judgements such as "parked the bus" or "dominated" are labelled "insufficient evidence for a firm conclusion" and never reduced to a shot or possession count.
4. **Explains** in a Fan view (short reply) or Analyst view (calculation traces, records, coverage), with copyable card text and a downloadable PNG card.
5. **Re-checks** the same take at a later minute and shows a deterministic 57′→58′-style comparison, or shows the answers separately when they are not equivalent.

The browser sends only the opinion and the selected match time and period. The server owns the fixture, time filtering, statistics and assessment; AI never calculates anything.

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

Local rules understand a small set of phrasings. For the shots walkthrough use the long wording "Eastport had more shots on target than Northbridge."; the short form is not understood locally and asks for clarification.

## Verified demonstration

All of these were exercised against the **local** provider (real local API, browser, synthetic data):

- Statistics: "How many shots did Eastport have?" at 90+4′ → 8 shots with records.
- Historical: "Northbridge scored before half-time." → goal at 45+3′, with the limitation that this says nothing about the run of play.
- Clarification: "How many passes did Bruno complete?" → asks which Bruno, no pass count.
- Unavailable metric: "How far did Bruno Fernandes run?" → stated as unrecorded, no substituted statistics.
- Take investigation: "Eastport had more shots on target than Northbridge." at 57′ (2–2, contradicted) → Check again at 58′ (3–2, supported) → direct comparison, "Share what changed" card.

Automated tests: API 172, web 95 (provider routing, validation, calculations, replay controller, comparison, share card, deployment config). Walkthrough script: [TEAM_DEMO.md](./TEAM_DEMO.md).

Foundry (not used by the hosted candidate): two small, bounded live runs have been made (see `docs/*ledger.json`). They found defects that were repaired and confirmed offline by replaying captured outputs; the last live confirmation stopped before its fourth call. These runs do **not** establish production reliability.

## Limitations

- The local interpreter is bounded rules, not a language model; unrecognised wording gets clarification or an explicit limitation.
- The fixture is partial: build-up annotations cover only a sample, pressure observations are selected moments, there is no continuous tracking, so defensive shape, territorial control, chance quality and tactical causes cannot be established.
- Snapshots are in browser memory and are lost on refresh. Analysis requests have a 45 s client deadline; an abort does not guarantee server work stopped.
- No real-device, screen-reader or load testing. No rate limiting beyond platform quotas (see the runbook).
- No messaging, accounts, publishing or chat ingestion exist. A messaging companion is a future idea only.

## Deployment and further reading

- Hackathon hosting (Azure Static Web Apps, public, local provider only): [docs/DEPLOYMENT_RUNBOOK.md](./docs/DEPLOYMENT_RUNBOOK.md)
- Next-session handoff and verification history: [docs/NEXT_SESSION.md](./docs/NEXT_SESSION.md)
- Detailed implementation notes (previous README): [docs/IMPLEMENTATION_NOTES.md](./docs/IMPLEMENTATION_NOTES.md)
- Data dictionary: [apps/shared/DATA_DICTIONARY.md](./apps/shared/DATA_DICTIONARY.md)
