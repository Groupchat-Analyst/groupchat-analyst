import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions'
import { analyzeOpinion } from '../service.js'
import { InputValidationError } from '../validation.js'
import type { InterpretationProvider } from '../providers/provider.js'

export function createAnalyzeHandler(provider: InterpretationProvider) {
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

    try {
      return {
        status: 200,
        jsonBody: await analyzeOpinion(body, provider),
      }
    } catch (error) {
      if (error instanceof InputValidationError) {
        return { status: 400, jsonBody: { error: error.message } }
      }
      context.error('Match analysis request failed.', error)
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
