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
import { authorizeFoundryAccess, FoundryAccessError } from '../foundryAccess.js'
import {
  createAzureTableFoundryAllowance,
  FoundryAllowanceConfigurationError,
  FoundryAllowanceExceededError,
  FoundryAllowanceUnavailableError,
  foundryClientIdentity,
} from '../foundryAllowance.js'

export const FOUNDRY_ACCESS_HEADER = 'x-foundry-judge-code'

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
  createJudgeProvider = createFoundryProvider,
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
    const accessCode = request.headers?.get(FOUNDRY_ACCESS_HEADER)
    if (accessCode !== null && accessCode !== undefined &&
      !isContinuationAction(body)) {
      try {
        activeProvider = authorizeFoundryAccess(
          environment,
          accessCode,
          createJudgeProvider,
        )
        parseAnalysisRequest(body)
      } catch (error) {
        if (error instanceof InputValidationError) {
          return { status: 400, jsonBody: { error: error.message } }
        }
        if (error instanceof FoundryAccessError) {
          return {
            status: error.code === 'foundry_access_denied' ? 401 : 503,
            jsonBody: { error: error.message, errorCode: error.code },
          }
        }
        throw error
      }

      try {
        await createAllowance(environment).reserve(
          foundryClientIdentity(
            request.headers?.get('x-forwarded-for') ?? null,
          ),
        )
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
          context.error('Judge allowance storage is unavailable or unconfigured.')
          return {
            status: 503,
            jsonBody: {
              error:
                error instanceof FoundryAllowanceConfigurationError
                  ? 'Judge AI is not configured on this server. Use local rules instead.'
                  : error.message,
              errorCode:
                error instanceof FoundryAllowanceConfigurationError
                  ? 'foundry_not_configured'
                  : 'foundry_allowance_unavailable',
            },
          }
        }
        context.error('Judge allowance storage request failed.')
        return {
          status: 503,
          jsonBody: {
            error:
              'Judge AI request allowance is unavailable. No model request was made. Use local rules or try again later.',
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
