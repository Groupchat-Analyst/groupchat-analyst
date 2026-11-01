import type { ClaimResult } from './apiContracts.ts'
import type { AppLanguage } from './localization.ts'

/**
 * Typed presentation of a factual team/player comparison. Every sentence is produced from these
 * fields and per-language templates; no English sentence is parsed or rewritten.
 */
export type ComparisonMetric =
  | 'shots'
  | 'shots-on-target'
  | 'goals'
  | 'possession-percentage'
  | 'pass-attempts'
  | 'pass-completions'
  | 'pass-completion-percentage'
  | 'recoveries'
  | 'pressure-observations'
  | 'minutes-played'
  | 'running-distance'

export type ComparisonSide = {
  name: string
  value: number | null
  attempts?: number | null
  completions?: number | null
}

export type FactualComparisonFacts = {
  verdict: 'supported' | 'contradicted' | 'unsettled'
  metric: ComparisonMetric
  subject: ComparisonSide
  opponent: ComparisonSide
}

type Nouns = { one: string; other: string; two?: string; few?: string }

const NOUNS: Record<AppLanguage, Partial<Record<ComparisonMetric, Nouns>>> = {
  en: {
    shots: { one: 'shot', other: 'shots' },
    'shots-on-target': { one: 'shot on target', other: 'shots on target' },
    goals: { one: 'goal', other: 'goals' },
    'pass-attempts': { one: 'pass attempt', other: 'pass attempts' },
    'pass-completions': { one: 'completed pass', other: 'completed passes' },
    recoveries: { one: 'recovery', other: 'recoveries' },
    'pressure-observations': { one: 'selected pressure observation', other: 'selected pressure observations' },
    'minutes-played': { one: 'recorded minute', other: 'recorded minutes' },
  },
  es: {
    shots: { one: 'tiro', other: 'tiros' },
    'shots-on-target': { one: 'tiro a puerta', other: 'tiros a puerta' },
    goals: { one: 'gol', other: 'goles' },
    'pass-attempts': { one: 'intento de pase', other: 'intentos de pase' },
    'pass-completions': { one: 'pase completado', other: 'pases completados' },
    recoveries: { one: 'recuperación', other: 'recuperaciones' },
    'pressure-observations': { one: 'observación de presión seleccionada', other: 'observaciones de presión seleccionadas' },
    'minutes-played': { one: 'minuto registrado', other: 'minutos registrados' },
  },
  fr: {
    shots: { one: 'tir', other: 'tirs' },
    'shots-on-target': { one: 'tir cadré', other: 'tirs cadrés' },
    goals: { one: 'but', other: 'buts' },
    'pass-attempts': { one: 'tentative de passe', other: 'tentatives de passe' },
    'pass-completions': { one: 'passe réussie', other: 'passes réussies' },
    recoveries: { one: 'récupération', other: 'récupérations' },
    'pressure-observations': { one: 'observation de pressing sélectionnée', other: 'observations de pressing sélectionnées' },
    'minutes-played': { one: 'minute enregistrée', other: 'minutes enregistrées' },
  },
  de: {
    shots: { one: 'Schuss', other: 'Schüsse' },
    'shots-on-target': { one: 'Schuss aufs Tor', other: 'Schüsse aufs Tor' },
    goals: { one: 'Tor', other: 'Tore' },
    'pass-attempts': { one: 'Passversuch', other: 'Passversuche' },
    'pass-completions': { one: 'angekommener Pass', other: 'angekommene Pässe' },
    recoveries: { one: 'Ballgewinn', other: 'Ballgewinne' },
    'pressure-observations': { one: 'ausgewählte Pressing-Beobachtung', other: 'ausgewählte Pressing-Beobachtungen' },
    'minutes-played': { one: 'erfasste Minute', other: 'erfasste Minuten' },
  },
  ar: {
    shots: { one: 'تسديدة', two: 'تسديدتان', few: 'تسديدات', other: 'تسديدة' },
    'shots-on-target': { one: 'تسديدة على المرمى', two: 'تسديدتان على المرمى', few: 'تسديدات على المرمى', other: 'تسديدة على المرمى' },
    goals: { one: 'هدف', two: 'هدفان', few: 'أهداف', other: 'هدفاً' },
    'pass-attempts': { one: 'محاولة تمرير', two: 'محاولتا تمرير', few: 'محاولات تمرير', other: 'محاولة تمرير' },
    'pass-completions': { one: 'تمريرة ناجحة', two: 'تمريرتان ناجحتان', few: 'تمريرات ناجحة', other: 'تمريرة ناجحة' },
    recoveries: { one: 'استخلاص', two: 'استخلاصان', few: 'استخلاصات', other: 'استخلاصاً' },
    'pressure-observations': { one: 'ملاحظة ضغط مختارة', two: 'ملاحظتا ضغط مختارتان', few: 'ملاحظات ضغط مختارة', other: 'ملاحظة ضغط مختارة' },
    'minutes-played': { one: 'دقيقة مسجّلة', two: 'دقيقتان مسجّلتان', few: 'دقائق مسجّلة', other: 'دقيقة مسجّلة' },
  },
}

