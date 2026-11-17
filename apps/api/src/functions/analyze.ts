import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions'
import { analyzeOpinion } from '../service.js'
import { InputValidationError, parseAnalysisRequest } from '../validation.js'
import type { InterpretationProvider } from '../providers/provider.js'
import { InterpretationProviderError } from '../providers/provider.js'
import { appendLocalFoundryCapture, createFoundryProvider } from '../providers/foundry.js'
import { historicalPunditFacts } from '../punditFacts.js'
import type { PunditFacts } from '../providers/provider.js'
import {
  createAzureTableFoundryAllowance,
  FoundryAllowanceConfigurationError,
  FoundryAllowanceExceededError,
  FoundryAllowanceUnavailableError,
  foundryClientIdentity,
} from '../foundryAllowance.js'

export const ANALYSIS_MODE_HEADER = 'x-analysis-mode'

type PunditValidation = { text: string } | { field: string; rule: string }

function validPunditText(value: unknown, facts: PunditFacts): PunditValidation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { field: 'response', rule: 'expected-object' }
  if (!('text' in value) || typeof value.text !== 'string') return { field: 'text', rule: 'expected-string' }
  if (!('eventIds' in value) || !Array.isArray(value.eventIds)) return { field: 'eventIds', rule: 'expected-array' }
  if (Object.keys(value).some((key) => key !== 'text' && key !== 'eventIds')) return { field: 'response', rule: 'unexpected-field' }
  const text = value.text.trim()
  const eventIds: unknown[] = value.eventIds
  const allowedIds = new Set([...facts.shots, ...facts.sequence].map(({ id }) => id))
  const phrases = new Map(facts.verifiedPhrases.map((phrase) => [phrase.token, phrase]))
  const tokens = text.match(/\[\[[A-Z0-9_]+\]\]/g) ?? []
  if (tokens.length === 0) return { field: 'text', rule: 'missing-verified-token' }
  if (tokens.some((token) => !phrases.has(token))) return { field: 'text', rule: 'unknown-verified-token' }
  if (tokens.some((token) => phrases.get(token)!.eventIds.some((id) => !eventIds.includes(id)))) return { field: 'eventIds', rule: 'missing-token-event-id' }
  const prose = text.replace(/\[\[[A-Z0-9_]+\]\]/g, '')
  if (text.length < 20 || text.length > 1200) return { field: 'text', rule: 'length-20-1200' }
  if (/[\r\n]/.test(prose)) return { field: 'text', rule: 'single-paragraph' }
  if (/[<>\[\]]/.test(prose)) return { field: 'text', rule: 'unexpected-markup-or-brackets' }
  if (/https?:/i.test(prose)) return { field: 'text', rule: 'url-not-allowed' }
  if (/\d/.test(prose)) return { field: 'text', rule: 'digit-outside-token' }
  if (/\b(?:ramsey|giroud|lacazette|schmeichel|xhaka|oxlade)\b/i.test(prose)) return { field: 'text', rule: 'player-name-outside-token' }
  if (/\b(?:scor(?:e|ed|ing)|equalis(?:e|ed|ing)|equaliz(?:e|ed|ing)|goal|corner|sav(?:e|ed)|blocked|shot|attempt)\b/i.test(prose)) return { field: 'text', rule: 'event-word-outside-token' }
  if (/\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(prose)) return { field: 'text', rule: 'number-word-outside-token' }
  if (/^\s*(?:yes|no)\b|\b(?:definitely|certainly|undoubtedly|proves?|proved)\b|\b(?:back|challenge|reject|agree with|disagree with|push back on)\s+(?:that|this|the)\s+(?:take|claim|opinion)\b/i.test(prose)) return { field: 'text', rule: 'broad-judgement-verdict' }
  const broadConcept = /\b(?:eas(?:e|ed|ing)\s+off|slow(?:ed|ing)?\s+down|retreat(?:ed|ing)?|tempo|pace|intensity|intent(?:ion)?|tactic(?:al|s)?|defensive\s+shape|territorial\s+control|dominance|dominat(?:e|ed|ing)|luck(?:y)?|comfort(?:able)?|pressur(?:e|ed|ing))\b/i
  const uncertainty = /\b(?:cannot|can't|can’t|could not|couldn't|couldn’t|do not|don't|don’t|does not|doesn't|doesn’t)\s+(?:establish|determine|prove|show|tell)|\b(?:uncertain|unknown|unavailable|not recorded|more evidence|not enough evidence)\b/i
  if (prose.split(/[.!?;]+|\b(?:but|although|though|however|yet)\b/i).some((clause) => broadConcept.test(clause) && !uncertainty.test(clause))) {
    return { field: 'text', rule: 'unsupported-broad-judgement' }
  }
  if (eventIds.length === 0) return { field: 'eventIds', rule: 'nonempty-array' }
  if (!eventIds.every((id) => typeof id === 'string' && allowedIds.has(id))) return { field: 'eventIds', rule: 'unknown-or-invalid-event-id' }
  const expanded = text.replace(/\[\[[A-Z0-9_]+\]\]/g, (token) => phrases.get(token)!.text)
  return { text: `${expanded} Overall tempo and tactical intent would require more evidence.` }
}

