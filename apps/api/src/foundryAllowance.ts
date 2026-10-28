import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { TableClient } from '@azure/data-tables'

const PARTITION_KEY = 'foundry-judge'
const ROW_KEY = 'allowance'
const MAX_ETAG_ATTEMPTS = 12
const MAX_CLIENT_COUNTS_BYTES = 60_000

type AllowanceEntity = {
  partitionKey: string
  rowKey: string
  etag: string
  windowStart: number
  totalCount: number
  clientCounts: string
}

type AllowanceTable = Pick<
  TableClient,
  'getEntity' | 'createEntity' | 'updateEntity'
>

export type FoundryAllowanceSettings = {
  tableName: string
  maxRequests: number
  maxPerClient: number
  windowHours: number
}

export class FoundryAllowanceConfigurationError extends Error {
  constructor() {
    super('Judge AI allowance storage and positive request limits are required.')
    this.name = 'FoundryAllowanceConfigurationError'
  }
}

export class FoundryAllowanceUnavailableError extends Error {
  constructor() {
    super(
      'Judge AI request allowance is unavailable. No model request was made. Use local rules or try again later.',
    )
    this.name = 'FoundryAllowanceUnavailableError'
  }
}

export class FoundryAllowanceExceededError extends Error {
  readonly scope: 'total' | 'client'

  constructor(scope: 'total' | 'client') {
    super(
      scope === 'total'
        ? 'The shared judge AI request allowance is exhausted. Use local rules or contact the judge.'
        : 'Your judge AI request allowance is exhausted. Use local rules or try again later.',
    )
    this.name = 'FoundryAllowanceExceededError'
    this.scope = scope
  }
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value || !/^[1-9]\d*$/u.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

export function foundryAllowanceSettings(
  environment: NodeJS.ProcessEnv,
): FoundryAllowanceSettings {
  const tableName =
    environment.FOUNDRY_ALLOWANCE_TABLE_NAME?.trim() ??
    'FoundryRequestAllowance'
  const maxRequests = positiveInteger(
    environment.FOUNDRY_ALLOWANCE_MAX_REQUESTS,
  )
  const maxPerClient = positiveInteger(
    environment.FOUNDRY_ALLOWANCE_MAX_PER_CLIENT,
  )
  const windowHours = positiveInteger(
    environment.FOUNDRY_ALLOWANCE_WINDOW_HOURS,
  )
  if (
    !/^[A-Za-z][A-Za-z0-9]{2,62}$/u.test(tableName) ||
    !maxRequests ||
    !maxPerClient ||
    !windowHours ||
    maxPerClient > maxRequests ||
    windowHours > 8760
  ) {
    throw new FoundryAllowanceConfigurationError()
  }
  return { tableName, maxRequests, maxPerClient, windowHours }
}

export function foundryClientIdentity(
  forwardedFor: string | null | undefined,
): string {
  const address = forwardedFor?.split(',')[0]?.trim()
  const normalized = address && isIP(address) !== 0 ? address : 'unknown'
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

function storageStatus(error: unknown): { status?: number; code?: string } {
  if (typeof error !== 'object' || error === null) return {}
  const status =
    'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : undefined
  const code =
    'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined
  return { status, code }
}

function isMissingEntity(error: unknown): boolean {
  const { status, code } = storageStatus(error)
  return status === 404 && code === 'ResourceNotFound'
}

function isConditionalConflict(error: unknown): boolean {
  const { status, code } = storageStatus(error)
  return status === 409 || status === 412 ||
    code === 'EntityAlreadyExists' ||
    code === 'UpdateConditionNotSatisfied'
}

function parseClientCounts(value: string): Record<string, number> {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new FoundryAllowanceUnavailableError()
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.values(parsed).some(
      (count) => typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0,
    )
  ) {
    throw new FoundryAllowanceUnavailableError()
  }
  return parsed as Record<string, number>
}

function validateAllowanceEntity(
  entity: AllowanceEntity,
): AllowanceEntity {
  if (
    typeof entity.etag !== 'string' ||
    !Number.isSafeInteger(entity.windowStart) ||
    entity.windowStart < 0 ||
    !Number.isSafeInteger(entity.totalCount) ||
    entity.totalCount < 0 ||
    typeof entity.clientCounts !== 'string'
  ) {
    throw new FoundryAllowanceUnavailableError()
  }
  parseClientCounts(entity.clientCounts)
  return entity
}

export class AzureTableFoundryAllowance {
  private readonly table: AllowanceTable
  private readonly settings: FoundryAllowanceSettings

  constructor(
    table: AllowanceTable,
    settings: FoundryAllowanceSettings,
  ) {
    this.table = table
    this.settings = settings
  }

  async checkAvailable(): Promise<void> {
    try {
      await this.read()
    } catch {
      throw new FoundryAllowanceUnavailableError()
    }
  }

  async reserve(clientIdentity: string, now = Date.now()): Promise<void> {
    const windowMs = this.settings.windowHours * 60 * 60 * 1000
    const windowStart = Math.floor(now / windowMs) * windowMs
    for (let attempt = 0; attempt < MAX_ETAG_ATTEMPTS; attempt += 1) {
      let existing: AllowanceEntity | null
      try {
        existing = await this.read()
      } catch {
        throw new FoundryAllowanceUnavailableError()
      }

      if (existing && existing.windowStart > windowStart) {
        throw new FoundryAllowanceUnavailableError()
      }

      const currentWindow = existing?.windowStart === windowStart
      const clientCounts = currentWindow
        ? parseClientCounts(existing?.clientCounts ?? '{}')
        : {}
      const totalCount = currentWindow ? existing?.totalCount ?? 0 : 0
      if (totalCount >= this.settings.maxRequests) {
        throw new FoundryAllowanceExceededError('total')
      }
      if ((clientCounts[clientIdentity] ?? 0) >= this.settings.maxPerClient) {
        throw new FoundryAllowanceExceededError('client')
      }

      clientCounts[clientIdentity] = (clientCounts[clientIdentity] ?? 0) + 1
      const serializedCounts = JSON.stringify(clientCounts)
      if (Buffer.byteLength(serializedCounts, 'utf8') > MAX_CLIENT_COUNTS_BYTES) {
        throw new FoundryAllowanceUnavailableError()
      }
      const next = {
        partitionKey: PARTITION_KEY,
        rowKey: ROW_KEY,
        windowStart,
        totalCount: totalCount + 1,
        clientCounts: serializedCounts,
      }

      try {
        if (existing) {
          await this.table.updateEntity(
            next,
            'Replace',
            { etag: existing.etag },
          )
        } else {
          await this.table.createEntity(next)
        }
        return
      } catch (error) {
        if (isConditionalConflict(error)) continue
        throw new FoundryAllowanceUnavailableError()
      }
    }
    throw new FoundryAllowanceUnavailableError()
  }

  private async read(): Promise<AllowanceEntity | null> {
    try {
      const entity = await this.table.getEntity<AllowanceEntity>(
        PARTITION_KEY,
        ROW_KEY,
      )
      return validateAllowanceEntity(entity)
    } catch (error) {
      if (isMissingEntity(error)) return null
      throw error
    }
  }
}

export function createAzureTableFoundryAllowance(
  environment: NodeJS.ProcessEnv,
): AzureTableFoundryAllowance {
  const connectionString = environment.AzureWebJobsStorage?.trim()
  if (!connectionString) throw new FoundryAllowanceConfigurationError()
  const settings = foundryAllowanceSettings(environment)
  return new AzureTableFoundryAllowance(
    TableClient.fromConnectionString(connectionString, settings.tableName),
    settings,
  )
}
