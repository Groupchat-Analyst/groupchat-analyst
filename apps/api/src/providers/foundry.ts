import type {
  InterpretationContext,
  InterpretationProvider,
} from './provider.js'
import { InterpretationProviderError } from './provider.js'

type FoundryUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

type FoundryConfiguration = {
  baseUrl: string
  apiKey: string
  deployment: string
}

const CLAIM_SCHEMA = {
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
          subject: { anyOf: [{ type: 'string', enum: ['Northbridge', 'Eastport'] }, { type: 'null' }] },
          playerSubject: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  team: { type: 'string', enum: ['Northbridge', 'Eastport'] },
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
                      opponent: { type: 'string', enum: ['Northbridge', 'Eastport'] },
                      opponentPlayer: {
                        anyOf: [
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              team: { type: 'string', enum: ['Northbridge', 'Eastport'] },
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
              kind: { type: 'string', enum: ['selected', 'before-event'] },
              eventId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
            required: ['kind', 'eventId'],
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
        ],
      },
    },
  },
  required: ['claims'],
}

export class FoundryInterpretationProvider implements InterpretationProvider {
  readonly name = 'foundry' as const
  private readonly configuration: FoundryConfiguration
  private readonly request: typeof fetch
  private readonly onUsage?: (usage: FoundryUsage) => void

  constructor(
    configuration: FoundryConfiguration,
    request: typeof fetch = fetch,
    onUsage?: (usage: FoundryUsage) => void,
  ) {
    this.configuration = configuration
    this.request = request
    this.onUsage = onUsage
  }

  async interpret(
    opinion: string,
    context: InterpretationContext,
  ): Promise<unknown> {
    const endpoint = `${this.configuration.baseUrl.replace(/\/+$/, '')}/chat/completions`
    const timeoutSignal = AbortSignal.timeout(30_000)
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
        messages: [
          {
            role: 'system',
            content: `Interpret the user opinion as separate, minimal claims. Return every field required by the schema, using null for nullable fields. Do not assess truth, calculate statistics, or invent evidence.

Use only availableTeams, availablePlayers, and availableEvents from the supplied context. Resolve players only from availablePlayers and return their exact ID, name, and team. Keep claim.text concise and faithful; express yes/no questions as declarative propositions rather than repeating question wording. Never put record IDs in claim.text, descriptions, or clarification text. If a name is ambiguous, set subject and playerSubject to null, include one concise clarificationNeeds item, and do not guess. For example, “Bruno” is ambiguous between Bruno Fernandes (Eastport) and Bruno Guimarães (Northbridge).

For a team comparison, put the first team in subject, the other in meaning.comparison.opponent, and set playerSubject and opponentPlayer to null. For a player comparison, set playerSubject to the first player's exact reference, subject to that player's team, opponentPlayer to the second player's exact reference, and opponent to that player's team. Never mix a team and player in one comparison. Any comparison uses meaning.category factual-comparison and the evidence kind matching its metric.

Intent and operator must agree:
- A request to calculate or compare statistics uses intent statistical-request. A comparison request uses meaning.comparison.operator comparison-request; do not turn a request into a factual verdict.
- An asserted comparison uses intent factual-claim and its stated directional operator (for example, greater-than). Do not use comparison-request for an assertion. A yes/no or tag question that asks whether a comparison is true is a factual-claim, not a request for descriptive statistics. A negative tag does not negate the preceding proposition: “Saka's accuracy was below Amad's, wasn't it?” means Saka is below Amad, so use less-than (not greater-or-equal).
- An assertion or request about a metric marked not-recorded uses intent unavailable-metric, even when phrased as a factual comparison. Keep its comparison, use the matching unavailable evidence kind, and do not ask for clarification unless the entity or metric itself is ambiguous. Unavailability is not ambiguity. For an unavailable comparison phrased as a question (“Which team covered greater distance?”), use comparison.operator comparison-request while keeping intent unavailable-metric; do not turn unavailable data into a verdict. For a directional assertion about unavailable distance, use its stated directional operator. Running distance uses metric running-distance and requiredEvidence physical-measurements; never substitute another statistic.
- A broad player performance question is not a verdict. Resolve the player, use intent subjective-judgement and meaning.category performance-judgement, and request player-events, passing, shots, and goals as relevant to the wording.
- Broad team judgements such as “controlled the match”, “dominated”, or “were in complete control” are subjective-judgement claims, not requests to measure territorial control. Do not ask clarification just because territorial tracking is absent. Use available possession/shot context, explain its limits, and do not claim an overall verdict from those proxies.
- Phrases such as “covered more/greater distance”, “which side covered the greater distance”, “covered more ground”, and “ran further” request running-distance, which is not recorded. Use intent unavailable-metric, meaning.category factual-comparison, comparison metric running-distance, the operator appropriate to the assertion/request wording, and requiredEvidence physical-measurements. Do not request clarification when both teams are named.
- If clarification is needed, clarificationNeeds must contain no more than eight short items, each no longer than 240 characters.

Set playerMetric only for a single-player metric request; otherwise set it to null. Match evidence kinds to metrics: shots to shots, shots on target to shots-on-target, goals to goals, pass metrics to passing, possession percentage to possession, running distance to physical-measurements, minutes played to lineups, and recoveries or pressure observations to player-events. Use only evidence kinds that answer the claim.

For a goal, the playerId on its availableEvents shot is the authoritative scorer; never attribute that goal to another player. Use the capability catalogue to distinguish available, partial, and unrecorded evidence. Identify missing data needs explicitly; never replace unavailable possession or territorial evidence with shots. A small build-up annotation sample is partial, not complete match-wide coverage.

For a claim about circumstances before a goal, use intent factual-claim, meaning.category historical-circumstance, and select a real goal event from availableEvents as both historicalEventAnchor.eventId and timePeriod.eventId; set timePeriod.kind to before-event. The server applies an exclusive cutoff, so that goal and every later event are not evidence. Otherwise use timePeriod.kind selected and historicalEventAnchor null. If an entity or meaning is unclear, explain clarificationNeeds.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              opinion,
              selectedTime: context.selectedTime,
              selectedPeriod: context.period,
              availableTeams: ['Northbridge', 'Eastport'],
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
              })),
            }),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'claim_interpretation',
            strict: true,
            schema: CLAIM_SCHEMA,
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
      throw new InterpretationProviderError(
        'schema',
        'Microsoft Foundry returned invalid JSON.',
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
    if (
      'refusal' in message &&
      typeof message.refusal === 'string' &&
      message.refusal.length > 0
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

    if ('usage' in result && typeof result.usage === 'object' && result.usage !== null) {
      const rawUsage = result.usage
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
    return parsed
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

  return new FoundryInterpretationProvider(
    { baseUrl, apiKey, deployment },
    fetch,
    onUsage,
  )
}
