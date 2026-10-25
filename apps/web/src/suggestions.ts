import { elapsedMatchMinute, type MatchClock } from '../../shared/src/matchClock.ts'

export type QuestionSuggestion = { id: string; text: string }

// Elapsed minute of the only recorded first-half goal (45+3′).
const FIRST_HALF_GOAL_ELAPSED_MINUTE = 48

/**
 * Football questions the bundled interpreter can answer for the selected moment.
 * Every phrasing here is also valid for a broader interpreter, so one list serves
 * both. Questions about events that have not happened yet are not offered.
 */
export function getQuestionSuggestions(clock: MatchClock): QuestionSuggestion[] {
  const suggestions: QuestionSuggestion[] = [
    { id: 'eastport-shots', text: 'How many shots did Eastport have?' },
    { id: 'shots-comparison', text: 'Eastport had more shots than Northbridge.' },
    { id: 'possession', text: 'Did Northbridge have more possession?' },
  ]
  if (elapsedMatchMinute(clock) >= FIRST_HALF_GOAL_ELAPSED_MINUTE) {
    suggestions.push({
      id: 'first-half-goal',
      text: 'Northbridge scored before half-time.',
    })
  }
  return suggestions
}
