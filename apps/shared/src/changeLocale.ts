import type { ClaimResult } from './apiContracts.ts'
import { COMPARISON_MESSAGES, comparisonTranslations } from './comparisonLocale.ts'
import { renderAssessmentLabel } from './claimPresentationLocale.ts'
import { formatNumber } from './factualPresentation.ts'
import type { AppLanguage } from './localization.ts'
import { formatMatchClock, type AnalysisPeriod, type MatchClock } from './matchClock.ts'

/**
 * Typed facts for the "what changed" comparison of two answers, and the five-language renderer
 * for them. Facts are derived from structured snapshot data (clocks, assessment codes, figures,
 * record ids, accounting codes); the legacy English headline/lines/caveats remain on the
 * investigation Comparison type for saved or older consumers and are never parsed here.
 *
 * Free text embedded in rendering: the user's verbatim claim `quote`, dataset labels, and
 * caller-localized entity names. A null figure means "not recorded", never zero.
 */
export type ChangeEntity =
  | { kind: 'team'; team: string }
  | { kind: 'player'; id: string; name: string; team: string }

export type ChangeAssessment = ClaimResult['assessment']
export type ChangeAccounting = 'complete' | 'partial' | 'incomplete' | 'rate' | 'unchanged'
export type ChangeStatus = 'comparable' | 'different-interpretation' | 'not-comparable'

export type ChangeFigure = {
  entity: ChangeEntity
  /** ClaimMetric id such as 'shots-on-target'. */
  metric: string
  before: number | null
  after: number | null
}

export type ChangePair = {
  /** Verbatim claim text. */
  quote: string
  before: ChangeAssessment
  after: ChangeAssessment
  figures: ChangeFigure[]
  /** Stable evidence record ids that entered or left the window between the two checks. */
  addedRecordIds: string[]
  removedRecordIds: string[]
  accounting: ChangeAccounting
}

export type ChangeCaveat =
  | { code: 'different-data'; earlier: { label: string; version: string }; later: { label: string; version: string } }
  | { code: 'different-claims' }
  | { code: 'different-periods' }
  | { code: 'not-assessed' }
  | { code: 'accounting'; accounting: Exclude<ChangeAccounting, 'unchanged'>; quote?: string }
  | { code: 'rolling-windows' }

export type ChangeCheck = { clock: MatchClock; period: AnalysisPeriod }

export type ComparisonFacts = {
  version: 1
  status: ChangeStatus
  earlier: ChangeCheck
  later: ChangeCheck
  /** Empty unless status is 'comparable'. */
  pairs: ChangePair[]
  caveats: ChangeCaveat[]
  /** Which headline applies when the checks cannot be compared. */
  reason?: 'different-data' | 'different-interpretation' | 'different-periods' | 'not-assessed'
}

export type ChangeContext = {
  nameOf: (entity: ChangeEntity) => string
  /** Optional localized description of an evidence record; without it only counts are shown. */
  describeRecord?: (recordId: string, change: 'added' | 'removed') => string
}

export type RenderedComparison = { headline: string; lines: string[]; caveats: string[] }

class UnsupportedChange extends Error {}

