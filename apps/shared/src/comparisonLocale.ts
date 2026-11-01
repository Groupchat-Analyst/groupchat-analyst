import type { AppLanguage } from './localization.ts'

/**
 * Application-owned comparison and fallback guidance. English templates are both what the
 * application generates and the lookup key, so generation and translation cannot drift apart.
 */
export const COMPARISON_MESSAGES = {
  separately: 'Here are the two answers separately: the {earlier} check and the {later} check.',
  notComparable: "I can't line these two checks up like for like.",
  notAssessed: 'At least one check could not be assessed, so there is nothing to compare.',
  differentPeriods: 'The checks used different evidence periods.',
  differentInterpretation: 'The two checks interpret this opinion differently, so they cannot be compared directly.',
  differentClaims: 'The interpreted claims differ, so no like-for-like change is reported.',
  differentData: "These two checks used different match data, so I'm not lining them up.",
  unmatchedReply:
    "I couldn't match that to something I can check in this match, and I haven't picked out unrelated figures instead. Try naming a team or player and what you want to know.",
  unreliableInterpreter:
    'The local interpreter cannot reliably identify the requested football evidence. No unrelated statistics or events were selected.',
} as const

export const comparisonTranslations: Record<Exclude<AppLanguage, 'en'>, Record<string, string>> = {
  es: {
    [COMPARISON_MESSAGES.separately]: 'Aquí tienes las dos respuestas por separado: la comprobación de {earlier} y la de {later}.',
    [COMPARISON_MESSAGES.notComparable]: 'No puedo poner estas dos comprobaciones en igualdad de condiciones.',
    [COMPARISON_MESSAGES.notAssessed]: 'Al menos una comprobación no pudo evaluarse, así que no hay nada que comparar.',
    [COMPARISON_MESSAGES.differentPeriods]: 'Las comprobaciones usaron periodos de evidencia distintos.',
    [COMPARISON_MESSAGES.differentInterpretation]: 'Las dos comprobaciones interpretan esta opinión de forma distinta, así que no pueden compararse directamente.',
    [COMPARISON_MESSAGES.differentClaims]: 'Las afirmaciones interpretadas difieren, así que no se informa de ningún cambio comparable.',
    [COMPARISON_MESSAGES.differentData]: 'Estas dos comprobaciones usaron datos de partido distintos, así que no las comparo.',
    [COMPARISON_MESSAGES.unmatchedReply]: 'No pude relacionar eso con nada que pueda comprobar en este partido, y no he elegido cifras sin relación. Prueba a nombrar un equipo o jugador y qué quieres saber.',
    [COMPARISON_MESSAGES.unreliableInterpreter]: 'El intérprete local no puede identificar con fiabilidad la evidencia de fútbol solicitada. No se seleccionaron estadísticas ni eventos sin relación.',
  },
  fr: {
    [COMPARISON_MESSAGES.separately]: 'Voici les deux réponses séparément : la vérification de {earlier} et celle de {later}.',
    [COMPARISON_MESSAGES.notComparable]: 'Je ne peux pas mettre ces deux vérifications sur un pied d’égalité.',
    [COMPARISON_MESSAGES.notAssessed]: 'Au moins une vérification n’a pas pu être évaluée, il n’y a donc rien à comparer.',
    [COMPARISON_MESSAGES.differentPeriods]: 'Les vérifications ont utilisé des périodes de preuves différentes.',
    [COMPARISON_MESSAGES.differentInterpretation]: 'Les deux vérifications interprètent cet avis différemment ; elles ne peuvent donc pas être comparées directement.',
    [COMPARISON_MESSAGES.differentClaims]: 'Les affirmations interprétées diffèrent ; aucun changement comparable n’est donc indiqué.',
    [COMPARISON_MESSAGES.differentData]: 'Ces deux vérifications ont utilisé des données de match différentes ; je ne les compare donc pas.',
    [COMPARISON_MESSAGES.unmatchedReply]: 'Je n’ai pas pu relier cela à quelque chose que je peux vérifier dans ce match, et je n’ai pas choisi de chiffres sans rapport. Essayez de nommer une équipe ou un joueur et ce que vous voulez savoir.',
    [COMPARISON_MESSAGES.unreliableInterpreter]: 'L’interpréteur local ne peut pas identifier de façon fiable les éléments de football demandés. Aucune statistique ni aucun événement sans rapport n’a été sélectionné.',
  },
  de: {
    [COMPARISON_MESSAGES.separately]: 'Hier sind die beiden Antworten getrennt: die Prüfung bei {earlier} und die bei {later}.',
    [COMPARISON_MESSAGES.notComparable]: 'Ich kann diese beiden Prüfungen nicht vergleichbar nebeneinanderstellen.',
    [COMPARISON_MESSAGES.notAssessed]: 'Mindestens eine Prüfung konnte nicht bewertet werden, daher gibt es nichts zu vergleichen.',
    [COMPARISON_MESSAGES.differentPeriods]: 'Die Prüfungen verwendeten unterschiedliche Belegzeiträume.',
    [COMPARISON_MESSAGES.differentInterpretation]: 'Die beiden Prüfungen deuten diese Meinung unterschiedlich und lassen sich daher nicht direkt vergleichen.',
    [COMPARISON_MESSAGES.differentClaims]: 'Die gedeuteten Aussagen unterscheiden sich, daher wird keine vergleichbare Veränderung gemeldet.',
    [COMPARISON_MESSAGES.differentData]: 'Diese beiden Prüfungen verwendeten unterschiedliche Spieldaten, daher vergleiche ich sie nicht.',
    [COMPARISON_MESSAGES.unmatchedReply]: 'Ich konnte das keiner Aussage zuordnen, die ich in diesem Spiel prüfen kann, und habe keine unbeteiligten Zahlen herausgegriffen. Nenne ein Team oder einen Spieler und was du wissen möchtest.',
    [COMPARISON_MESSAGES.unreliableInterpreter]: 'Der lokale Interpreter kann die gewünschten Fußballbelege nicht zuverlässig erkennen. Es wurden keine unbeteiligten Statistiken oder Ereignisse ausgewählt.',
  },
  ar: {
    [COMPARISON_MESSAGES.separately]: 'هاتان الإجابتان منفصلتان: فحص {earlier} وفحص {later}.',
    [COMPARISON_MESSAGES.notComparable]: 'لا أستطيع مقارنة هذين الفحصين على أساس متكافئ.',
    [COMPARISON_MESSAGES.notAssessed]: 'تعذّر تقييم فحص واحد على الأقل، لذلك لا يوجد ما يمكن مقارنته.',
    [COMPARISON_MESSAGES.differentPeriods]: 'استخدم الفحصان فترتين مختلفتين من الأدلة.',
    [COMPARISON_MESSAGES.differentInterpretation]: 'يفسّر الفحصان هذا الرأي بطريقتين مختلفتين، لذلك لا يمكن مقارنتهما مباشرة.',
    [COMPARISON_MESSAGES.differentClaims]: 'تختلف الادعاءات المفسَّرة، لذلك لا يُبلَّغ عن تغيّر قابل للمقارنة.',
    [COMPARISON_MESSAGES.differentData]: 'استخدم هذان الفحصان بيانات مباراة مختلفة، لذلك لا أقارن بينهما.',
    [COMPARISON_MESSAGES.unmatchedReply]: 'لم أستطع ربط ذلك بشيء يمكنني التحقق منه في هذه المباراة، ولم أختر أرقاماً غير ذات صلة. جرّب ذكر فريق أو لاعب وما تريد معرفته.',
    [COMPARISON_MESSAGES.unreliableInterpreter]: 'لا يستطيع المفسِّر المحلي تحديد أدلة كرة القدم المطلوبة بدقة. لم تُختر أي إحصاءات أو أحداث غير ذات صلة.',
  },
}

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

/** Translates a generated comparison sentence by matching its English template, then filling the localized one. */
export function translateComparisonMessage(text: string, language: AppLanguage): string | null {
  if (language === 'en') return null
  const table = comparisonTranslations[language]
  for (const template of Object.values(COMPARISON_MESSAGES)) {
    const names: string[] = []
    const source = escapePattern(template).replace(/\\\{([a-z]+)\\\}/gu, (_token, name: string) => {
      names.push(name)
      return '(.+?)'
    })
    const match = text.match(new RegExp(`^${source}$`, 'u'))
    if (!match) continue
    const values = Object.fromEntries(names.map((name, index) => [name, match[index + 1]]))
    return table[template].replace(/\{([a-z]+)\}/gu, (_token, name: string) => values[name] ?? '')
  }
  return null
}
