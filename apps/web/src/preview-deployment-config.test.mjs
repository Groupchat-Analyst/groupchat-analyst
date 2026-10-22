import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const configUrl = new URL('../public/staticwebapp.config.json', import.meta.url)
const appUrl = new URL('./App.tsx', import.meta.url)

test('shared preview requires its invited role for the site and API', async () => {
  const config = JSON.parse(await readFile(configUrl, 'utf8'))

  assert.deepEqual(config.routes, [
    { route: '/api/*', allowedRoles: ['preview-user'] },
    { route: '/*', allowedRoles: ['preview-user'] },
  ])
  assert.equal(
    config.responseOverrides['401'].redirect,
    '/.auth/login/aad?post_login_redirect_uri=.referrer',
  )
})

test('shared preview API runtime matches the project Node baseline', async () => {
  const config = JSON.parse(await readFile(configUrl, 'utf8'))

  assert.equal(config.platform.apiRuntime, 'node:22')
})

test('the browser uses the same-origin API route, not localhost', async () => {
  const app = await readFile(appUrl, 'utf8')

  assert.match(app, /fetch\('\/api\/analyze'/)
  assert.doesNotMatch(app, /localhost|127\.0\.0\.1/)
})