const METRIC_NAMES: Record<AppLanguage, Record<ComparisonMetric, string>> = {
  en: {
    shots: 'shot count', 'shots-on-target': 'shots-on-target count', goals: 'goal count',
    'possession-percentage': 'recorded possession', 'pass-attempts': 'pass-attempt count',
    'pass-completions': 'completed-pass count', 'pass-completion-percentage': 'pass completion rate',
    recoveries: 'recovery count', 'pressure-observations': 'pressure-observation count',
    'minutes-played': 'recorded minutes', 'running-distance': 'running distance',
  },
  es: {
    shots: 'cifra de tiros', 'shots-on-target': 'cifra de tiros a puerta', goals: 'cifra de goles',
    'possession-percentage': 'posesión registrada', 'pass-attempts': 'cifra de intentos de pase',
    'pass-completions': 'cifra de pases completados', 'pass-completion-percentage': 'porcentaje de pases completados',
    recoveries: 'cifra de recuperaciones', 'pressure-observations': 'cifra de observaciones de presión',
    'minutes-played': 'minutos registrados', 'running-distance': 'distancia recorrida',
  },
  fr: {
    shots: 'nombre de tirs', 'shots-on-target': 'nombre de tirs cadrés', goals: 'nombre de buts',
    'possession-percentage': 'possession enregistrée', 'pass-attempts': 'nombre de tentatives de passe',
    'pass-completions': 'nombre de passes réussies', 'pass-completion-percentage': 'taux de passes réussies',
    recoveries: 'nombre de récupérations', 'pressure-observations': 'nombre d’observations de pressing',
    'minutes-played': 'minutes enregistrées', 'running-distance': 'distance parcourue',
  },
  de: {
    shots: 'Schusszahl', 'shots-on-target': 'Zahl der Schüsse aufs Tor', goals: 'Torzahl',
    'possession-percentage': 'erfasster Ballbesitz', 'pass-attempts': 'Zahl der Passversuche',
    'pass-completions': 'Zahl angekommener Pässe', 'pass-completion-percentage': 'Passquote',
    recoveries: 'Zahl der Ballgewinne', 'pressure-observations': 'Zahl der Pressing-Beobachtungen',
    'minutes-played': 'erfasste Minuten', 'running-distance': 'Laufdistanz',
  },
  ar: {
    shots: 'عدد التسديدات', 'shots-on-target': 'عدد التسديدات على المرمى', goals: 'عدد الأهداف',
    'possession-percentage': 'الاستحواذ المسجّل', 'pass-attempts': 'عدد محاولات التمرير',
    'pass-completions': 'عدد التمريرات الناجحة', 'pass-completion-percentage': 'نسبة التمريرات الناجحة',
    recoveries: 'عدد الاستخلاصات', 'pressure-observations': 'عدد ملاحظات الضغط',
    'minutes-played': 'الدقائق المسجّلة', 'running-distance': 'مسافة الجري',
  },
}