const EN = {
  unsupported: 'This comparison could not be shown because it uses a type this version of the app does not support.',
  na: 'n/a',
  'then.supported': 'held up',
  'now.supported': 'holds up',
  'then.contradicted': 'didn’t hold up',
  'now.contradicted': 'doesn’t hold up',
  'then.unsettled': 'couldn’t be settled from the records',
  'now.unsettled': 'can’t be settled from the records',
  'then.figures': 'had figures only',
  'now.figures': 'has figures only',
  'then.clarify': 'needed clarifying',
  'now.clarify': 'needs clarifying',
  'then.nodata': 'had no recorded data',
  'now.nodata': 'has no recorded data',
  'then.notunderstood': 'wasn’t understood',
  'now.notunderstood': 'isn’t understood',
  same: 'Same call at both times: it {now}.',
  changed: 'That’s changed: at {earlier} it {then}; at {later} it {now}.',
  quotePrefix: '“{quote}” — {line}',
  multi: '{count} claims rechecked: here’s how each one moved.',
  'fig.line': '{label}: {parts}.',
  'fig.same': '{entity} {value}',
  'fig.moved': '{entity} {before} → {after}',
  'fl.shots': 'Shots',
  'fl.shots-on-target': 'Shots on target',
  'fl.goals': 'Goals',
  'fl.possession-percentage': 'Possession (%)',
  'fl.pass-attempts': 'Passes attempted',
  'fl.pass-completions': 'Passes completed',
  'fl.pass-completion-percentage': 'Pass completion (%)',
  'fl.recoveries': 'Recoveries',
  'fl.pressure-observations': 'Pressure observations',
  'fl.running-distance': 'Running distance',
  'fl.minutes-played': 'Recorded minutes of participation',
  added: 'New in the records: {items}.',
  removed: 'No longer in the window: {items}.',
  'rec.one': '1 recorded moment',
  'rec.other': '{count} recorded moments',
  'cv.complete': 'The listed moments match the change in the count. That’s a tally, not a reason: the records can’t say why it happened.',
  'cv.partial': 'The records listed don’t fully account for the change in these figures.',
  'cv.incomplete': 'Some of the records behind these figures aren’t fully recorded, so the ones listed may not be the whole story.',
  'cv.rate': 'This is a rate or share, so the records listed don’t add up to the change directly.',
  'cv.pair': '{text} (“{quote}”)',
  'cv.rolling': 'Rolling windows: {earlier} against {later}, so earlier moments can drop out.',
  'cv.differentData': 'The {earlierTime} check used {first}; the {laterTime} check used {second}. Figures from different data can’t be compared like for like.',
  'win.match-so-far': 'match so far',
  'win.last-10-minutes': 'last 10 minutes',
  'card.brand': 'Groupchat Analyst',
  'card.extended': 'Extended card · {count} claims',
  'card.original': 'Original wording',
  'card.checked': 'Checked at {earlier}, then again at {later}',
  'card.figures': 'Decisive figures',
  'card.added': 'New recorded moments',
  'card.removed': 'No longer in the window',
  'card.note': 'Note: {text}',
  'card.limitation': 'Limitation: {text}',
  'card.bullet': '{clock} ({window}): {label}',
}

type Key = keyof typeof EN
type Dict = Record<Key, string>

