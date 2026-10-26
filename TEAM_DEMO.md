# Groupchat Analyst demo guide

The hosted hackathon candidate is public and read-only. It uses the **local rules interpreter** (no model, no Foundry, no credentials), **fictional** matches, and server-side calculations. Do not describe it as AI-powered.

> Local rules understand a bounded set of phrasings. The example opinions on each match page are verified; other wording may be declined with a clarification or limitation. See [docs/LANGUAGE_ACCEPTANCE.md](./docs/LANGUAGE_ACCEPTANCE.md).

## 110-second walkthrough

1. **Problem (10 s).** Football arguments in group chats run on opinion; nobody checks the opinion against the match.
2. **Home (10 s).** “Football opinions. Checked against the moment.” Press **See the 57′ → 58′ demo**. It opens the Original match, sets 57′ and fills the box. Nothing is submitted.
3. **Check at 57′ (20 s).** Press **Check this moment**: “Eastport had more shots on target than Northbridge.” → no, level at 2 each. Point at **Checked against** and the “Local rules · no model connection” label.
4. **Replay and recheck (20 s).** **Move to 58′**, then **Check again at 58′**. Now Eastport 3, Northbridge 2, with the new shot at 58′. No cause is inferred.
5. **Share (15 s).** Open **Share what changed**; the card footer names the fixture, version and local-rules reading. Copy, download or (on a supported phone) **Share the receipts**.
6. **A different match (25 s).** **All matches → Return match**. Choose the example “Eastport had more possession than Northbridge but Northbridge had more shots” at 90+4′: two claims, both supported, because possession and shots can differ. Then “Saka has had a horrible game” at 60′: his records, no rating.
7. **Vision (10 s).** A WhatsApp companion is planned; this demo reads no chat.

## Other checks (Original match unless stated)

| Select | Ask | Expect |
| --- | --- | --- |
| `57′` | Saka has had a horrible game | Saka’s recorded contributions; no rating; no benchmark invented |
| `58′` | How many passes did Bruno complete? | Asks Bruno Guimarães or Bruno Fernandes; no pass count |
| `57′` | Northbridge parked the bus | Defensive shape not recorded; possession only as labelled context |
| `57′` | Northbridge covered more distance than Eastport | Running distance not recorded; no substitute statistics |
| Return, `88′`, Last 10 minutes | Northbridge had more possession than Eastport | Supported on the window (88.9%), unlike the whole match (42.4%) |

## Limits to state honestly

- All data is synthetic and sampled: no real performances, video, tracking or xG.
- Local rules, not a language model. Open failures include negated goals, “before the goal”, “every”, zero counts and shot location.
- Snapshots live in browser memory and vanish on refresh.
- Native sharing is unverified on a real device. Foundry has had only small bounded live runs on an earlier prompt/schema and is not part of this deployment.

## Reporting a problem

Note the exact opinion, match, selected time and period, what you expected, and what you saw. Do not include credentials or personal information.
