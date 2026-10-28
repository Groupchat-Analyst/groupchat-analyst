import { appendFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { TableClient } from '@azure/data-tables'
import { AzureTableFoundryAllowance } from '../dist/api/src/foundryAllowance.js'

const {
  FOUNDRY_ALLOWANCE_STORAGE_CONNECTION_STRING: connectionString,
  FOUNDRY_ALLOWANCE_TABLE_NAME: tableName,
  FOUNDRY_ALLOWANCE_MAX_REQUESTS: maxRequests,
  FOUNDRY_ALLOWANCE_MAX_PER_CLIENT: maxPerClient,
  FOUNDRY_ALLOWANCE_WINDOW_HOURS: windowHours,
  ALLOWANCE_WORKER_ID: workerId,
  ALLOWANCE_BARRIER_DIRECTORY: barrierDirectory,
  ALLOWANCE_CLIENT_ID: clientId,
  ALLOWANCE_NOW: now,
  ALLOWANCE_ATTEMPTS: attemptCount,
} = process.env

let conflictCount = 0
let synchronized = false
let reserved = 0
let exhausted = 0
const options = {
  allowInsecureConnection: true,
  ...(barrierDirectory
    ? {
      additionalPolicies: [{
        position: 'perCall',
        policy: {
          name: 'synchronize-concurrent-entity-reads',
          async sendRequest(request, next) {
            let response
            try {
              response = await next(request)
            } catch (error) {
              if (Number(error?.statusCode) === 412) {
                conflictCount += 1
                appendFileSync(
                  join(barrierDirectory, 'etag-conflicts'),
                  `${workerId}\n`,
                )
              }
              throw error
            }
            if (
              !synchronized &&
              request.method === 'GET'
            ) {
              synchronized = true
              writeFileSync(join(barrierDirectory, `ready-${workerId}`), 'ready')
              const otherWorker = workerId === 'first' ? 'second' : 'first'
              const deadline = Date.now() + 15_000
              while (
                !existsSync(join(barrierDirectory, `ready-${otherWorker}`)) &&
                Date.now() < deadline
              ) {
                await delay(5)
              }
              if (!existsSync(join(barrierDirectory, `ready-${otherWorker}`))) {
                throw new Error('Concurrent-read test barrier timed out.')
              }
            }
            if (Number(response.status ?? response.statusCode) === 412) {
              conflictCount += 1
              appendFileSync(
                join(barrierDirectory, 'etag-conflicts'),
                `${workerId}\n`,
              )
            }
            return response
          },
        },
      }],
    }
    : {}),
}

const table = TableClient.fromConnectionString(
  connectionString,
  tableName,
  options,
)
const allowance = new AzureTableFoundryAllowance(table, {
  tableName,
  maxRequests: Number(maxRequests),
  maxPerClient: Number(maxPerClient),
  windowHours: Number(windowHours),
})

for (let attempt = 0; attempt < Number(attemptCount); attempt += 1) {
  try {
    await allowance.reserve(clientId, Number(now))
    reserved += 1
  } catch (error) {
    if (error?.name === 'FoundryAllowanceExceededError') {
      exhausted += 1
      continue
    }
    throw error
  }
}

process.stdout.write(JSON.stringify({
  reserved,
  exhausted,
  conflictCount,
  synchronized,
}))
