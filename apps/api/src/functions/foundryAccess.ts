import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions'
import { authorizeFoundryAccess, FoundryAccessError } from '../foundryAccess.js'
import {
  createAzureTableFoundryAllowance,
  FoundryAllowanceConfigurationError,
  FoundryAllowanceUnavailableError,
} from '../foundryAllowance.js'

export function createFoundryAccessHandler(
  environment: NodeJS.ProcessEnv,
  createAllowance = createAzureTableFoundryAllowance,
) {
  return async (
    request: HttpRequest,
    _context: InvocationContext,
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

    const candidate =
      typeof body === 'object' && body !== null && 'code' in body &&
      typeof body.code === 'string'
        ? body.code
        : null
    try {
      authorizeFoundryAccess(environment, candidate)
    } catch (error) {
      if (error instanceof FoundryAccessError) {
        return {
          status: error.code === 'foundry_access_denied' ? 401 : 503,
          jsonBody: { error: error.message, errorCode: error.code },
        }
      }
      throw error
    }

    try {
      const allowance = createAllowance(environment)
      await allowance.checkAvailable()
      return { status: 200, jsonBody: { enabled: true } }
    } catch (error) {
      const configured = error instanceof FoundryAllowanceConfigurationError
      if (!configured && !(error instanceof FoundryAllowanceUnavailableError)) {
        _context.error('Judge allowance configuration failed.')
      }
      return {
        status: 503,
        jsonBody: {
          error: configured
            ? 'Judge AI is not configured on this server. Use local rules instead.'
            : 'Judge AI request allowance is unavailable. No model request was made. Use local rules or try again later.',
          errorCode: configured
            ? 'foundry_not_configured'
            : 'foundry_allowance_unavailable',
        },
      }
    }
  }
}
