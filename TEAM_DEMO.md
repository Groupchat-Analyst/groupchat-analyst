# Groupchat Analyst demo guide

The hosted hackathon candidate is public and read-only. It uses the **local rules interpreter** (no model, no Foundry, no credentials), a single **fictional** match, and server-side calculations. Do not describe it as AI-powered.

> The local interpreter understands a bounded set of phrasings. Use the exact wording below. Every answer below was reproduced against the local provider.

## Two-minute walkthrough

1. **Problem (15 s).** Football arguments in group chats run on opinion; nobody checks the take against the match.
2. **Check at 57′ (20 s).** Jump to `57′ · before equaliser` (Northbridge 1–0), keep **Match so far**, submit “Eastport had more shots on target than Northbridge.” Answer: no, level at 2 each. Point to the **Checked against** line and the “Local rules · no model connection” label.
3. **Replay and recheck at 58′ (20 s).** Move to `58′ · equaliser`. Press **Check again at 58′** (nothing auto-submits).
4. **What changed (15 s).** Now Eastport 3, Northbridge 2, with the new recorded shot at 58′. No cause is inferred.
5. **Analyst and receipt (25 s).** Switch to Analyst for traces, records and coverage; open **Share what changed**, copy the text or download the PNG.
6. **Vision (15 s).** A messaging companion is a future idea only. No messaging, accounts or chat ingestion exist.

## Other checks that work with the local interpreter

| Select | Ask | Expect |
| --- | --- | --- |
| `90+4′`, Match so far | How many shots did Eastport have? | 8 shots with records; a statistic, not a verdict |
| `90+4′`, Match so far | Northbridge scored before half-time. | Supported by the goal at 45+3′; says nothing about the run of play |
| `90+4′`, Match so far | How many passes did Bruno complete? | Asks Bruno Guimarães or Bruno Fernandes; no pass count |
| `90+4′`, Match so far | How far did Bruno Fernandes run? | Running distance is not recorded; no substitute statistics |
| `57′`, Match so far | Northbridge parked the bus. | The local rules do not recognise it and say so, without picking unrelated figures. (Only the optional Foundry mode interprets it, and then reports that defensive shape is not recorded.) |

## Limits to state honestly

- All data is synthetic; no real performances, video, tracking or xG.
- Local rules, not a language model; unrecognised wording gets clarification or an explicit decline.
- Snapshots live in browser memory and vanish on refresh.
- Foundry has had only small bounded live runs elsewhere and is not part of this deployment.

## Reporting a problem

Note the exact question, selected time and period, what you expected, and what you saw. Do not include credentials or personal information.
