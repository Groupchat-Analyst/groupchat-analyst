import type { AppLanguage } from './localization.ts'
import { formatNumber } from './factualPresentation.ts'

/**
 * Typed request-failure descriptor and five-language formatter. The server's English `message`
 * is never translated; only the code (and timeout seconds) selects the localized text.
 */
export type RequestErrorFact =
  | { code: 'timeout'; seconds: number }
  | { code: 'unreachable' }
  | { code: 'incomplete' }
  | { code: 'different-match' }
  | { code: 'foundry_not_configured' }
  | { code: 'foundry_allowance_unavailable' }
  | { code: 'foundry_allowance_exhausted' }
  | { code: 'foundry_client_allowance_exhausted' }
  | { code: 'foundry_interpretation_failed' }
  | { code: 'unknown' }

type Entry = Record<AppLanguage, string>

const MESSAGES: Record<Exclude<RequestErrorFact['code'], 'timeout'>, Entry> = {
  unreachable: {
    en: 'The analysis service could not be reached. You can try again or use local rules.',
    es: 'No se pudo conectar con el servicio de análisis. Puedes intentarlo de nuevo o usar las reglas locales.',
    fr: 'Le service d’analyse est injoignable. Vous pouvez réessayer ou utiliser les règles locales.',
    de: 'Der Analysedienst war nicht erreichbar. Du kannst es erneut versuchen oder lokale Regeln verwenden.',
    ar: 'تعذّر الوصول إلى خدمة التحليل. يمكنك المحاولة مرة أخرى أو استخدام القواعد المحلية.',
  },
  incomplete: {
    en: 'The analysis service returned an incomplete answer.',
    es: 'El servicio de análisis devolvió una respuesta incompleta.',
    fr: 'Le service d’analyse a renvoyé une réponse incomplète.',
    de: 'Der Analysedienst hat eine unvollständige Antwort geliefert.',
    ar: 'أعادت خدمة التحليل إجابة غير مكتملة.',
  },
  'different-match': {
    en: 'The analysis service answered for a different match, so the reply was not shown.',
    es: 'El servicio de análisis respondió para otro partido, así que no se mostró la respuesta.',
    fr: 'Le service d’analyse a répondu pour un autre match, la réponse n’a donc pas été affichée.',
    de: 'Der Analysedienst hat für ein anderes Spiel geantwortet, daher wurde die Antwort nicht angezeigt.',
    ar: 'أجابت خدمة التحليل عن مباراة مختلفة، لذلك لم تُعرض الإجابة.',
  },
  foundry_not_configured: {
    en: 'AI interpretation is unavailable. Use local rules instead.',
    es: 'La interpretación con IA no está disponible. Usa las reglas locales.',
    fr: 'L’interprétation par IA n’est pas disponible. Utilisez les règles locales.',
    de: 'Die KI-Interpretation ist nicht verfügbar. Verwende stattdessen lokale Regeln.',
    ar: 'تفسير الذكاء الاصطناعي غير متاح. استخدم القواعد المحلية بدلًا من ذلك.',
  },
  foundry_allowance_unavailable: {
    en: 'The AI request allowance could not be checked. No model request was made. Use local rules instead or try again later.',
    es: 'No se pudo comprobar la cuota de solicitudes de IA. No se hizo ninguna solicitud al modelo. Usa las reglas locales o inténtalo más tarde.',
    fr: 'Le quota de requêtes IA n’a pas pu être vérifié. Aucune requête n’a été envoyée au modèle. Utilisez les règles locales ou réessayez plus tard.',
    de: 'Das KI-Anfragekontingent konnte nicht geprüft werden. Es wurde keine Modellanfrage gesendet. Verwende lokale Regeln oder versuche es später erneut.',
    ar: 'تعذّر التحقق من حصة طلبات الذكاء الاصطناعي. لم يُرسل أي طلب إلى النموذج. استخدم القواعد المحلية أو حاول لاحقًا.',
  },
  foundry_allowance_exhausted: {
    en: 'The shared AI request allowance is exhausted. Use local rules instead.',
    es: 'La cuota compartida de solicitudes de IA se ha agotado. Usa las reglas locales.',
    fr: 'Le quota partagé de requêtes IA est épuisé. Utilisez les règles locales.',
    de: 'Das gemeinsame KI-Anfragekontingent ist aufgebraucht. Verwende stattdessen lokale Regeln.',
    ar: 'نفدت الحصة المشتركة لطلبات الذكاء الاصطناعي. استخدم القواعد المحلية بدلًا من ذلك.',
  },
  foundry_client_allowance_exhausted: {
    en: 'The AI request allowance for this network is exhausted. Use local rules instead or try again later.',
    es: 'La cuota de solicitudes de IA de esta red se ha agotado. Usa las reglas locales o inténtalo más tarde.',
    fr: 'Le quota de requêtes IA de ce réseau est épuisé. Utilisez les règles locales ou réessayez plus tard.',
    de: 'Das KI-Anfragekontingent für dieses Netzwerk ist aufgebraucht. Verwende lokale Regeln oder versuche es später erneut.',
    ar: 'نفدت حصة طلبات الذكاء الاصطناعي لهذه الشبكة. استخدم القواعد المحلية أو حاول لاحقًا.',
  },
  foundry_interpretation_failed: {
    en: 'AI interpretation failed. This attempt used one allowance. Try again or use local rules instead.',
    es: 'La interpretación con IA falló. Este intento consumió una solicitud de la cuota. Inténtalo de nuevo o usa las reglas locales.',
    fr: 'L’interprétation par IA a échoué. Cette tentative a consommé une requête du quota. Réessayez ou utilisez les règles locales.',
    de: 'Die KI-Interpretation ist fehlgeschlagen. Dieser Versuch hat eine Anfrage des Kontingents verbraucht. Versuche es erneut oder verwende lokale Regeln.',
    ar: 'فشل تفسير الذكاء الاصطناعي. استهلكت هذه المحاولة طلبًا واحدًا من الحصة. حاول مرة أخرى أو استخدم القواعد المحلية.',
  },
  unknown: {
    en: 'The check could not be completed. You can try again or use local rules.',
    es: 'No se pudo completar la comprobación. Puedes intentarlo de nuevo o usar las reglas locales.',
    fr: 'La vérification n’a pas pu aboutir. Vous pouvez réessayer ou utiliser les règles locales.',
    de: 'Die Prüfung konnte nicht abgeschlossen werden. Du kannst es erneut versuchen oder lokale Regeln verwenden.',
    ar: 'تعذّر إكمال الفحص. يمكنك المحاولة مرة أخرى أو استخدام القواعد المحلية.',
  },
}

