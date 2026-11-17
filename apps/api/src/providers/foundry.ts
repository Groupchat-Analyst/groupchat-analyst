import type {
  InterpretationContext,
  InterpretationProvider,
  PunditFacts,
} from './provider.js'
import { InterpretationProviderError } from './provider.js'
import { appendFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { elapsedEventSeconds } from '../../../shared/src/match.js'

type FoundryUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

type FoundryRawCapture = {
  structuredOutput: string | null
  usage: FoundryUsage
}

type FoundryRawCaptureHandler = (
  capture: FoundryRawCapture,
) => void | Promise<void>

type FoundryConfiguration = {
  baseUrl: string
  apiKey: string
  deployment: string
}

const MAX_COMPLETION_TOKENS = 8192

export async function appendLocalFoundryCapture(record: object): Promise<void> {
  const captureFile = resolve(process.cwd(), '.local-captures', 'foundry-raw-output.jsonl')
  await mkdir(dirname(captureFile), { recursive: true })
  await appendFile(captureFile, `${JSON.stringify({ capturedAt: new Date().toISOString(), ...record })}\n`, { encoding: 'utf8', mode: 0o600 })
}

function claimSchema(teams: readonly string[]) {
  return {
  type: 'object',
  additionalProperties: false,
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          subject: { anyOf: [{ type: 'string', enum: teams }, { type: 'null' }] },
          playerSubject: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  team: { type: 'string', enum: teams },
                },
                required: ['id', 'name', 'team'],
              },
              { type: 'null' },
            ],
          },
          playerMetric: {
            anyOf: [
              {
                type: 'string',
                enum: [
                  'shots',
                  'shots-on-target',
                  'goals',
                  'possession-percentage',
                  'pass-attempts',
                  'pass-completions',
                  'pass-completion-percentage',
                  'running-distance',
                  'minutes-played',
                  'recoveries',
                  'pressure-observations',
                ],
              },
              { type: 'null' },
            ],
          },
          text: { type: 'string' },
          intent: {
            type: 'string',
            enum: [
              'statistical-request',
              'factual-claim',
              'subjective-judgement',
              'unavailable-metric',
              'coaching-question',
              'unrecognized-language',
            ],
          },
          meaning: {
            type: 'object',
            additionalProperties: false,
            properties: {
              category: {
                type: 'string',
                enum: [
                  'factual-comparison',
                  'performance-judgement',
                  'historical-circumstance',
                  'coaching-question',
                  'other',
                ],
              },
              description: { type: 'string' },
              comparison: {
                anyOf: [
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      opponent: { type: 'string', enum: teams },
                      opponentPlayer: {
                        anyOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              team: { type: 'string', enum: teams },
                            },
                            required: ['id', 'name', 'team'],
                          },
                          { type: 'null' },
                        ],
                      },
                      metric: { type: 'string', enum: ['shots', 'shots-on-target', 'goals', 'possession-percentage', 'pass-attempts', 'pass-completions', 'pass-completion-percentage', 'running-distance', 'minutes-played', 'recoveries', 'pressure-observations'] },
                      operator: {
                        type: 'string',
                        enum: [
                          'greater-than',
                          'less-than',
                          'equal',
                          'greater-or-equal',
                          'less-or-equal',
                          'not-equal',
                          'comparison-request',
                        ],
                      },
                    },
                    required: ['opponent', 'opponentPlayer', 'metric', 'operator'],
                  },
                  { type: 'null' },
                ],
              },
            },
            required: ['category', 'description', 'comparison'],
          },
          requiredEvidence: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'possession',
                'territorial-control',
                'shots',
                'shots-on-target',
                'goals',
                'attacking-events',
                'player-events',
                'passing',
                'possession-losses',
                'physical-measurements',
                'build-up-phase',
                'lineups',
              ],
            },
          },
          timePeriod: {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['selected', 'before-event', 'after-event'] },
              eventId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              lookbackSeconds: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
            },
            required: ['kind', 'eventId', 'lookbackSeconds'],
          },
          historicalEventAnchor: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  eventId: { type: 'string' },
                  relationship: { type: 'string' },
                },
                required: ['eventId', 'relationship'],
              },
              { type: 'null' },
            ],
          },
          clarificationNeeds: {
            type: 'array',
            items: { type: 'string' },
          },
          clarificationReason: {
            anyOf: [
              { type: 'string', enum: ['unavailable-evidence', 'ambiguous-reference', 'ambiguous-meaning'] },
              { type: 'null' },
            ],
          },
        },
        required: [
          'id',
          'subject',
          'playerSubject',
          'playerMetric',
          'text',
          'intent',
          'meaning',
          'requiredEvidence',
          'timePeriod',
          'historicalEventAnchor',
          'clarificationNeeds',
          'clarificationReason',
        ],
      },
    },
  },
  required: ['claims'],
  }
}

