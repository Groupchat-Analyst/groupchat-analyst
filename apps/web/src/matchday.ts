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
  datasetId?: string
  inputLanguage: 'en' | 'es' | 'fr' | 'de' | 'ar'
}

export function createSubmissionContext(
  opinion: string,
  selectedClock: MatchClock,
  period: AnalysisPeriod,
  datasetId?: string,
  inputLanguage: SubmissionContext['inputLanguage'] = 'en',
): SubmissionContext {
  return {
    opinion,
    selectedClock: { ...selectedClock },
    period,
    ...(datasetId ? { datasetId } : {}),
    inputLanguage,
  }
}

export function createAnalysisRequest(context: SubmissionContext): AnalysisRequest {
  return {
    opinion: context.opinion,
    selectedClock: { ...context.selectedClock },
    period: context.period,
    ...(context.datasetId ? { datasetId: context.datasetId } : {}),
    inputLanguage: context.inputLanguage,
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
