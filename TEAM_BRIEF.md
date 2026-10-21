# Groupchat Analyst — team brief

## Purpose

Groupchat Analyst helps football fans examine claims made in group chats using understandable, traceable evidence. The prototype separates claims, calculates statistics in application code, and presents supporting evidence, counterevidence, and limitations. It is a local demonstration using one fictional match. Real-player names are used only for fictional identities; all performances and results are synthetic.

## Current architecture

- `apps/web`: mobile-friendly React and TypeScript UI, plain CSS, Night Match theme, and locally bundled Inter font. It sends the opinion, selected match time, and analysis period to the API; it does not calculate match statistics.
- `apps/api`: TypeScript Azure Functions HTTP API. The source defaults to a local deterministic interpreter; this workstation's ignored local settings select Microsoft Foundry. Interpretation is validated against typed shared contracts before calculations and evidence are returned.
- `apps/shared`: match/event and synthetic evidence schemas, capability catalogue, deterministic fixture records, clock/window helpers, and calculation functions. Original shot/score events and the richer possession/passing/player fixture are separate datasets.
- The server-side Microsoft Foundry Chat Completions adapter uses strict structured outputs and has passed a small live acceptance set with GPT-5-mini. Other environments still default to the local interpreter unless configured.

## Current capabilities

- Select a match time and either Match so far or Last 10 minutes.
- Calculate score and shooting counts from the original event records, with goals represented as shot outcomes.
- Calculate possession duration and share from clipped, synthetic possession intervals; calculate pass attempts, completions, completion percentage, turnover areas, and final-third entries from synthetic records.
- Retrieve player-attributed synthetic passes, shots, goals, recoveries, selected pressure observations, minutes, and participation status. Player comparisons are limited to the recorded metrics and selected time period.
- Ask bounded questions about sampled, explicitly annotated build-up turnovers. The sample is partial and does not stand in for a match-wide phase filter.
- Return claim-specific evidence, calculation traces, historical cutoffs, anchors, data limitations, and a concise server-generated summary.
- Run locally with an HTTP-only Functions API and Vite development server; no storage emulator is needed for the current bindings.

## Windows local startup

Prerequisites: Node.js and npm, plus Azure Functions Core Tools v4.

Create the ignored local API settings file once:

```powershell
cd apps\api
Copy-Item local.settings.example.json local.settings.json
```

In one PowerShell terminal, start the API:

```powershell
cd apps\api
npm.cmd install
npm.cmd start
```

In a second PowerShell terminal, start the web app on the established local port:

```powershell
cd apps\web
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Open `http://127.0.0.1:5174/`. The web development proxy forwards `/api` to the local Functions host at `http://127.0.0.1:7071`. Keep both terminals running. The settings template selects the local interpreter. Foundry can be enabled only with server-side settings in the ignored `apps\api\local.settings.json` or server environment; never put credentials in source files or commit private local settings.

## Known limitations

- The match, events, possession, passes, locations, player actions, and pressure observations are fictional synthetic data—not observed match footage or professional tracking.
- Possession share is limited to recorded controlled-possession time. It excludes contested and out-of-play intervals and cannot alone establish dominance, territorial control, or overall performance.
- Build-up annotations and pressure observations are partial. Tactical causes, defensive shape, continuous pressing, and coaching prescriptions are not established by this sample.
- Running distance and other physical measurements, video/replay, continuous tracking, and calibrated expected goals are unavailable.
- The local interpreter recognizes a bounded vocabulary and patterns. Unsupported or ambiguous claims may require clarification; it is not a general natural-language system.
- Player records are sparse and do not support a complete performance rating or ranking.
- The initial Foundry integration was verified against a small acceptance set, not a broad evaluation or production reliability programme. The current product does not include messaging, publishing, or cloud provisioning.

## Proposed collaboration workstreams

These are proposals, not implemented functionality:

1. **Correctness and contracts** — broaden adversarial interpretation and provider-validation tests while retaining deterministic calculations, exclusive historical cutoffs, and clear unknown-data behavior.
2. **Prototype usability** — review mobile and keyboard accessibility, claim reading flow, and the distinction between concise answers and expandable evidence.
3. **Evidence quality and provenance** — review synthetic fixture coverage, annotation definitions, and independent reconciliation of each calculation before considering any observed dataset.
4. **Foundry evaluation and operations (planned)** — expand adversarial and regression evaluation, monitor latency/failure behavior, and assess privacy and operational requirements. Keep the local interpreter available for deterministic development and testing.
5. **Tactical analysis (planned)** — define coach-facing questions and data requirements before adding tactical metrics; do not infer tactical causes from the current sample.
6. **Replay/video (planned)** — assess rights, storage, timestamp alignment, privacy, and infrastructure before designing a replay feature. No video or replay functionality exists today.

The Foundry adapter and its initial live integration are current capabilities. Further Foundry evaluation, tactical-analysis expansion, and replay/video are future work and must not be represented as implemented capabilities.