function separateEvidenceLimitations(
  output: unknown,
  context: InterpretationContext,
): unknown {
  if (typeof output !== 'object' || output === null ||
      !('claims' in output) || !Array.isArray(output.claims)) return output
  return {
    ...output,
    claims: output.claims.map((value: unknown) => {
      if (typeof value !== 'object' || value === null ||
          !('clarificationReason' in value)) return value
      const { clarificationReason, ...claim } = value
      if (clarificationReason !== null && clarificationReason !== 'unavailable-evidence' &&
          clarificationReason !== 'ambiguous-reference' && clarificationReason !== 'ambiguous-meaning') {
        throw new InterpretationProviderError('semantic-validation', 'Foundry returned an invalid clarification reason.')
      }
      if (clarificationReason !== 'unavailable-evidence' ||
          !('subject' in claim) || !context.teams.some((team) => team === claim.subject) ||
          !('playerSubject' in claim) || claim.playerSubject !== null ||
          !('playerMetric' in claim) || claim.playerMetric !== null ||
          !('intent' in claim) ||
          !('meaning' in claim) || typeof claim.meaning !== 'object' || claim.meaning === null ||
          !('category' in claim.meaning) ||
          !('requiredEvidence' in claim) || !Array.isArray(claim.requiredEvidence) ||
          !('clarificationNeeds' in claim) || !Array.isArray(claim.clarificationNeeds) ||
          claim.clarificationNeeds.length === 0 || claim.clarificationNeeds.length > 8 ||
          !claim.clarificationNeeds.every((need: unknown) =>
            typeof need === 'string' && need.trim().length > 0 && need.length <= 240) ||
          !('timePeriod' in claim) || typeof claim.timePeriod !== 'object' || claim.timePeriod === null ||
          !('historicalEventAnchor' in claim)) return claim
      const period = claim.timePeriod
      const anchor = claim.historicalEventAnchor
      const resolvedSelected = 'kind' in period && period.kind === 'selected' && anchor === null
      const resolvedGoal = 'kind' in period && (period.kind === 'before-event' || period.kind === 'after-event') &&
        'eventId' in period && typeof period.eventId === 'string' &&
        typeof anchor === 'object' && anchor !== null && 'eventId' in anchor &&
        anchor.eventId === period.eventId &&
        context.events.some((event) => event.id === period.eventId && event.type === 'shot' && event.outcome === 'goal')
      if (!resolvedSelected && !resolvedGoal) return claim
      const qualitative = claim.intent === 'subjective-judgement' &&
        claim.meaning.category === 'performance-judgement' &&
        'comparison' in claim.meaning && claim.meaning.comparison === null &&
        claim.requiredEvidence.includes('shots')
      const unavailablePossession = claim.intent === 'unavailable-metric' &&
        claim.requiredEvidence.includes('possession') &&
        context.capabilities.some((capability) => capability.id === 'possession-intervals' && capability.status === 'not-recorded')
      if (!qualitative && !unavailablePossession) return claim
      return { ...claim, clarificationNeeds: [] }
    }),
  }
}