const TIMEOUT: Record<AppLanguage, (seconds: string) => string> = {
  en: (s) => `The check timed out after ${s} seconds. The request may still be processing, and your earlier answer is still here. Try again when ready, or use local rules.`,
  es: (s) => `La comprobación agotó el tiempo tras ${s} segundos. Puede que la solicitud siga en proceso y tu respuesta anterior sigue aquí. Inténtalo de nuevo cuando quieras o usa las reglas locales.`,
  fr: (s) => `La vérification a expiré après ${s} secondes. La requête est peut-être encore en cours et votre réponse précédente reste affichée. Réessayez quand vous voulez, ou utilisez les règles locales.`,
  de: (s) => `Die Prüfung ist nach ${s} Sekunden abgelaufen. Die Anfrage wird eventuell noch verarbeitet, und deine frühere Antwort bleibt erhalten. Versuche es erneut oder verwende lokale Regeln.`,
  ar: (s) => `انتهت مهلة الفحص بعد ${s} ثانية. قد يكون الطلب لا يزال قيد المعالجة، وإجابتك السابقة لا تزال هنا. حاول مرة أخرى عندما تكون جاهزًا أو استخدم القواعد المحلية.`,
}

export function renderRequestError(fact: RequestErrorFact, language: AppLanguage): string {
  if (fact.code === 'timeout') return TIMEOUT[language](formatNumber(fact.seconds, language))
  const entry = MESSAGES[fact.code] ?? MESSAGES.unknown
  return entry[language]
}

const KNOWN_CODES = new Set(Object.keys(MESSAGES))

/** Builds the descriptor from structured error facts only (server code, error class), never from message text. */
export function requestErrorFact(source: {
  code?: string
  timeoutSeconds?: number
  kind: 'server' | 'timeout' | 'network' | 'incomplete' | 'different-match' | 'other'
}): RequestErrorFact {
  if (source.kind === 'different-match') return { code: 'different-match' }
  if (source.kind === 'timeout') return { code: 'timeout', seconds: source.timeoutSeconds ?? 45 }
  if (source.kind === 'network') return { code: 'unreachable' }
  if (source.kind === 'incomplete') return { code: 'incomplete' }
  if (source.code === 'analysis_timeout') return { code: 'timeout', seconds: source.timeoutSeconds ?? 45 }
  if (source.code && KNOWN_CODES.has(source.code)) return { code: source.code } as RequestErrorFact
  return { code: 'unknown' }
}