function checkedFacts(facts: PunditFacts): string[] {
  return [
    `Source: ${facts.source}`,
    `Window: ${facts.window}`,
    `Score at the start: Arsenal ${facts.scoreAtStart.Arsenal}, Leicester City ${facts.scoreAtStart['Leicester City']}.`,
    `Shots in the window: Arsenal ${facts.shotCounts.Arsenal}, Leicester City ${facts.shotCounts['Leicester City']}.`,
    ...facts.shots.map((shot) => `Shot ${shot.id} · ${shot.time} · ${shot.team} · ${shot.playerName ?? `player ${shot.playerId}`} · origin (${shot.origin.x}, ${shot.origin.y}) · ${shot.outcome}.`),
    ...facts.sequence.map((item) => `${item.id} · ${item.time} · ${item.description}.`),
    ...facts.limitations,
  ]
}

function isContinuationAction(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'action' in body &&
    (body.action === 'resolve-player' ||
      body.action === 'recheck-resolved-player')
  )
}

export function createAnalyzeHandler(
  provider: InterpretationProvider,
  environment: NodeJS.ProcessEnv = process.env,
  createAllowance = createAzureTableFoundryAllowance,
  createPublicAiProvider = createFoundryProvider,
) {
  return async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return {
        status: 400,
        jsonBody: { error: 'Request body must be valid JSON.' },
      }
    }

    let activeProvider = provider
    let foundryAttemptReserved = false
    const localRulesOnly =
      request.headers?.get(ANALYSIS_MODE_HEADER) === 'local'
    if (
      !localRulesOnly &&
      !isContinuationAction(body) &&
      environment.FOUNDRY_PUBLIC_ENABLED?.trim().toLowerCase() === 'true'
    ) {
      try {
        parseAnalysisRequest(body)
      } catch (error) {
        if (error instanceof InputValidationError) {
          return { status: 400, jsonBody: { error: error.message } }
        }
        throw error
      }

      try {
        activeProvider = createPublicAiProvider(environment)
      } catch {
        context.error('Public AI provider is unavailable or unconfigured.')
        return {
          status: 503,
          jsonBody: {
            error: 'AI interpretation is unavailable. Use local rules instead.',
            errorCode: 'foundry_not_configured',
          },
        }
      }

      try {
        await createAllowance(environment).reserve(
          foundryClientIdentity(
            request.headers?.get('x-forwarded-for') ?? null,
          ),
        )
        foundryAttemptReserved = true
      } catch (error) {
        if (error instanceof FoundryAllowanceExceededError) {
          return {
            status: 429,
            jsonBody: {
              error: error.message,
              errorCode:
                error.scope === 'total'
                  ? 'foundry_allowance_exhausted'
                  : 'foundry_client_allowance_exhausted',
            },
          }
        }
        if (
          error instanceof FoundryAllowanceConfigurationError ||
          error instanceof FoundryAllowanceUnavailableError
        ) {
          context.error('Public AI allowance storage is unavailable or unconfigured.')
          return {
            status: 503,
            jsonBody: {
              error:
                error instanceof FoundryAllowanceConfigurationError
                  ? 'AI interpretation is unavailable. Use local rules instead.'
                  : error.message,
              errorCode:
                error instanceof FoundryAllowanceConfigurationError
                  ? 'foundry_not_configured'
                  : 'foundry_allowance_unavailable',
            },
          }
        }
        context.error('Public AI allowance storage request failed.')
        return {
          status: 503,
          jsonBody: {
            error:
              'The AI request allowance could not be checked. No model request was made. Use local rules instead or try again later.',
            errorCode: 'foundry_allowance_unavailable',
          },
        }
      }
    }

    try {
      const result = await analyzeOpinion(body, activeProvider)
      if (foundryAttemptReserved && activeProvider.generatePunditReply && !isContinuationAction(body)) {
        const facts = historicalPunditFacts(parseAnalysisRequest(body), result)
        if (facts) {
          const requestId = context.invocationId
          let generationStarted = false
          let rawResponse: string | null = null
          let rejection: { field: string; rule: string } | null = null
          try {
            await createAllowance(environment).reserve(
              foundryClientIdentity(request.headers?.get('x-forwarded-for') ?? null),
            )
            generationStarted = true
            const generated = await activeProvider.generatePunditReply(facts, (content) => { rawResponse = content })
            const validation = validPunditText(generated, facts)
            if ('rule' in validation) {
              rejection = validation
              context.error(`Pundit reply rejected: requestId=${requestId} field=${validation.field} rule=${validation.rule}`)
              result.punditNotice = 'The generated reply was unavailable; the factual answer is shown instead.'
            } else {
              result.punditReply = { text: validation.text, checked: checkedFacts(facts) }
            }
          } catch (error) {
            const rule = error instanceof InterpretationProviderError ? `provider-${error.category}` :
              error instanceof FoundryAllowanceExceededError ? `allowance-${error.scope}` :
                error instanceof FoundryAllowanceConfigurationError ? 'allowance-configuration' :
                  error instanceof FoundryAllowanceUnavailableError ? 'allowance-unavailable' : 'unexpected-error'
            rejection = { field: generationStarted ? 'response' : 'allowance', rule }
            context.error(`Pundit reply unavailable: requestId=${requestId} field=${rejection.field} rule=${rule}`)
            result.punditNotice = error instanceof FoundryAllowanceExceededError
              ? `${error.message} The factual answer is shown instead.`
              : 'The generated reply was unavailable; the factual answer is shown instead.'
          }
          if (generationStarted && environment.FOUNDRY_CAPTURE_RAW_OUTPUT?.trim().toLowerCase() === 'true') {
            try {
              await appendLocalFoundryCapture({ kind: 'pundit-generation', requestId, structuredOutput: rawResponse, rejection })
            } catch {
              context.error(`Pundit diagnostic capture failed: requestId=${requestId}`)
            }
          }
        }
      }
      return {
        status: 200,
        jsonBody: result,
      }
    } catch (error) {
      if (error instanceof InputValidationError) {
        return { status: 400, jsonBody: { error: error.message } }
      }
      context.error('Match analysis request failed.', error)
      if (error instanceof InterpretationProviderError) {
        if (activeProvider.name === 'foundry' && foundryAttemptReserved) {
          return {
            status: 502,
            jsonBody: {
              error:
                'AI interpretation failed. This attempt used one allowance. Try again or use local rules instead.',
              errorCode: 'foundry_interpretation_failed',
              failureType: error.category,
            },
          }
        }
        return {
          status: 502,
          jsonBody: {
            error: error.message,
            failureType: error.category,
          },
        }
      }
      return {
        status: 502,
        jsonBody: {
          error:
            error instanceof Error
              ? error.message
              : 'The claim interpreter returned an unexpected error.',
        },
      }
    }
  }
}
