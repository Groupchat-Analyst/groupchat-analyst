# Project guidance

- The central experience is: enter a football opinion, interpret the claim, retrieve relevant match evidence, assess it, and provide a shareable explanation.
- Separate compound opinions into individual claims and show how each was understood. Ask for clarification when a clause or reference is ambiguous.
- Keep claim interpretation separate from deterministic evidence/statistic calculation so a future server-side AI interpreter can replace the deliberately limited local parser.
- Broad claims such as “dominated” and “lucky” may receive relevant, time-filtered statistics and event references as context, but never silently redefine them as a shot-count comparison. Label broad claims “insufficient evidence for a firm conclusion” when the data cannot establish their meaning.
- Retrieve evidence both for and against a claim; do not cherry-pick. Cite the underlying event IDs and match times, and respect the selected match time and evidence period in every statistic, assessment, and reference.
- Never invent missing player, passing, possession, chance-quality, or other match data. A broad judgement must not receive a definitive verdict based only on shot counts.
- Keep local interpreter coverage explicit and bounded; avoid adding an ever-growing set of phrase-specific exceptions. Unsupported claims must receive clarification or an explicit limitation, not a guessed interpretation.
- The browser sends only the opinion and selected time/period. The server owns the fixture, time filtering, statistics, evidence selection, and assessment; reject client-supplied statistics and never let a model calculate or replace them.
- Validate structured interpretation output before use. Model/provider failures and invalid output must be explicit, never converted into success-shaped or silently guessed assessments.
- The default server provider is a local rule-based interpreter, not Microsoft AI. The Foundry structured-output adapter must remain disabled unless explicitly enabled; keep credentials server-side in ignored local settings or server environment variables.
- Represent unavailable possession, territory, player, and passing evidence explicitly. Do not silently substitute shot counts. Historical periods anchored to an event must use an exclusive cutoff and exclude all later events.
- Explain missing data specifically and neutrally; do not blame the user for not supplying formal criteria.
- Keep match data clearly labelled as fictional/synthetic in the prototype.
- Calculate all statistics in application code; never ask AI to calculate them.
- Exclude every event after the user's selected match time from analysis.
- Support event, fixed-period, recent-minutes, before/after, match-so-far, and full-time selections.
- Present supporting evidence, counterevidence, and limitations. AI may explain verified results, but must not invent facts or conceal uncertainty.
- Keep any model calls server-side. Do not provision cloud resources or add messaging or publishing integrations until requested.