const ES: Dict = {
  unsupported: 'No se pudo mostrar esta comparación porque usa un tipo que esta versión de la aplicación no admite.',
  na: 'n/d',
  'then.supported': 'se sostuvo',
  'now.supported': 'se sostiene',
  'then.contradicted': 'no se sostuvo',
  'now.contradicted': 'no se sostiene',
  'then.unsettled': 'no pudo decidirse con los registros',
  'now.unsettled': 'no puede decidirse con los registros',
  'then.figures': 'solo tenía cifras',
  'now.figures': 'solo tiene cifras',
  'then.clarify': 'necesitaba aclaración',
  'now.clarify': 'necesita aclaración',
  'then.nodata': 'no tenía datos registrados',
  'now.nodata': 'no tiene datos registrados',
  'then.notunderstood': 'no se entendió',
  'now.notunderstood': 'no se entiende',
  same: 'La misma conclusión en ambos momentos: {now}.',
  changed: 'Ha cambiado: en el {earlier} {then}; en el {later} {now}.',
  quotePrefix: '«{quote}» — {line}',
  multi: 'Se han vuelto a comprobar {count} afirmaciones: así se movió cada una.',
  'fig.line': '{label}: {parts}.',
  'fig.same': '{entity} {value}',
  'fig.moved': '{entity} {before} → {after}',
  'fl.shots': 'Tiros',
  'fl.shots-on-target': 'Tiros a puerta',
  'fl.goals': 'Goles',
  'fl.possession-percentage': 'Posesión (%)',
  'fl.pass-attempts': 'Pases intentados',
  'fl.pass-completions': 'Pases completados',
  'fl.pass-completion-percentage': 'Pases completados (%)',
  'fl.recoveries': 'Recuperaciones',
  'fl.pressure-observations': 'Observaciones de presión',
  'fl.running-distance': 'Distancia recorrida',
  'fl.minutes-played': 'Minutos registrados de participación',
  added: 'Novedades en los registros: {items}.',
  removed: 'Ya no están en la ventana: {items}.',
  'rec.one': '1 momento registrado',
  'rec.other': '{count} momentos registrados',
  'cv.complete': 'Los momentos listados coinciden con el cambio en el recuento. Es un recuento, no una razón: los registros no pueden decir por qué ocurrió.',
  'cv.partial': 'Los registros listados no explican por completo el cambio en estas cifras.',
  'cv.incomplete': 'Algunos de los registros que hay detrás de estas cifras no están completos, así que los listados pueden no ser toda la historia.',
  'cv.rate': 'Es una tasa o un porcentaje, así que los registros listados no suman directamente el cambio.',
  'cv.pair': '{text} («{quote}»)',
  'cv.rolling': 'Ventanas móviles: {earlier} frente a {later}, así que los momentos anteriores pueden salir de la ventana.',
  'cv.differentData': 'La comprobación de {earlierTime} usó {first}; la de {laterTime} usó {second}. Las cifras de datos distintos no pueden compararse en igualdad de condiciones.',
  'win.match-so-far': 'el partido hasta ahora',
  'win.last-10-minutes': 'los últimos 10 minutos',
  'card.brand': 'Groupchat Analyst',
  'card.extended': 'Tarjeta ampliada · {count} afirmaciones',
  'card.original': 'Formulación original',
  'card.checked': 'Comprobado en el {earlier} y de nuevo en el {later}',
  'card.figures': 'Cifras decisivas',
  'card.added': 'Nuevos momentos registrados',
  'card.removed': 'Ya no están en la ventana',
  'card.note': 'Nota: {text}',
  'card.limitation': 'Limitación: {text}',
  'card.bullet': '{clock} ({window}): {label}',
}