export function formatNumber(value: number, language: AppLanguage): string {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-u-nu-latn' : language, {
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatCountWithNoun(
  metric: ComparisonMetric,
  value: number,
  language: AppLanguage,
): string {
  const nouns = NOUNS[language][metric]
  if (!nouns) return formatNumber(value, language)
  const number = formatNumber(value, language)
  if (language === 'ar') {
    if (value === 2 && nouns.two) return nouns.two
    if (value === 1) return nouns.one
    return `${number} ${value >= 3 && value <= 10 ? (nouns.few ?? nouns.other) : nouns.other}`
  }
  const noun = value === 1 || (language === 'fr' && value === 0) ? nouns.one : nouns.other
  return `${number} ${noun}`
}

export function comparisonMetricName(metric: ComparisonMetric, language: AppLanguage): string {
  return METRIC_NAMES[language][metric]
}

type Templates = {
  lead: Record<FactualComparisonFacts['verdict'], string>
  counts: (a: string, aCount: string, b: string, bValue: string) => string
  level: (a: string, b: string, count: string) => string
  possession: (a: string, aValue: string, b: string, bValue: string) => string
  passRate: (a: string, aDone: string, aTotal: string, aRate: string, b: string, bDone: string, bTotal: string, bRate: string) => string
  unavailableOne: (who: string, metric: string, otherWho: string, otherValue: string) => string
  unavailableBoth: (who: string, metric: string, otherWho: string) => string
  notRecorded: (metric: string) => string
}

const TEMPLATES: Record<AppLanguage, Templates> = {
  en: {
    lead: { supported: 'Yes — ', contradicted: 'No — ', unsettled: "The records can't settle this one: " },
    counts: (a, ac, b, bv) => `${a} have ${ac} to ${b}'s ${bv}.`,
    level: (a, b, c) => `${a} and ${b} are level on ${c} each.`,
    possession: (a, av, b, bv) => `${a} had ${av} of recorded possession to ${b}'s ${bv}.`,
    passRate: (a, ad, at, ar, b, bd, bt, br) => `${a} completed ${ad} of ${at} passes (${ar}) to ${b}'s ${bd} of ${bt} (${br}).`,
    unavailableOne: (who, m, ow, ov) => `${who}'s ${m} isn't available, and ${ow}'s is ${ov}.`,
    unavailableBoth: (who, m, ow) => `${who}'s ${m} isn't available, and neither is ${ow}'s.`,
    notRecorded: (m) => `${m} is not recorded in this fixture, so no figure can be compared.`,
  },
  es: {
    lead: { supported: 'Sí — ', contradicted: 'No — ', unsettled: 'Los registros no permiten decidirlo: ' },
    counts: (a, ac, b, bv) => `${a} tiene ${ac} frente a ${bv} de ${b}.`,
    level: (a, b, c) => `${a} y ${b} están igualados con ${c} cada uno.`,
    possession: (a, av, b, bv) => `${a} tuvo el ${av} de la posesión registrada frente al ${bv} de ${b}.`,
    passRate: (a, ad, at, ar, b, bd, bt, br) => `${a} completó ${ad} de ${at} pases (${ar}) frente a ${bd} de ${bt} de ${b} (${br}).`,
    unavailableOne: (who, m, ow, ov) => `${m} de ${who} no está disponible, y el de ${ow} es ${ov}.`,
    unavailableBoth: (who, m, ow) => `${m} de ${who} no está disponible, y tampoco el de ${ow}.`,
    notRecorded: (m) => `${m} no se registra en este partido, así que no hay cifras que comparar.`,
  },
  fr: {
    lead: { supported: 'Oui — ', contradicted: 'Non — ', unsettled: 'Les données ne permettent pas de trancher : ' },
    counts: (a, ac, b, bv) => `${a} compte ${ac} contre ${bv} pour ${b}.`,
    level: (a, b, c) => `${a} et ${b} sont à égalité avec ${c} chacun.`,
    possession: (a, av, b, bv) => `${a} a eu ${av} de la possession enregistrée contre ${bv} pour ${b}.`,
    passRate: (a, ad, at, ar, b, bd, bt, br) => `${a} a réussi ${ad} passes sur ${at} (${ar}) contre ${bd} sur ${bt} pour ${b} (${br}).`,
    unavailableOne: (who, m, ow, ov) => `Le ${m} de ${who} n’est pas disponible, et celui de ${ow} est ${ov}.`,
    unavailableBoth: (who, m, ow) => `Le ${m} de ${who} n’est pas disponible, ni celui de ${ow}.`,
    notRecorded: (m) => `${m} n’est pas enregistré dans ce match ; aucun chiffre ne peut être comparé.`,
  },
  de: {
    lead: { supported: 'Ja — ', contradicted: 'Nein — ', unsettled: 'Die Daten können das nicht klären: ' },
    counts: (a, ac, b, bv) => `${a} hat ${ac} gegenüber ${bv} bei ${b}.`,
    level: (a, b, c) => `${a} und ${b} liegen mit je ${c} gleichauf.`,
    possession: (a, av, b, bv) => `${a} hatte ${av} des erfassten Ballbesitzes gegenüber ${bv} bei ${b}.`,
    passRate: (a, ad, at, ar, b, bd, bt, br) => `${a} spielte ${ad} von ${at} Pässen erfolgreich (${ar}), ${b} ${bd} von ${bt} (${br}).`,
    unavailableOne: (who, m, ow, ov) => `${m} von ${who} ist nicht verfügbar, der von ${ow} beträgt ${ov}.`,
    unavailableBoth: (who, m, ow) => `${m} von ${who} ist nicht verfügbar, ebenso der von ${ow}.`,
    notRecorded: (m) => `${m} wird in diesem Spiel nicht erfasst, daher lässt sich keine Zahl vergleichen.`,
  },
  ar: {
    lead: { supported: 'نعم — ', contradicted: 'لا — ', unsettled: 'لا تكفي السجلات للحسم: ' },
    counts: (a, ac, b, bv) => `${a} لديه ${ac} مقابل ${bv} لدى ${b}.`,
    level: (a, b, c) => `${a} و${b} متعادلان بواقع ${c} لكل منهما.`,
    possession: (a, av, b, bv) => `استحوذ ${a} على ${av} من الاستحواذ المسجّل مقابل ${bv} لـ${b}.`,
    passRate: (a, ad, at, ar, b, bd, bt, br) => `أتمّ ${a} ${ad} من ${at} تمريرة (${ar}) مقابل ${bd} من ${bt} لـ${b} (${br}).`,
    unavailableOne: (who, m, ow, ov) => `${m} لدى ${who} غير متاح، وهو لدى ${ow} ${ov}.`,
    unavailableBoth: (who, m, ow) => `${m} لدى ${who} غير متاح، وكذلك لدى ${ow}.`,
    notRecorded: (m) => `${m} غير مسجّل في هذه المباراة، لذا لا يمكن مقارنة أي رقم.`,
  },
}

const upperFirst = (text: string, language: AppLanguage) =>
  language === 'ar' ? text : text.charAt(0).toLocaleUpperCase(language) + text.slice(1)

/** Renders a factual comparison answer entirely from typed facts; names must already be localized. */
export function formatFactualComparison(
  facts: FactualComparisonFacts,
  language: AppLanguage,
): string {
  const t = TEMPLATES[language]
  const lead = t.lead[facts.verdict]
  const { metric, subject, opponent } = facts
  const metricName = comparisonMetricName(metric, language)
  if (metric === 'running-distance') {
    return `${lead}${t.notRecorded(upperFirst(metricName, language))}`
  }
  if (subject.value === null || opponent.value === null) {
    const available = subject.value === null ? opponent : subject
    const missing = subject.value === null ? subject : opponent
    const shown = available.value === null
      ? null
      : metric === 'possession-percentage' || metric === 'pass-completion-percentage'
        ? `${formatNumber(available.value, language)}%`
        : formatCountWithNoun(metric, available.value, language)
    return `${lead}${shown === null
      ? t.unavailableBoth(missing.name, metricName, available.name)
      : t.unavailableOne(missing.name, metricName, available.name, shown)}`
  }
  if (metric === 'pass-completion-percentage') {
    const n = (value: number | null | undefined) =>
      value === null || value === undefined ? '—' : formatNumber(value, language)
    return `${lead}${t.passRate(
      subject.name, n(subject.completions), n(subject.attempts), `${n(subject.value)}%`,
      opponent.name, n(opponent.completions), n(opponent.attempts), `${n(opponent.value)}%`,
    )}`
  }
  if (metric === 'possession-percentage') {
    return `${lead}${t.possession(
      subject.name, `${formatNumber(subject.value, language)}%`,
      opponent.name, `${formatNumber(opponent.value, language)}%`,
    )}`
  }
  if (subject.value === opponent.value) {
    return `${lead}${t.level(subject.name, opponent.name, formatCountWithNoun(metric, subject.value, language))}`
  }
  return `${lead}${t.counts(
    subject.name,
    formatCountWithNoun(metric, subject.value, language),
    opponent.name,
    formatNumber(opponent.value, language),
  )}`
}

/** Derives typed comparison facts from a validated claim result; names are caller-localized. */
export function comparisonFactsFromResult(
  result: ClaimResult,
  nameOfTeam: (team: string) => string,
  nameOfPlayer: (player: { id: string; name: string }) => string,
): FactualComparisonFacts | undefined {
  const { claim } = result
  const comparison = claim.meaning.comparison
  if (
    claim.intent !== 'factual-claim' ||
    claim.meaning.category !== 'factual-comparison' ||
    !comparison
  ) return undefined
  const verdict = result.assessment === 'supported'
    ? 'supported'
    : result.assessment === 'contradicted'
      ? 'contradicted'
      : result.assessment === 'insufficient evidence for a firm conclusion'
        ? 'unsettled'
        : undefined
  if (!verdict) return undefined
  const metric = comparison.metric as ComparisonMetric
  const statistic = (team: string, key: string) =>
    result.statistics.find((item) => item.team === team && item.metric === key)?.value ?? null
  let sides: ComparisonSide[]
  if (comparison.opponentPlayer && claim.playerSubject) {
    const playerStat = (id: string, key: string) =>
      result.playerStatistics.find((item) => item.playerId === id && item.metric === key)?.value ?? null
    sides = [claim.playerSubject, comparison.opponentPlayer].map((player) => ({
      name: nameOfPlayer(player),
      value: playerStat(player.id, comparison.metric),
      attempts: playerStat(player.id, 'pass-attempts'),
      completions: playerStat(player.id, 'pass-completions'),
    }))
  } else if (claim.subject) {
    sides = [claim.subject, comparison.opponent].map((team) => {
      const trace = result.calculations.find(
        (item) => item.team === team && item.metric === 'pass-completion-percentage',
      )
      return {
        name: nameOfTeam(team),
        value: statistic(team, comparison.metric) ?? trace?.value ?? null,
        attempts: statistic(team, 'pass-attempts') ?? trace?.denominator ?? null,
        completions: statistic(team, 'pass-completions') ?? trace?.numerator ?? null,
      }
    })
  } else return undefined
  return { verdict, metric, subject: sides[0], opponent: sides[1] }
}

const POSSESSION_NOTE: Record<AppLanguage, string> = {
  en: "Possession only counts recorded controlled time, so it doesn't show territorial control or overall performance.",
  es: 'La posesión solo cuenta el tiempo de control registrado, así que no muestra el control territorial ni el rendimiento global.',
  fr: 'La possession ne compte que le temps de contrôle enregistré ; elle ne montre ni le contrôle du terrain ni la performance globale.',
  de: 'Ballbesitz zählt nur erfasste Kontrollzeit und zeigt weder Raumkontrolle noch die Gesamtleistung.',
  ar: 'يحتسب الاستحواذ وقت السيطرة المسجّل فقط، لذا لا يعكس السيطرة على المساحات ولا الأداء العام.',
}

export function comparisonLimitation(
  facts: FactualComparisonFacts,
  language: AppLanguage,
): string {
  return facts.metric === 'possession-percentage' ? POSSESSION_NOTE[language] : ''
}
