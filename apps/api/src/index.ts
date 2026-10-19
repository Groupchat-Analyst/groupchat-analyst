import { app } from '@azure/functions'
import { createAnalyzeHandler } from './functions/analyze.js'
import { createInterpretationProvider } from './providers/index.js'

const provider = createInterpretationProvider(process.env)

app.http('analyze', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'analyze',
  handler: createAnalyzeHandler(provider),
})