const FR: Dict = {
  unsupported: 'Cette comparaison n’a pas pu être affichée car elle utilise un type que cette version de l’application ne prend pas en charge.',
  na: 's. o.',
  'then.supported': 'tenait',
  'now.supported': 'tient',
  'then.contradicted': 'ne tenait pas',
  'now.contradicted': 'ne tient pas',
  'then.unsettled': 'ne pouvait pas être tranché avec les données',
  'now.unsettled': 'ne peut pas être tranché avec les données',
  'then.figures': 'n’avait que des chiffres',
  'now.figures': 'n’a que des chiffres',
  'then.clarify': 'devait être précisé',
  'now.clarify': 'doit être précisé',
  'then.nodata': 'n’avait aucune donnée enregistrée',
  'now.nodata': 'n’a aucune donnée enregistrée',
  'then.notunderstood': 'n’était pas compris',
  'now.notunderstood': 'n’est pas compris',
  same: 'Même verdict aux deux moments : {now}.',
  changed: 'Ça a changé : à {earlier}, cela {then} ; à {later}, cela {now}.',
  quotePrefix: '« {quote} » — {line}',
  multi: '{count} affirmations revérifiées : voici comment chacune a évolué.',
  'fig.line': '{label} : {parts}.',
  'fig.same': '{entity} {value}',
  'fig.moved': '{entity} {before} → {after}',
  'fl.shots': 'Tirs',
  'fl.shots-on-target': 'Tirs cadrés',
  'fl.goals': 'Buts',
  'fl.possession-percentage': 'Possession (%)',
  'fl.pass-attempts': 'Passes tentées',
  'fl.pass-completions': 'Passes réussies',
  'fl.pass-completion-percentage': 'Passes réussies (%)',
  'fl.recoveries': 'Récupérations',
  'fl.pressure-observations': 'Observations de pressing',
  'fl.running-distance': 'Distance parcourue',
  'fl.minutes-played': 'Minutes enregistrées de participation',
  added: 'Nouveau dans les données : {items}.',
  removed: 'N’est plus dans la fenêtre : {items}.',
  'rec.one': '1 moment enregistré',
  'rec.other': '{count} moments enregistrés',
  'cv.complete': 'Les moments listés correspondent à l’évolution du décompte. C’est un décompte, pas une explication : les données ne disent pas pourquoi cela s’est produit.',
  'cv.partial': 'Les données listées n’expliquent pas entièrement l’évolution de ces chiffres.',
  'cv.incomplete': 'Certaines données derrière ces chiffres ne sont pas entièrement enregistrées ; celles listées ne disent peut-être pas tout.',
  'cv.rate': 'Il s’agit d’un taux ou d’une part ; les données listées ne s’additionnent donc pas directement à l’évolution.',
  'cv.pair': '{text} (« {quote} »)',
  'cv.rolling': 'Fenêtres glissantes : {earlier} contre {later} ; des moments plus anciens peuvent donc sortir de la fenêtre.',
  'cv.differentData': 'La vérification de {earlierTime} a utilisé {first} ; celle de {laterTime} a utilisé {second}. Des chiffres issus de données différentes ne peuvent pas être comparés à égalité.',
  'win.match-so-far': 'le match jusqu’ici',
  'win.last-10-minutes': 'les 10 dernières minutes',
  'card.brand': 'Groupchat Analyst',
  'card.extended': 'Carte étendue · {count} affirmations',
  'card.original': 'Formulation d’origine',
  'card.checked': 'Vérifié à {earlier}, puis de nouveau à {later}',
  'card.figures': 'Chiffres décisifs',
  'card.added': 'Nouveaux moments enregistrés',
  'card.removed': 'N’est plus dans la fenêtre',
  'card.note': 'Note : {text}',
  'card.limitation': 'Limite : {text}',
  'card.bullet': '{clock} ({window}) : {label}',
}

