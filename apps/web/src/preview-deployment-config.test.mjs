import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const configUrl = new URL('../public/staticwebapp.config.json', import.meta.url)
const appUrl = new URL('./App.tsx', import.meta.url)
const packageUrl = new URL('../package.json', import.meta.url)
const vitePackageUrl = new URL('../node_modules/vite/package.json', import.meta.url)
const workflowUrl = new URL('../../../.github/workflows/shared-preview.yml', import.meta.url)

test('hackathon candidate is publicly readable without sign-in, with API routes excluded from the SPA fallback', async () => {
  const config = JSON.parse(await readFile(configUrl, 'utf8'))

  assert.equal(config.routes, undefined)
  assert.equal(config.responseOverrides, undefined)
  assert.ok(config.navigationFallback.exclude.includes('/api/*'))
  assert.equal(config.globalHeaders['X-Frame-Options'], 'DENY')
  assert.doesNotMatch(JSON.stringify(config), /allowedRoles|preview-user|\.auth/)
})

test('shared preview API runtime matches the project Node baseline', async () => {
  const config = JSON.parse(await readFile(configUrl, 'utf8'))

  assert.equal(config.platform.apiRuntime, 'node:22')
})

test('frontend build Node selection independently satisfies Vite runtime requirements', async () => {
  const webPackage = JSON.parse(await readFile(packageUrl, 'utf8'))
  const vitePackage = JSON.parse(await readFile(vitePackageUrl, 'utf8'))
  const [major, minor] = process.versions.node.split('.').map(Number)

  assert.equal(webPackage.engines.node, '>=22.12.0')
  assert.match(vitePackage.engines.node, />=22\.12\.0/)
  assert.ok(
    major > 22 || (major === 22 && minor >= 12),
    `Installed Node ${process.versions.node} does not satisfy ${webPackage.engines.node}`,
  )
})

test('the browser uses the same-origin API route, not localhost', async () => {
  const app = await readFile(appUrl, 'utf8')
  const client = await readFile(new URL('./analysisClient.ts', import.meta.url), 'utf8')

  assert.match(client, /fetchImpl\('\/api\/analyze'/)
  assert.match(app, /requestAnalysis\(/)
  assert.doesNotMatch(app + client, /localhost|127\.0\.0\.1/)
})

test('deployment is manual, uses the repository secret, and has no environment gate', async () => {
  const workflow = await readFile(workflowUrl, 'utf8')

  assert.match(workflow, /^on:\r?\n  workflow_dispatch:\r?$/m)
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/)
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/)
  assert.match(workflow, /secrets\.AZURE_STATIC_WEB_APPS_API_TOKEN/)
  assert.doesNotMatch(workflow, /^\s+environment:/m)
  assert.doesNotMatch(workflow, /^\s+(push|pull_request):/m)
})

test('the workflow carries no Foundry credentials or provider override', async () => {
  const workflow = await readFile(workflowUrl, 'utf8')

  assert.doesNotMatch(workflow, /FOUNDRY|CLAIM_INTERPRETER_PROVIDER|OPENAI/i)
  assert.equal([...workflow.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]).join(), 'AZURE_STATIC_WEB_APPS_API_TOKEN')
})

test('public Foundry access is server-gated and the judge-code route is absent', async () => {
  const index = await readFile(new URL('../../api/src/index.ts', import.meta.url), 'utf8')
  const analysis = await readFile(new URL('../../api/src/functions/analyze.ts', import.meta.url), 'utf8')
  const providers = await readFile(new URL('../../api/src/providers/index.ts', import.meta.url), 'utf8')
  const app = await readFile(new URL('./App.tsx', import.meta.url), 'utf8')

  assert.equal([...index.matchAll(/authLevel: 'anonymous'/g)].length, 2)
  assert.doesNotMatch(index, /foundry-access/)
  assert.match(providers, /CLAIM_INTERPRETER_PROVIDER\?\.trim\(\) \|\| 'local'/)
  assert.doesNotMatch(providers, /createFoundryProvider/)
  assert.match(analysis, /FOUNDRY_PUBLIC_ENABLED/)
  assert.match(analysis, /createAllowance\(environment\)\.reserve/)
  assert.doesNotMatch(analysis, /x-foundry-judge-code|FOUNDRY_JUDGE_ACCESS_CODE/)
  assert.doesNotMatch(app, /foundry-access-code|judge-access/)
  assert.match(app, /AI is used by default when enabled on the server/)
  assert.match(app, /Use local rules instead/)
})
