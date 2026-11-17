import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  createAzureTableFoundryAllowance,
  foundryClientIdentity,
} from '../foundryAllowance.js'

export function createAllowanceStatusHandler(
  environment: NodeJS.ProcessEnv,
  createAllowance = createAzureTableFoundryAllowance,
) {
  return async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    if (environment.FOUNDRY_SAFE_DIAGNOSTICS_ENABLED?.trim().toLowerCase() !== 'true') {
      return { status: 404 }
    }
    try {
      const remaining = await createAllowance(environment).remaining(
        foundryClientIdentity(request.headers.get('x-forwarded-for')),
      )
      return { status: 200, headers: { 'cache-control': 'no-store' }, jsonBody: { remaining } }
    } catch {
      context.error('Public AI allowance status is unavailable.')
      return {
        status: 503,
        headers: { 'cache-control': 'no-store' },
        jsonBody: { error: 'The AI request allowance could not be checked.' },
      }
    }
  }
}