const DE: Dict = {
  unsupported: 'Dieser Vergleich konnte nicht angezeigt werden, weil er einen Typ verwendet, den diese Version der App nicht unterstützt.',
  na: 'k. A.',
  'then.supported': 'war die Aussage haltbar',
  'now.supported': 'ist die Aussage haltbar',
  'then.contradicted': 'war die Aussage nicht haltbar',
  'now.contradicted': 'ist die Aussage nicht haltbar',
  'then.unsettled': 'ließ sich die Aussage mit den Daten nicht klären',
  'now.unsettled': 'lässt sich die Aussage mit den Daten nicht klären',
  'then.figures': 'gab es nur Zahlen',
  'now.figures': 'gibt es nur Zahlen',
  'then.clarify': 'musste die Aussage geklärt werden',
  'now.clarify': 'muss die Aussage geklärt werden',
  'then.nodata': 'gab es keine erfassten Daten',
  'now.nodata': 'gibt es keine erfassten Daten',
  'then.notunderstood': 'wurde die Aussage nicht verstanden',
  'now.notunderstood': 'wird die Aussage nicht verstanden',
  same: 'Bei beiden Prüfungen {now}.',
  changed: 'Das hat sich geändert: Bei {earlier} {then}; bei {later} {now}.',
  quotePrefix: '„{quote}“ — {line}',
  multi: '{count} Aussagen erneut geprüft: So hat sich jede bewegt.',
  'fig.line': '{label}: {parts}.',
  'fig.same': '{entity} {value}',
  'fig.moved': '{entity} {before} → {after}',
  'fl.shots': 'Schüsse',
  'fl.shots-on-target': 'Schüsse aufs Tor',
  'fl.goals': 'Tore',
  'fl.possession-percentage': 'Ballbesitz (%)',
  'fl.pass-attempts': 'Passversuche',
  'fl.pass-completions': 'Angekommene Pässe',
  'fl.pass-completion-percentage': 'Passquote (%)',
  'fl.recoveries': 'Ballgewinne',
  'fl.pressure-observations': 'Pressing-Beobachtungen',
  'fl.running-distance': 'Laufdistanz',
  'fl.minutes-played': 'Erfasste Einsatzminuten',
  added: 'Neu in den Daten: {items}.',
  removed: 'Nicht mehr im Zeitfenster: {items}.',
  'rec.one': '1 erfasster Moment',
  'rec.other': '{count} erfasste Momente',
  'cv.complete': 'Die aufgeführten Momente passen zur Änderung der Zahl. Das ist eine Zählung, keine Begründung: Die Daten können nicht sagen, warum es geschah.',
  'cv.partial': 'Die aufgeführten Daten erklären die Änderung dieser Zahlen nicht vollständig.',
  'cv.incomplete': 'Manche Daten hinter diesen Zahlen sind nicht vollständig erfasst, daher zeigen die aufgeführten möglicherweise nicht alles.',
  'cv.rate': 'Das ist eine Quote oder ein Anteil, daher ergeben die aufgeführten Daten die Änderung nicht direkt.',
  'cv.pair': '{text} („{quote}“)',
  'cv.rolling': 'Gleitende Zeitfenster: {earlier} gegenüber {later}, daher können frühere Momente herausfallen.',
  'cv.differentData': 'Die Prüfung bei {earlierTime} nutzte {first}; die bei {laterTime} nutzte {second}. Zahlen aus unterschiedlichen Daten lassen sich nicht gleichwertig vergleichen.',
  'win.match-so-far': 'das Spiel bisher',
  'win.last-10-minutes': 'die letzten 10 Minuten',
  'card.brand': 'Groupchat Analyst',
  'card.extended': 'Erweiterte Karte · {count} Aussagen',
  'card.original': 'Ursprüngliche Formulierung',
  'card.checked': 'Geprüft bei {earlier}, dann erneut bei {later}',
  'card.figures': 'Entscheidende Zahlen',
  'card.added': 'Neue erfasste Momente',
  'card.removed': 'Nicht mehr im Zeitfenster',
  'card.note': 'Hinweis: {text}',
  'card.limitation': 'Einschränkung: {text}',
  'card.bullet': '{clock} ({window}): {label}',
}