export class FoundryInterpretationProvider implements InterpretationProvider {
  readonly name = 'foundry' as const
  private readonly configuration: FoundryConfiguration
  private readonly request: typeof fetch
  private readonly onUsage?: (usage: FoundryUsage) => void
  private readonly onRawCapture?: FoundryRawCaptureHandler

  constructor(
    configuration: FoundryConfiguration,
    request: typeof fetch = fetch,
    onUsage?: (usage: FoundryUsage) => void,
    onRawCapture?: FoundryRawCaptureHandler,
  ) {
    this.configuration = configuration
    this.request = request
    this.onUsage = onUsage
    this.onRawCapture = onRawCapture
  }

  async generatePunditReply(facts: PunditFacts, onResponse?: (content: string) => void): Promise<unknown> {
    let response: Response
    try {
      response = await this.request(`${this.configuration.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'api-key': this.configuration.apiKey },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          model: this.configuration.deployment,
          max_completion_tokens: MAX_COMPLETION_TOKENS,
          messages: [
            { role: 'system', content: `Talk to the fan like a thoughtful coach or pundit, in 3–5 natural, concise sentences. Open with a clear judgement that backs, challenges or qualifies the take. Select the strongest relevant verified facts and explain what they suggest about the game, rather than listing every record. When the evidence shows a team kept creating after an equaliser, that change in the game can be more revealing than the count alone; use the relevant facts if they support it. Treat pressure, comfort and tactical explanations as interpretations, not established causes. Do not claim tracking, shape, chance quality or anything else the records cannot establish.

To keep factual details exact, insert at least one supplied verifiedPhrases token verbatim in your sentences; the application replaces each token with its verified text. Use only tokens that fit the take, and make the surrounding grammar fit their text. Outside tokens do not use player names, digits, number words one through ten (even idiomatically), or the words score, scored, scoring, equalise, equalised, equalising, equalize, equalized, equalizing, goal, corner, save, saved, blocked, shot or attempt. Use the tokens instead of adding event descriptions, scores, numbers, distances or other unverified facts yourself. Return text as a single paragraph between 20 and 1200 characters, with no URLs, angle brackets or extra brackets. Do not write raw coordinates, event IDs, precise timestamps or counting methodology in the reply: those belong in How this was checked. The anchor goal is outside the before-goal count. Include all eventIds attached to each token you use, plus any other supplied records informing your judgement; eventIds must be nonempty and contain only supplied shot or sequence IDs. Do not invent IDs. Output JSON only.` },
            { role: 'user', content: JSON.stringify(facts) },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'pundit_reply', strict: true,
              schema: {
                type: 'object', additionalProperties: false,
                properties: {
                  text: { type: 'string' },
                  eventIds: { type: 'array', items: { type: 'string' } },
                },
                required: ['text', 'eventIds'],
              },
            },
          },
        }),
      })
    } catch (error) {
      throw new InterpretationProviderError('transport', 'Pundit reply generation could not be reached.', error)
    }
    if (!response.ok) throw new InterpretationProviderError(response.status === 429 ? 'throttling' : 'transport', `Pundit reply generation failed with HTTP ${response.status}.`)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('choices' in result) || !Array.isArray(result.choices) || result.choices.length === 0) {
      throw new InterpretationProviderError('incomplete-output', 'Pundit reply generation returned no choice.')
    }
    if ('usage' in result && typeof result.usage === 'object' && result.usage !== null) {
      const raw = result.usage
      const usage: FoundryUsage = {}
      if ('prompt_tokens' in raw && Number.isInteger(raw.prompt_tokens) && typeof raw.prompt_tokens === 'number') usage.promptTokens = raw.prompt_tokens
      if ('completion_tokens' in raw && Number.isInteger(raw.completion_tokens) && typeof raw.completion_tokens === 'number') usage.completionTokens = raw.completion_tokens
      if ('total_tokens' in raw && Number.isInteger(raw.total_tokens) && typeof raw.total_tokens === 'number') usage.totalTokens = raw.total_tokens
      if (Object.keys(usage).length > 0) this.onUsage?.(usage)
    }
    const choice: unknown = result.choices[0]
    if (typeof choice === 'object' && choice !== null &&
        'message' in choice && typeof choice.message === 'object' && choice.message !== null &&
        'content' in choice.message && typeof choice.message.content === 'string') {
      onResponse?.(choice.message.content)
    }
    if (typeof choice !== 'object' || choice === null || !('finish_reason' in choice) || choice.finish_reason !== 'stop' ||
        !('message' in choice) || typeof choice.message !== 'object' || choice.message === null ||
        !('content' in choice.message) || typeof choice.message.content !== 'string' ||
        ('refusal' in choice.message && choice.message.refusal)) {
      throw new InterpretationProviderError('incomplete-output', 'Pundit reply generation returned an incomplete response.')
    }
    try {
      return JSON.parse(choice.message.content)
    } catch (error) {
      throw new InterpretationProviderError('schema', 'Pundit reply generation returned invalid JSON.', error)
    }
  }

  async interpret(
    opinion: string,
    context: InterpretationContext,
  ): Promise<unknown> {
    const endpoint = `${this.configuration.baseUrl.replace(/\/+$/, '')}/chat/completions`
    const timeoutSignal = AbortSignal.timeout(30_000)
    const availableTeams = context.teams
    const winningGoal = context.winningGoal &&
      context.events.some(
        (event) =>
          event.id === context.winningGoal?.eventId &&
          event.type === 'shot' &&
          event.outcome === 'goal' &&
          event.playerId === context.winningGoal.sourcePlayerId,
      )
      ? context.winningGoal
      : undefined
    const goalScorers = context.goalScorers ?? (winningGoal ? [winningGoal] : [])
    const score = { Northbridge: 0, Eastport: 0 }
    const goalContext = new Map<string, { scorerAliases?: readonly string[]; scoreAfter: typeof score }>()
    for (const event of [...context.events].sort((a, b) => elapsedEventSeconds(a) - elapsedEventSeconds(b))) {
      if (event.type !== 'shot' || event.outcome !== 'goal') continue
      score[event.team]++
      const scorer = goalScorers.find((item) => item.eventId === event.id && item.sourcePlayerId === event.playerId)
      goalContext.set(event.id, { ...(scorer ? { scorerAliases: scorer.scorerAliases } : {}), scoreAfter: { ...score } })
    }
    let response: Response
    try {
      response = await this.request(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'api-key': this.configuration.apiKey,
        },
        signal: timeoutSignal,
        body: JSON.stringify({
        model: this.configuration.deployment,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        messages: [
          {
            role: 'system',
            content: `Interpret the user opinion as separate, minimal claims. Return every field required by the schema, using null for nullable fields. Do not assess truth, calculate statistics, or invent evidence.

Use only availableTeams, availablePlayers, and availableEvents from the supplied context; winningGoal, when present, verifies its scorer aliases and event ID. Resolve player subjects only from availablePlayers and return their exact ID, name, and team. A scorer mentioned only to identify a goal-based time window is not the subject of the claim: resolve that goal from the eligible goal's scorerAliases or a matching available player and its goal records, independently of playerSubject. For a team claim, keep subject as the team being assessed, playerSubject and playerMetric null, even when the scorer is absent from availablePlayers. An empty availablePlayers list does not prevent using verified goal scorerAliases for a time anchor. If multiple eligible goals plausibly match the wording, or no eligible goal matches, ask which spell is meant; never guess or reveal future goals. Keep claim.text concise and faithful; express yes/no questions as declarative propositions rather than repeating question wording. Never put record IDs in claim.text, descriptions, or clarification text. If a name is ambiguous, set subject and playerSubject to null, include one concise clarificationNeeds item, and do not guess. For example, “Bruno” is ambiguous between Bruno Fernandes (Eastport) and Bruno Guimarães (Northbridge).

Goal events may include verified scorerAliases and scoreAfter, computed from eligible recorded goals. Use both to identify an equaliser without confusing it with a later winner. For play after a goal through the replay clock, use timePeriod.kind after-event, that goal's eventId, lookbackSeconds null, and the same historicalEventAnchor; the anchor itself is excluded. For a rolling duration ending at the replay clock, use kind selected, eventId null, and lookbackSeconds equal to the requested seconds, irrespective of the selected UI period. With no requested duration use null.

For a team comparison, put the first team in subject, the other in meaning.comparison.opponent, and set playerSubject and opponentPlayer to null. For a player comparison, set playerSubject to the first player's exact reference, subject to that player's team, opponentPlayer to the second player's exact reference, and opponent to that player's team. Never mix a team and player in one comparison. Any comparison uses meaning.category factual-comparison and the evidence kind matching its metric.

Intent and operator must agree:
- A negative tag comparison such as “Amad didn’t complete passes at a higher rate than Saka, did he?” is an asserted comparison: preserve the named-player order, use less-or-equal, factual-claim, and the pass-completion-percentage metric with passing evidence.
- Treat each distinct clause in a compound opinion as its own claim with the evidence it needs. A statement that a team scored before half-time is an event-time assertion: use the selected period and goal evidence, not the exclusive before-event scope used for circumstances before a specific goal. A separate possession comparison remains a separate claim.
- Keep requested operation, claim meaning, and time scope distinct. A question asking for a quantitative count or rate before a goal remains intent statistical-request with meaning.category other (or factual-comparison for a comparison request); set passing or the requested metric as requiredEvidence. Use timePeriod.kind before-event and the same real goal ID in historicalEventAnchor and timePeriod.eventId. For a bounded window before that goal, set lookbackSeconds to the requested duration in seconds (for example 600 for ten minutes); otherwise set it to null. A numerical assertion before a goal remains factual-claim with its factual comparison and directional operator. Do not turn either into a historical-circumstance judgement just because it refers to a goal.
- When a claim requests where possession was lost during build-up, requiredEvidence includes build-up-phase and possession-losses. Treat it as a coaching question, retrieve only turnovers explicitly linked by the versioned selected-sample annotations, and do not answer with general passing totals or all-pass turnovers.
- A request to calculate or compare statistics uses intent statistical-request. A comparison request uses meaning.comparison.operator comparison-request; do not turn a request into a factual verdict.
- A yes/no question asking whether a team recorded any actions, such as a shot, requests that team's recorded count: use statistical-request, meaning.category other, and the matching evidence kind. Do not infer the result.
- An asserted comparison uses intent factual-claim and its stated directional operator (for example, greater-than). Do not use comparison-request for an assertion. A yes/no or tag question that asks whether a comparison is true is a factual-claim, not a request for descriptive statistics. A negative tag does not negate the preceding proposition: “Saka's accuracy was below Amad's, wasn't it?” means Saka is below Amad, so use less-than (not greater-or-equal).
- An assertion or request about a metric marked not-recorded uses intent unavailable-metric, even when phrased as a factual comparison. Keep its comparison, use the matching unavailable evidence kind, and do not ask for clarification unless the entity or metric itself is ambiguous. Unavailability is not ambiguity. For an unavailable comparison phrased as a question (“Which team covered greater distance?”), use comparison.operator comparison-request while keeping intent unavailable-metric; do not turn unavailable data into a verdict. For a directional assertion about unavailable distance, use its stated directional operator. Running distance uses metric running-distance and requiredEvidence physical-measurements; never substitute another statistic.
- A broad player performance question is not a verdict. Resolve the player, use intent subjective-judgement and meaning.category performance-judgement, and request player-events, passing, shots, and goals as relevant to the wording.
- Broad team judgements such as “controlled the match”, “dominated”, or “were in complete control” are subjective-judgement claims, not requests to measure territorial control. Do not ask clarification just because territorial tracking is absent. Use available possession/shot context, explain its limits, and do not claim an overall verdict from those proxies.
- A qualitative claim that one team had the other under control is a single team performance judgement, not a statistical comparison. Resolve the team and spell independently of whether possession, passing or pressure data exist. If available, use shots as relevant context for whether an attack was contained, while keeping missing metrics as limitations; shots do not measure possession or prove overall control.
- For a judgement about pressure, control or comfort in a bounded spell before an identifiable scorer's goal, use subjective-judgement, performance-judgement, shots as relevant context, and the verified before-event anchor with the requested lookback. The subject need not be the scoring team. Never reveal or select an unavailable later goal; if it is unavailable, ask which spell is meant.
- For separate claims clearly referring to the same named spell, preserve that same before-event anchor and lookback on each claim.
- Phrases such as “covered more/greater distance”, “which side covered the greater distance”, “covered more ground”, and “ran further” request running-distance, which is not recorded. Use intent unavailable-metric, meaning.category factual-comparison, comparison metric running-distance, the operator appropriate to the assertion/request wording, and requiredEvidence physical-measurements. Do not request clarification when both teams are named.
- clarificationReason is null when no clarification is needed. If clarification is needed, choose ambiguous-reference for unresolved teams, players or goals, ambiguous-meaning for unclear wording, or unavailable-evidence only for missing records with the subject and time already resolved. If both ambiguity and missing data are present, choose the ambiguity. clarificationNeeds must contain no more than eight short items, each no longer than 240 characters. Missing evidence alone is not a reason to clarify a resolved qualitative take: include available relevant evidence and leave clarificationNeeds empty. Explicit requests for unavailable metrics must report unavailability, not substitute a different metric.

Set playerMetric only for a single-player metric request; otherwise set it to null. Match evidence kinds to metrics: shots to shots, shots on target to shots-on-target, goals to goals, pass metrics to passing, possession percentage to possession, running distance to physical-measurements, minutes played to lineups, and recoveries or pressure observations to player-events. Use only evidence kinds that answer the claim.

For a goal, the playerId on its availableEvents shot is the authoritative scorer; never attribute that goal to another player. Use the capability catalogue to distinguish available, partial, and unrecorded evidence. Identify missing data needs explicitly; never replace an explicit request for unavailable possession or territorial metrics with shots. For a broad qualitative judgement, available shots can be labelled as limited context, not a substitute measure of possession or territorial control. A small build-up annotation sample is partial, not complete match-wide coverage.

For a claim specifically about the circumstances of a team's goal (for example, whether that goal came against the run of play), use intent factual-claim and meaning.category historical-circumstance. A qualitative judgement about a team's play in the spell before a goal is instead subjective-judgement with performance-judgement; the goal is its time anchor, not necessarily its subject's goal. Quantitative requests and numerical comparisons keep their own operation and category as described above, while using the same historical scope. For every before-event or after-event scope, select a real goal from availableEvents as both historicalEventAnchor.eventId and timePeriod.eventId. A historical-circumstance claim about a team's goal must anchor to that team's goal; a statistic about one team may be scoped before the other team's goal. When a player historical-circumstance claim attributes that goal to the named player, the event's playerId must match. A player's statistics may be scoped before a team goal without claiming that player scored it. A before-event scope excludes the goal and later events; an after-event scope excludes the goal and ends at the replay clock. Otherwise use selected, eventId null, and historicalEventAnchor null. If an entity or meaning is unclear, explain clarificationNeeds.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              opinion,
              selectedTime: context.selectedTime,
              selectedPeriod: context.period,
              availableTeams,
              ...(winningGoal ? { winningGoal } : {}),
              availableEvidenceCapabilities: context.capabilities,
              availablePlayers: context.players.map(({ id, name, team, status }) => ({
                id,
                name,
                team,
                status,
              })),
              availableEvents: context.events.map((event) => ({
                id: event.id,
                clock: event.clock,
                team: event.team,
                type: event.type,
                ...(event.type === 'shot' && event.playerId
                  ? { playerId: event.playerId }
                  : {}),
                description: event.description,
                ...(event.type === 'shot' ? { outcome: event.outcome } : {}),
                ...goalContext.get(event.id),
              })),
            }),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'claim_interpretation',
            strict: true,
            schema: claimSchema(availableTeams),
          },
        },
        }),
      })
    } catch (error) {
      const timedOut =
        timeoutSignal.aborted ||
        (error instanceof Error && error.name === 'TimeoutError')
      throw new InterpretationProviderError(
        'transport',
        timedOut
          ? 'Microsoft Foundry interpretation timed out after 30 seconds.'
          : 'Microsoft Foundry could not be reached.',
        error,
      )
    }
    if (!response.ok) {
      throw new InterpretationProviderError(
        response.status === 429 ? 'throttling' : 'transport',
        response.status === 429
          ? 'Microsoft Foundry is throttling interpretation requests (HTTP 429).'
          : `Microsoft Foundry interpretation failed with HTTP ${response.status}.`,
      )
    }
    let result: unknown
    try {
      result = await response.json()
    } catch (error) {
      const timedOut =
        timeoutSignal.aborted ||
        (error instanceof Error && error.name === 'TimeoutError')
      const interrupted =
        timedOut || (error instanceof Error && error.name === 'AbortError')
      throw new InterpretationProviderError(
        interrupted ? 'transport' : 'schema',
        timedOut
          ? 'Microsoft Foundry interpretation timed out after 30 seconds.'
          : interrupted
            ? 'Microsoft Foundry response transfer was interrupted.'
            : 'Microsoft Foundry returned invalid JSON.',
        error,
      )
    }
    if (
      typeof result !== 'object' ||
      result === null ||
      !('choices' in result) ||
      !Array.isArray(result.choices) ||
      result.choices.length === 0
    ) {
      throw new InterpretationProviderError(
        'incomplete-output',
        'Microsoft Foundry returned no interpretation choices.',
      )
    }
    const firstChoice: unknown = result.choices[0]
    if (
      typeof firstChoice !== 'object' ||
      firstChoice === null ||
      !('message' in firstChoice) ||
      typeof firstChoice.message !== 'object' ||
      firstChoice.message === null
    ) {
      throw new InterpretationProviderError(
        'incomplete-output',
        'Microsoft Foundry returned an incomplete structured response.',
      )
    }

    const message = firstChoice.message
    const rawUsage =
      'usage' in result && typeof result.usage === 'object' && result.usage !== null
        ? result.usage
        : undefined
    const capturedUsage: FoundryUsage = {}
    if (
      rawUsage &&
      'prompt_tokens' in rawUsage &&
      typeof rawUsage.prompt_tokens === 'number' &&
      Number.isInteger(rawUsage.prompt_tokens)
    ) {
      capturedUsage.promptTokens = rawUsage.prompt_tokens
    }
    if (
      rawUsage &&
      'completion_tokens' in rawUsage &&
      typeof rawUsage.completion_tokens === 'number' &&
      Number.isInteger(rawUsage.completion_tokens)
    ) {
      capturedUsage.completionTokens = rawUsage.completion_tokens
    }
    if (
      rawUsage &&
      'total_tokens' in rawUsage &&
      typeof rawUsage.total_tokens === 'number' &&
      Number.isInteger(rawUsage.total_tokens)
    ) {
      capturedUsage.totalTokens = rawUsage.total_tokens
    }
    if (this.onRawCapture) {
      await this.onRawCapture({
        structuredOutput:
          'content' in message && typeof message.content === 'string'
            ? message.content
            : null,
        usage: capturedUsage,
      })
    }
    if (
      ('refusal' in message &&
        typeof message.refusal === 'string' &&
        message.refusal.length > 0) ||
      ('finish_reason' in firstChoice && firstChoice.finish_reason === 'content_filter')
    ) {
      throw new InterpretationProviderError(
        'refusal',
        'Microsoft Foundry refused to interpret this request.',
      )
    }
    if (
      'finish_reason' in firstChoice &&
      firstChoice.finish_reason === 'length'
    ) {
      throw new InterpretationProviderError(
        'incomplete-output',
        'Microsoft Foundry output was truncated.',
      )
    }
    if (!('finish_reason' in firstChoice) || firstChoice.finish_reason !== 'stop') {
      throw new InterpretationProviderError(
        'incomplete-output',
        'Microsoft Foundry did not finish a complete structured interpretation.',
      )
    }
    if (
      !('content' in message) ||
      typeof message.content !== 'string' ||
      message.content.length === 0
    ) {
      throw new InterpretationProviderError(
        'incomplete-output',
        'Microsoft Foundry returned no structured interpretation content.',
      )
    }

    if (rawUsage) {
      const usage: FoundryUsage = {}
      if (
        'prompt_tokens' in rawUsage &&
        typeof rawUsage.prompt_tokens === 'number' &&
        Number.isInteger(rawUsage.prompt_tokens)
      ) {
        usage.promptTokens = rawUsage.prompt_tokens
      }
      if (
        'completion_tokens' in rawUsage &&
        typeof rawUsage.completion_tokens === 'number' &&
        Number.isInteger(rawUsage.completion_tokens)
      ) {
        usage.completionTokens = rawUsage.completion_tokens
      }
      if (
        'total_tokens' in rawUsage &&
        typeof rawUsage.total_tokens === 'number' &&
        Number.isInteger(rawUsage.total_tokens)
      ) {
        usage.totalTokens = rawUsage.total_tokens
      }
      if (Object.keys(usage).length > 0) this.onUsage?.(usage)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(message.content)
    } catch (error) {
      throw new InterpretationProviderError(
        'schema',
        'Microsoft Foundry returned content that was not valid structured JSON.',
        error,
      )
    }
    return separateEvidenceLimitations(parsed, context)
  }
}

