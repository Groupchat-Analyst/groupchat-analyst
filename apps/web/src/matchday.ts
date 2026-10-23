import type {
  AnalysisPeriod,
  MatchClock,
} from '../../shared/src/matchClock'
import type {
  AnalysisRequest,
  MatchReplayResponse,
} from '../../shared/src/apiContracts'

export type SubmissionContext = {
  opinion: string
  selectedClock: MatchClock
  period: AnalysisPeriod
}

export function createSubmissionContext(
  opinion: string,
  selectedClock: MatchClock,
  period: AnalysisPeriod,
): SubmissionContext {
  return {
    opinion,
    selectedClock: { ...selectedClock },
    period,
  }
}

export function createAnalysisRequest(context: SubmissionContext): AnalysisRequest {
  return {
    opinion: context.opinion,
    selectedClock: { ...context.selectedClock },
    period: context.period,
  }
}

export function isSubmissionScopeCurrent(
  submitted: SubmissionContext,
  selectedClock: MatchClock,
  period: AnalysisPeriod,
): boolean {
  return (
    submitted.period === period &&
    submitted.selectedClock.period === selectedClock.period &&
    submitted.selectedClock.minute === selectedClock.minute &&
    (submitted.selectedClock.stoppageMinutes ?? 0) ===
      (selectedClock.stoppageMinutes ?? 0)
  )
}

export function isLatestRequest(requestId: number, latestRequestId: number): boolean {
  return requestId === latestRequestId
}

export function replayEventsAtOrBefore(
  frame: MatchReplayResponse,
  selectedTime: string,
): MatchReplayResponse['events'] {
  if (frame.selectedTime !== selectedTime) return []
  return frame.events
}