const AR: Dict = {
  unsupported: 'تعذّر عرض هذه المقارنة لأنها تستخدم نوعاً لا يدعمه هذا الإصدار من التطبيق.',
  na: 'غير متاح',
  'then.supported': 'صامداً',
  'now.supported': 'صامداً',
  'then.contradicted': 'غير صامد',
  'now.contradicted': 'غير صامد',
  'then.unsettled': 'مستعصياً على الحسم من السجلات',
  'now.unsettled': 'مستعصياً على الحسم من السجلات',
  'then.figures': 'مقتصراً على الأرقام',
  'now.figures': 'مقتصراً على الأرقام',
  'then.clarify': 'بحاجة إلى توضيح',
  'now.clarify': 'بحاجة إلى توضيح',
  'then.nodata': 'بلا بيانات مسجّلة',
  'now.nodata': 'بلا بيانات مسجّلة',
  'then.notunderstood': 'غير مفهوم',
  'now.notunderstood': 'غير مفهوم',
  same: 'الحكم نفسه في الوقتين: ظلّ الادعاء {now}.',
  changed: 'تغيّر الأمر: عند {earlier} كان الادعاء {then}؛ وعند {later} أصبح الادعاء {now}.',
  quotePrefix: '«{quote}» — {line}',
  multi: 'أُعيد فحص عدة ادعاءات (العدد: {count}): هكذا تحرّك كل منها.',
  'fig.line': '{label}: {parts}.',
  'fig.same': '{entity} {value}',
  'fig.moved': '{entity} من {before} إلى {after}',
  'fl.shots': 'التسديدات',
  'fl.shots-on-target': 'التسديدات على المرمى',
  'fl.goals': 'الأهداف',
  'fl.possession-percentage': 'الاستحواذ (%)',
  'fl.pass-attempts': 'محاولات التمرير',
  'fl.pass-completions': 'التمريرات الناجحة',
  'fl.pass-completion-percentage': 'نسبة التمريرات الناجحة (%)',
  'fl.recoveries': 'الاستخلاصات',
  'fl.pressure-observations': 'ملاحظات الضغط',
  'fl.running-distance': 'مسافة الجري',
  'fl.minutes-played': 'دقائق المشاركة المسجّلة',
  added: 'جديد في السجلات: {items}.',
  removed: 'لم يعد ضمن الفترة: {items}.',
  'rec.one': 'لحظة مسجّلة واحدة',
  'rec.other': '{count} لحظات مسجّلة',
  'cv.complete': 'اللحظات المدرجة تطابق التغيّر في العدّ. هذا إحصاء وليس سبباً: السجلات لا تستطيع تفسير سبب حدوثه.',
  'cv.partial': 'السجلات المدرجة لا تفسّر التغيّر في هذه الأرقام بالكامل.',
  'cv.incomplete': 'بعض السجلات وراء هذه الأرقام غير مسجّلة بالكامل، لذلك قد لا تمثّل المدرجة القصة كلها.',
  'cv.rate': 'هذه نسبة أو حصة، لذلك لا تتطابق السجلات المدرجة مع التغيّر مباشرة.',
  'cv.pair': '{text} («{quote}»)',
  'cv.rolling': 'فترات متحركة: {earlier} مقابل {later}، لذلك قد تخرج اللحظات الأقدم من الفترة.',
  'cv.differentData': 'استخدم فحص {earlierTime} {first}؛ واستخدم فحص {laterTime} {second}. لا يمكن مقارنة أرقام من بيانات مختلفة على أساس متكافئ.',
  'win.match-so-far': 'المباراة حتى الآن',
  'win.last-10-minutes': 'آخر 10 دقائق',
  'card.brand': 'Groupchat Analyst',
  'card.extended': 'بطاقة موسّعة · عدد الادعاءات: {count}',
  'card.original': 'الصياغة الأصلية',
  'card.checked': 'فُحص عند {earlier} ثم مرة أخرى عند {later}',
  'card.figures': 'الأرقام الحاسمة',
  'card.added': 'لحظات مسجّلة جديدة',
  'card.removed': 'لم تعد ضمن الفترة',
  'card.note': 'ملاحظة: {text}',
  'card.limitation': 'قيد: {text}',
  'card.bullet': '{clock} ({window}): {label}',
}

const DICTS: Record<AppLanguage, Record<string, string>> = { en: EN, es: ES, fr: FR, de: DE, ar: AR }

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? '')

function text(language: AppLanguage, key: string, values: Record<string, string> = {}): string {
  const template = DICTS[language]?.[key]
  if (template === undefined) throw new UnsupportedChange(key)
  return fill(template, values)
}

const ASSESSMENT_KEY: Record<ChangeAssessment, string> = {
  supported: 'supported',
  contradicted: 'contradicted',
  'insufficient evidence for a firm conclusion': 'unsettled',
  'statistics provided': 'figures',
  'clarification needed': 'clarify',
  'unavailable data': 'nodata',
  'unrecognized language': 'notunderstood',
}

function assessmentKey(assessment: string): string {
  const key = (ASSESSMENT_KEY as Record<string, string | undefined>)[assessment]
  if (key === undefined) throw new UnsupportedChange(assessment)
  return key
}

const trimStop = (value: string) => value.replace(/[.\s]+$/, '')
const joinList = (items: string[], language: AppLanguage) => items.join(language === 'ar' ? '، ' : ', ')