export function createFoundryProvider(
  environment: NodeJS.ProcessEnv,
  onUsage: (usage: FoundryUsage) => void = (usage) =>
    console.info('Microsoft Foundry token usage:', usage),
): FoundryInterpretationProvider {
  const baseUrl = environment.FOUNDRY_OPENAI_BASE_URL?.trim()
  const apiKey = environment.FOUNDRY_API_KEY?.trim()
  const deployment = environment.FOUNDRY_MODEL_DEPLOYMENT?.trim()
  if (!baseUrl || !apiKey || !deployment) {
    throw new Error(
      'Foundry mode requires FOUNDRY_OPENAI_BASE_URL, FOUNDRY_API_KEY, and FOUNDRY_MODEL_DEPLOYMENT.',
    )
  }
  if (!/^https:\/\/[^/]+\/openai\/v1\/?$/i.test(baseUrl)) {
    throw new Error(
      'FOUNDRY_OPENAI_BASE_URL must be an HTTPS Azure OpenAI-compatible v1 base URL ending in /openai/v1.',
    )
  }

  const captureEnabled =
    environment.FOUNDRY_CAPTURE_RAW_OUTPUT?.trim().toLowerCase() === 'true'
  const onRawCapture: FoundryRawCaptureHandler | undefined = captureEnabled
    ? async (capture) => {
        await appendLocalFoundryCapture(capture)
      }
    : undefined

  return new FoundryInterpretationProvider(
    { baseUrl, apiKey, deployment },
    fetch,
    onUsage,
    onRawCapture,
  )
}
