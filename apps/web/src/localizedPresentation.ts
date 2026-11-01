import type { AnalysisResponse, ClaimResult } from '../../shared/src/apiContracts.ts'
import type { EntityRef } from '../../shared/src/claimPresentation.ts'
import {
  renderClaimPresentation,
  renderLegacyCompatibility,
  renderLegacySourceLabel,
  type PresentationContext,
  type RenderedClaimPresentation,
} from '../../shared/src/claimPresentationLocale.ts'
import type { ChangeContext, ChangeEntity } from '../../shared/src/changeLocale.ts'
import { localizeMatchText, localizedPlayerName } from '../../shared/src/displayNames.ts'
import type { AppLanguage } from '../../shared/src/localization.ts'

/** Callers localise names; the renderers never translate them. */
export function presentationContext(datasetId: string, language: AppLanguage): PresentationContext & ChangeContext {
  const nameOf = (entity: EntityRef | ChangeEntity): string =>
    entity.kind === 'team'
      ? localizeMatchText(entity.team, datasetId, language)
      : localizedPlayerName(datasetId, entity.id, entity.name, language)
  return { nameOf }
}

/** The localized answer, verdict, limitations, scope and note for a claim with a renderable descriptor, else null. */
export function renderResultPresentation(
  result: ClaimResult,
  datasetId: string,
  language: AppLanguage,
): RenderedClaimPresentation | null {
  if (!result.presentation) return null
  return renderClaimPresentation(result.presentation, presentationContext(datasetId, language), language)
}

export type ClaimView =
  | { kind: 'pending' }
  | ({ kind: 'presentation' } & RenderedClaimPresentation)
  | { kind: 'structured'; answer?: string; limitations: string[] }
  | { kind: 'legacy' }

export type StructuredFormatter = (
  result: ClaimResult,
) => { answer: string; limitation: string } | undefined

/**
 * One view per claim. A claim without `presentation` that no structured formatter covers is a saved
 * legacy answer: it is never interpreted from its English text.
 */
export function claimViews(
  analysis: Pick<AnalysisResponse, 'claims'>,
  isPending: (result: ClaimResult) => boolean,
  structured: StructuredFormatter,
  datasetId: string,
  language: AppLanguage,
): ClaimView[] {
  return analysis.claims.map((result): ClaimView => {
    if (isPending(result)) return { kind: 'pending' }
    const rendered = renderResultPresentation(result, datasetId, language)
    if (rendered) return { kind: 'presentation', ...rendered }
    const existing = structured(result)
    if (existing) return { kind: 'structured', answer: existing.answer, limitations: existing.limitation ? [existing.limitation] : [] }
    if (result.presentation) return { kind: 'structured', limitations: [] }
    return { kind: 'legacy' }
  })
}

export type AnswerText = {
  /** Localized reply text. For legacy answers: the compatibility state, then the labelled English source. */
  text: string
  legacy: boolean
  /** Untouched English source of a legacy answer, to be shown as source only. */
  legacySource?: string
  legacyNotice?: string
  legacySourceLabel?: string
}

export function answerText(
  views: ClaimView[],
  legacySource: string | undefined,
  language: AppLanguage,
): AnswerText {
  const legacy = views.some(({ kind }) => kind === 'legacy')
  if (legacy) {
    const notice = renderLegacyCompatibility(language)
    const label = renderLegacySourceLabel(language)
    return {
      text: legacySource ? `${notice}\n${label}: ${legacySource}` : notice,
      legacy: true,
      legacyNotice: notice,
      legacySourceLabel: label,
      ...(legacySource ? { legacySource } : {}),
    }
  }
  const answers = views.flatMap((view) =>
    (view.kind === 'presentation' || view.kind === 'structured') && view.answer ? [view.answer] : [])
  return { text: answers.join(' '), legacy: false }
}