function sharedMessage(language: AppLanguage, key: keyof typeof COMPARISON_MESSAGES, values: Record<string, string> = {}): string {
  const english = COMPARISON_MESSAGES[key]
  const template = language === 'en' ? english : comparisonTranslations[language]?.[english]
  if (template === undefined) throw new UnsupportedChange(key)
  return fill(template, values)
}

const windowText = (check: ChangeCheck, language: AppLanguage) =>
  `${text(language, `win.${check.period}`)}, ${formatMatchClock(check.clock)}`

function figureLines(pair: ChangePair, ctx: ChangeContext, language: AppLanguage): string | null {
  const byMetric = new Map<string, ChangeFigure[]>()
  for (const figure of pair.figures) byMetric.set(figure.metric, [...(byMetric.get(figure.metric) ?? []), figure])
  const sentences = [...byMetric.entries()].map(([metric, items]) => {
    const value = (n: number | null) => (n === null ? text(language, 'na') : formatNumber(n, language))
    const parts = items.map(({ entity, before, after }) =>
      before === after
        ? text(language, 'fig.same', { entity: ctx.nameOf(entity), value: value(after) })
        : text(language, 'fig.moved', { entity: ctx.nameOf(entity), before: value(before), after: value(after) }))
    return text(language, 'fig.line', { label: text(language, `fl.${metric}`), parts: joinList(parts, language) })
  })
  return sentences.length === 0 ? null : sentences.join(' ')
}

function recordList(
  ids: string[],
  change: 'added' | 'removed',
  ctx: ChangeContext,
  language: AppLanguage,
): string {
  if (ctx.describeRecord) return ids.map((id) => trimStop(ctx.describeRecord!(id, change))).join('; ')
  return ids.length === 1
    ? text(language, 'rec.one')
    : text(language, 'rec.other', { count: formatNumber(ids.length, language) })
}

function caveatText(caveat: ChangeCaveat, facts: ComparisonFacts, language: AppLanguage): string {
  const earlierTime = formatMatchClock(facts.earlier.clock)
  const laterTime = formatMatchClock(facts.later.clock)
  switch (caveat.code) {
    case 'different-data':
      return text(language, 'cv.differentData', {
        earlierTime,
        laterTime,
        first: `${caveat.earlier.label} (v${caveat.earlier.version})`,
        second: `${caveat.later.label} (v${caveat.later.version})`,
      })
    case 'different-claims': return sharedMessage(language, 'differentClaims')
    case 'different-periods': return sharedMessage(language, 'differentPeriods')
    case 'not-assessed': return sharedMessage(language, 'notAssessed')
    case 'accounting': {
      const base = text(language, `cv.${caveat.accounting}`)
      return caveat.quote === undefined ? base : text(language, 'cv.pair', { text: base, quote: caveat.quote })
    }
    case 'rolling-windows':
      return text(language, 'cv.rolling', {
        earlier: windowText(facts.earlier, language),
        later: windowText(facts.later, language),
      })
    default:
      throw new UnsupportedChange('caveat')
  }
}

function renderUnavailableHeadline(facts: ComparisonFacts, language: AppLanguage): string {
  switch (facts.status) {
    case 'different-interpretation': return sharedMessage(language, 'differentInterpretation')
    case 'not-comparable':
      return facts.reason === 'different-data'
        ? sharedMessage(language, 'differentData')
        : sharedMessage(language, 'notComparable')
    default: throw new UnsupportedChange('status')
  }
}

