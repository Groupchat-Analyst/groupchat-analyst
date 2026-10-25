import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const apiRoot = fileURLToPath(new URL('../', import.meta.url))

test('built Functions package contains host, entry point, shared modules, and production dependencies', async () => {
  const packageJson = JSON.parse(
    await readFile(join(apiRoot, 'package.json'), 'utf8'),
  )
  const packageLock = JSON.parse(
    await readFile(join(apiRoot, 'package-lock.json'), 'utf8'),
  )
  const entryPoint = join(apiRoot, packageJson.main)
  const hostConfig = join(apiRoot, 'host.json')
  const sharedOutput = join(apiRoot, 'dist', 'shared', 'src')
  const compiledService = await readFile(
    join(apiRoot, 'dist', 'api', 'src', 'service.js'),
    'utf8',
  )
  const requireFromApi = createRequire(join(apiRoot, 'package.json'))

  assert.equal(packageJson.main, 'dist/api/src/index.js')
  await Promise.all([
    access(entryPoint),
    access(hostConfig),
    access(join(sharedOutput, 'apiContracts.js')),
    access(join(sharedOutput, 'evidence.js')),
    access(join(sharedOutput, 'match.js')),
    access(join(sharedOutput, 'matchClock.js')),
    access(join(sharedOutput, 'interpretClaim.js')),
  ])
  assert.match(compiledService, /from ['"]\.\.\/\.\.\/shared\/src\//)

  assert.ok(packageJson.dependencies['@azure/functions'])
  assert.equal(
    packageLock.packages[''].dependencies['@azure/functions'],
    packageJson.dependencies['@azure/functions'],
  )
  assert.ok(packageLock.packages['node_modules/@azure/functions'])
  assert.ok(packageLock.packages['node_modules/cookie'])
  assert.ok(
    packageLock.packages['node_modules/@azure/functions-extensions-base'],
  )
  assert.match(requireFromApi.resolve('@azure/functions'), /node_modules/)
  assert.equal(dirname(entryPoint), join(apiRoot, 'dist', 'api', 'src'))
})
