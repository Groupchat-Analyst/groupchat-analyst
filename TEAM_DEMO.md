# Groupchat Analyst demo guide

This guide describes the public, read-only local-provider candidate. Deployment of this branch must be confirmed separately. It uses the **local rules interpreter** (no model, no Foundry, no credentials), **fictional** matches, and server-side calculations. Do not describe it as AI-powered.

> Local rules understand a bounded set of phrasings. The example opinions on each match page are verified; other wording may be declined with a clarification or limitation. See [docs/LANGUAGE_ACCEPTANCE.md](./docs/LANGUAGE_ACCEPTANCE.md).

## 110-second walkthrough

1. **Problem (10 s).** Football arguments in group chats run on opinion; nobody checks the opinion against the match.
2. **Home and match selection (15 s).** “Your mate’s football opinion. Checked.” Flip the **57′ / 58′** preview switch (static, illustrative, no request). Press **Try it Out**, choose **Original match**, then press **See how one minute changes the take** while the composer is empty. This prepares the opinion and 57′ scope and enables the guided **Move to 58′** step; nothing is submitted. For a direct entry, `#/match/northbridge-eastport-analysis-demo/demo` enters the same guided flow. Both routes wait for an explicit press of **Check this moment**. Choosing an ordinary example instead does not enable the guided button.
3. **Check at 57′ (20 s).** Press **Check this moment**; your opinion appears on the right and the answer on the left, with **How this was checked** expandable: “Eastport had more shots on target than Northbridge.” → no, level at 2 each. Point at **Checked against** and the “Local rules · no model connection” label.
4. **Replay and recheck (20 s).** **Move to 58′**, then **Check again at 58′**. Now Eastport 3, Northbridge 2, with the new shot at 58′. No cause is inferred.
5. **Share (15 s).** Open **Share what changed**; the receipt footer names the teams, fixture, version and actual provider (for example, “Northbridge v Eastport · Original match v3.0.0 · read by local rules”). Copy, download or (on a supported phone) **Share the receipts**.
6. **A different match (20 s).** **All matches → Return match**. Choose the example “Eastport had more possession than Northbridge but Northbridge had more shots” at 90+4′ and submit: both claims are supported, because possession and shots can differ. Show the two attributed results. Keep the player opinions and the other matches for optional exploration after the recorded walkthrough.
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
- Local rules, not a language model. Shot location is reported as unavailable; “before the goal” is strictly before the resolved goal.
- Snapshots live in browser memory and vanish on refresh.
- Native sharing is unverified on a real device. Foundry has had only small bounded live runs on an earlier application version and is not part of this deployment.

## Reporting a problem

Note the exact opinion, match, selected time and period, what you expected, and what you saw. Do not include credentials or personal information.