/** Localized headline, fan-facing lines and caveats; unknown versions/codes yield the unsupported text. */
export function renderComparisonFacts(
  facts: ComparisonFacts,
  ctx: ChangeContext,
  language: AppLanguage,
): RenderedComparison {
  try {
    if ((facts as { version: number }).version !== 1) throw new UnsupportedChange('version')
    const caveats = facts.caveats.map((caveat) => caveatText(caveat, facts, language))
    if (facts.status !== 'comparable') {
      return {
        headline: renderUnavailableHeadline(facts, language),
        lines: [sharedMessage(language, 'separately', {
          earlier: formatMatchClock(facts.earlier.clock),
          later: formatMatchClock(facts.later.clock),
        })],
        caveats,
      }
    }
    const earlier = formatMatchClock(facts.earlier.clock)
    const later = formatMatchClock(facts.later.clock)
    const multiple = facts.pairs.length > 1
    const lines: string[] = []
    for (const pair of facts.pairs) {
      const now = text(language, `now.${assessmentKey(pair.after)}`)
      const verdict = pair.before === pair.after
        ? text(language, 'same', { now })
        : text(language, 'changed', {
            earlier,
            later,
            then: text(language, `then.${assessmentKey(pair.before)}`),
            now,
          })
      lines.push(multiple ? text(language, 'quotePrefix', { quote: pair.quote, line: verdict }) : verdict)
      const figures = figureLines(pair, ctx, language)
      if (figures) lines.push(figures)
      if (pair.addedRecordIds.length > 0) {
        lines.push(text(language, 'added', { items: recordList(pair.addedRecordIds, 'added', ctx, language) }))
      }
      if (pair.removedRecordIds.length > 0) {
        lines.push(text(language, 'removed', { items: recordList(pair.removedRecordIds, 'removed', ctx, language) }))
      }
    }
    const headline = multiple
      ? text(language, 'multi', { count: formatNumber(facts.pairs.length, language) })
      : lines[0]
    return { headline, lines: multiple ? lines : lines.slice(1), caveats }
  } catch (error) {
    if (error instanceof UnsupportedChange) {
      return { headline: text(language, 'unsupported'), lines: [], caveats: [] }
    }
    throw error
  }
}

export type ChangeCardLabels = {
  brand: string
  original: string
  decisiveFigures: string
  newMoments: string
  noLongerInWindow: string
  extended: (claimCount: number) => string
  checked: (earlier: MatchClock, later: MatchClock) => string
  note: (caveat: string) => string
  limitation: (qualification: string) => string
  /** "57′ (match so far): Supported"; the label is a renderAssessmentLabel value. */
  bullet: (check: ChangeCheck, assessment: ChangeAssessment) => string
  /** Figure sentences for the "Decisive figures" block, one entry per metric. */
  figures: (pair: ChangePair, ctx: ChangeContext) => string[]
  /** Record bullets for the new/removed blocks. */
  records: (ids: string[], change: 'added' | 'removed', ctx: ChangeContext) => string[]
}

/** Localized block labels and builders for the "what changed" card. */
export function renderChangeCardLabels(language: AppLanguage): ChangeCardLabels {
  return {
    brand: text(language, 'card.brand'),
    original: text(language, 'card.original'),
    decisiveFigures: text(language, 'card.figures'),
    newMoments: text(language, 'card.added'),
    noLongerInWindow: text(language, 'card.removed'),
    extended: (claimCount) => text(language, 'card.extended', { count: formatNumber(claimCount, language) }),
    checked: (earlier, later) =>
      text(language, 'card.checked', { earlier: formatMatchClock(earlier), later: formatMatchClock(later) }),
    note: (caveat) => text(language, 'card.note', { text: caveat }),
    limitation: (qualification) => text(language, 'card.limitation', { text: qualification }),
    bullet: (check, assessment) =>
      text(language, 'card.bullet', {
        clock: formatMatchClock(check.clock),
        window: text(language, `win.${check.period}`),
        label: renderAssessmentLabel(assessment, language),
      }),
    figures: (pair, ctx) => {
      const joined = figureLines(pair, ctx, language)
      return joined === null ? [] : joined.split(/(?<=[.。]) /u)
    },
    records: (ids, change, ctx) =>
      ctx.describeRecord
        ? ids.map((id) => trimStop(ctx.describeRecord!(id, change)))
        : [recordList(ids, change, ctx, language)],
  }
}
