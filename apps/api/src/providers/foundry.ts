import type {
  InterpretationContext,
  InterpretationProvider,
} from './provider.js'

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
      maxItems: 8,
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
                playerMetric: {
                  anyOf: [
                    {
                      type: 'string',
                      enum: ['shots', 'shots-on-target', 'goals', 'possession-percentage', 'pass-attempts', 'pass-completions', 'pass-completion-percentage', 'running-distance', 'minutes-played', 'recoveries', 'pressure-observations'],
                    },
                    { type: 'null' },
                  ],
                },
                required: ['id', 'name', 'team'],
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

  constructor(
    configuration: FoundryConfiguration,
    request: typeof fetch = fetch,
  ) {
    this.configuration = configuration
    this.request = request
  }

  async interpret(
    opinion: string,
    context: InterpretationContext,
  ): Promise<unknown> {
    const endpoint = `${this.configuration.baseUrl.replace(/\/+$/, '')}/chat/completions`
    const response = await this.request(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'api-key': this.configuration.apiKey,
      },
      body: JSON.stringify({
        model: this.configuration.deployment,
        messages: [
          {
            role: 'system',
            content:
              'Interpret the user opinion as separate, minimal claims. Return only the required structured format. Do not assess truth, calculate statistics, or invent evidence. Resolve players only from availablePlayers and return their exact ID, name, and team; ambiguity such as Bruno must be clarified. Use only team names, players, and event IDs in the supplied context. Use the capability catalogue to distinguish available, partial, and unrecorded evidence. Identify missing data needs explicitly; never replace unavailable possession or territorial evidence with shots. A small build-up annotation sample is partial, not complete match-wide coverage. For a claim about circumstances before a goal, select a real goal event anchor and set timePeriod to before-event with that same ID; the server applies an exclusive cutoff. If an entity or meaning is unclear, explain clarificationNeeds.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              opinion,
              selectedTime: context.selectedTime,
              selectedPeriod: context.period,
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
    if (!response.ok) {
      throw new Error(
        `Microsoft Foundry interpretation failed with HTTP ${response.status}.`,
      )
    }
    const result: unknown = await response.json()
    if (
      typeof result !== 'object' ||
      result === null ||
      !('choices' in result) ||
      !Array.isArray(result.choices) ||
      result.choices.length === 0
    ) {
      throw new Error('Microsoft Foundry returned no interpretation choices.')
    }
    const firstChoice: unknown = result.choices[0]
    if (
      typeof firstChoice !== 'object' ||
      firstChoice === null ||
      !('message' in firstChoice) ||
      typeof firstChoice.message !== 'object' ||
      firstChoice.message === null ||
      !('content' in firstChoice.message) ||
      typeof firstChoice.message.content !== 'string'
    ) {
      throw new Error('Microsoft Foundry returned an invalid structured response.')
    }

    const parsed: unknown = JSON.parse(firstChoice.message.content)
    return parsed
  }
}

export function createFoundryProvider(
  environment: NodeJS.ProcessEnv,
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

  return new FoundryInterpretationProvider({ baseUrl, apiKey, deployment })
}
