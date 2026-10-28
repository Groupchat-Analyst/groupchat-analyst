import { app } from '@azure/functions'
import { createAnalyzeHandler } from './functions/analyze.js'
import { createReplayHandler } from './functions/replay.js'
import { createInterpretationProvider } from './providers/index.js'

const provider = createInterpretationProvider(process.env)

app.http('analyze', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'analyze',
  handler: createAnalyzeHandler(provider, process.env),
})

app.http('replay', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'replay',
  handler: createReplayHandler(),
})
