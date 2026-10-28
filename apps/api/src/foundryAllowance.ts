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
  'getEntity' | 'createEntity' | 'updateEntity' | 'listEntities'
>

export type FoundryAllowanceSettings = {
  tableName: string
  maxRequests: number
  maxPerClient: number
  windowHours: number
}

export class FoundryAllowanceConfigurationError extends Error {
  constructor() {
    super('AI allowance storage and positive request limits are required.')
    this.name = 'FoundryAllowanceConfigurationError'
  }
}

export class FoundryAllowanceUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      'The AI request allowance could not be checked. No model request was made. Use local rules instead or try again later.',
      { cause },
    )
    this.name = 'FoundryAllowanceUnavailableError'
  }
}

export class FoundryAllowanceExceededError extends Error {
  readonly scope: 'total' | 'client'

  constructor(scope: 'total' | 'client') {
    super(
      scope === 'total'
        ? 'The shared AI request allowance is exhausted. Use local rules instead.'
        : 'The AI request allowance for this network is exhausted. Use local rules instead or try again later.',
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
    'FoundryJudging'
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
  const directCode =
    'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined
  const details =
    'details' in error &&
    typeof error.details === 'object' &&
    error.details !== null
      ? error.details
      : undefined
  const detailCode =
    details && 'errorCode' in details && typeof details.errorCode === 'string'
      ? details.errorCode
      : details &&
          'odataError' in details &&
          typeof details.odataError === 'object' &&
          details.odataError !== null &&
          'code' in details.odataError &&
          typeof details.odataError.code === 'string'
        ? details.odataError.code
        : undefined
  const code = directCode ?? detailCode
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
  } catch (error) {
    throw new FoundryAllowanceUnavailableError(error)
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
      const entities = this.table.listEntities<AllowanceEntity>({
        queryOptions: {
          filter: `PartitionKey eq '${PARTITION_KEY}' and RowKey eq '${ROW_KEY}'`,
        },
      })
      for await (const entity of entities) {
        validateAllowanceEntity(entity)
        break
      }
    } catch (error) {
      throw new FoundryAllowanceUnavailableError(error)
    }
  }

  async reserve(clientIdentity: string, now = Date.now()): Promise<void> {
    const windowMs = this.settings.windowHours * 60 * 60 * 1000
    const windowStart = Math.floor(now / windowMs) * windowMs
    for (let attempt = 0; attempt < MAX_ETAG_ATTEMPTS; attempt += 1) {
      let existing: AllowanceEntity | null
      try {
        existing = await this.read()
      } catch (error) {
        throw new FoundryAllowanceUnavailableError(error)
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
        throw new FoundryAllowanceUnavailableError(error)
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
  clientOptions?: Parameters<typeof TableClient.fromConnectionString>[2],
): AzureTableFoundryAllowance {
  const connectionString =
    environment.FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING?.trim()
  if (!connectionString) throw new FoundryAllowanceConfigurationError()
  const settings = foundryAllowanceSettings(environment)
  return new AzureTableFoundryAllowance(
    TableClient.fromConnectionString(
      connectionString,
      settings.tableName,
      clientOptions,
    ),
    settings,
  )
}
