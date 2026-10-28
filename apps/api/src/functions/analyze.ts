import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions'
import { analyzeOpinion } from '../service.js'
import { InputValidationError, parseAnalysisRequest } from '../validation.js'
import type { InterpretationProvider } from '../providers/provider.js'
import { InterpretationProviderError } from '../providers/provider.js'
import { createFoundryProvider } from '../providers/foundry.js'
import {
  createAzureTableFoundryAllowance,
  FoundryAllowanceConfigurationError,
  FoundryAllowanceExceededError,
  FoundryAllowanceUnavailableError,
  foundryClientIdentity,
} from '../foundryAllowance.js'

export const ANALYSIS_MODE_HEADER = 'x-analysis-mode'

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
      return {
        status: 200,
        jsonBody: await analyzeOpinion(body, activeProvider),
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
