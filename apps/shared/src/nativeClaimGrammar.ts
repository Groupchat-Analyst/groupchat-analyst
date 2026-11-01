/**
 * Bounded, lexicon-driven grammar for the claim families the local interpreter supports.
 *
 * Each family is one clause shape (subject + predicate); a per-language lexicon supplies the verbs,
 * quantifiers, metric nouns and adjectives. A clause is rewritten to the English wording the
 * deterministic interpreter already understands, and entities (teams, players) are passed through
 * verbatim for the existing team and player resolution. Wording outside these shapes is returned
 * unchanged, so it is never guessed.
 */
type NativeLanguage = 'es' | 'fr' | 'de' | 'ar'

type Metric = 'shots' | 'shots on target' | 'possession' | 'goals'

type Lexicon = {
  /** Verbs that introduce a count ("had", "recorded"). */
  have: string
  more: string
  fewer: string
  /** Connector before the opponent, including any elision. */
  than: string
  /** Shot / possession / goal nouns, with the on-target modifier. */
  shotNoun: string
  onTarget: string
  possessionNoun: string
  goalNoun: string
  negatedHave: string
  none: string
  beforeGoal: string
  every: string
  of: string
  shotWere: string
  onTargetPredicate: string
  scored: string
  passing: string
  passingBe: string
  poor: string
  be: string
  playedBadly: string
  sloppy: string
  sloppyOnBall: string
}

const SUBJECT = String.raw`(?<subject>[\p{L}\p{M}][\p{L}\p{M}'’.\-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'’.\-]*){0,3}?)`
const entity = (group: string) => SUBJECT.replace('subject', group)

// Written without accents-only variants where a bare letter is also common in running text.
const LEXICONS: Record<Exclude<NativeLanguage, 'ar'>, Lexicon> = {
  es: {
    have: String.raw`(?:tuvo|tiene|ha\s+tenido|hab[ií]a\s+tenido|registr[oó]|ha\s+registrado|logr[oó]|hizo|realiz[oó])`,
    more: String.raw`m[aá]s`,
    fewer: String.raw`menos`,
    than: String.raw`que\s+`,
    shotNoun: String.raw`(?:tiros?|disparos?|remates?|chutes?)`,
    onTarget: String.raw`(?:a\s+(?:puerta|porter[ií]a)|al\s+arco|entre\s+los\s+tres\s+palos)`,
    possessionNoun: String.raw`(?:posesi[oó]n(?:\s+del\s+bal[oó]n)?)`,
    goalNoun: String.raw`goles?`,
    negatedHave: String.raw`(?:no\s+(?:tuvo|tiene|ha\s+tenido|registr[oó]|ha\s+registrado|logr[oó]|hizo|realiz[oó]))`,
    none: String.raw`(?:(?:ning[uú]n|ninguna|ningunos|ningunas)\s+)?`,
    beforeGoal: String.raw`antes\s+del\s+gol`,
    every: String.raw`(?:todos\s+los|todas\s+las|cada|todo\s+el)`,
    of: String.raw`(?:de|del)`,
    shotWere: String.raw`(?:fue|fueron|iba|iban|acab[oó]|acabaron|estuvo|estuvieron)`,
    onTargetPredicate: String.raw`(?:a\s+(?:puerta|porter[ií]a)|al\s+arco|entre\s+los\s+tres\s+palos)`,
    scored: String.raw`(?:ha\s+marcado|marc[oó]|ha\s+anotado|anot[oó]|ha\s+(?:metido|hecho)\s+(?:un\s+)?gol|meti[oó]\s+un\s+gol|ha\s+convertido|convirti[oó])`,
    passing: String.raw`(?:el\s+juego\s+de\s+pase|el\s+juego\s+de\s+pases|los\s+pases|el\s+pase|la\s+distribuci[oó]n)`,
    passingBe: String.raw`(?:ha\s+sido|han\s+sido|fue|fueron|ha\s+estado|han\s+estado|estuvo|estuvieron|es|son|est[aá]|est[aá]n)`,
    poor: String.raw`(?:muy\s+)?(?:mal(?:os?|as?)?|pobres?|flojos?|flojas?|deficientes?|decepcionantes?|terribles?|horribles?)`,
    be: String.raw`(?:ha\s+sido|ha\s+estado|fue|estuvo|est[aá]|es)`,
    playedBadly: String.raw`(?:ha\s+jugado\s+mal|jug[oó]\s+mal|juega\s+mal)`,
    sloppy: String.raw`(?:muy\s+)?(?:descuidad[oa]s?|desordenad[oa]s?|imprecis[oa]s?|poco\s+fiables?|chapuce(?:ro|ra)s?)`,
    sloppyOnBall: String.raw`(?:\s+(?:con\s+(?:el\s+bal[oó]n|la\s+pelota)|en\s+posesi[oó]n|al\s+(?:tocar|manejar)\s+el\s+bal[oó]n))?`,
  },
  fr: {
    have: String.raw`(?:a\s+eu|avait|a\s+enregistr[eé]|a\s+r[eé]alis[eé]|a\s+effectu[eé]|a\s+tent[eé])`,
    more: String.raw`(?:plus|davantage)`,
    fewer: String.raw`moins`,
    than: String.raw`(?:que\s+|qu['’]\s*)`,
    shotNoun: String.raw`(?:tirs?|frappes?)`,
    onTarget: String.raw`(?:cadr[eé]e?s?|(?:au|dans\s+le)\s+cadre)`,
    possessionNoun: String.raw`(?:possession(?:\s+du\s+ballon)?)`,
    goalNoun: String.raw`buts?`,
    negatedHave: String.raw`(?:n['’](?:a|avait)\s+(?:pas\s+)?(?:eu|enregistr[eé]|r[eé]alis[eé]|effectu[eé]|tent[eé])?)`,
    none: String.raw`(?:(?:aucune?|aucuns?)\s+|pas\s+de\s+|pas\s+d['’]\s*)`,
    beforeGoal: String.raw`avant\s+le\s+but`,
    every: String.raw`(?:tous\s+les|toutes\s+les|chaque)`,
    of: String.raw`(?:de|d['’]\s*|du)`,
    shotWere: String.raw`(?:[eé]taient|[eé]tait|ont\s+[eé]t[eé]|a\s+[eé]t[eé]|sont|est)`,
    onTargetPredicate: String.raw`(?:cadr[eé]e?s?|(?:au|dans\s+le)\s+cadre)`,
    scored: String.raw`(?:a\s+marqu[eé]|a\s+inscrit\s+(?:un\s+)?but|a\s+mis\s+un\s+but|a\s+plant[eé]\s+un\s+but)`,
    passing: String.raw`(?:les\s+passes|le\s+jeu\s+de\s+passes|la\s+distribution|le\s+jeu\s+de\s+passe)`,
    passingBe: String.raw`(?:ont\s+[eé]t[eé]|a\s+[eé]t[eé]|[eé]taient|[eé]tait|sont|est)`,
    poor: String.raw`(?:tr[eè]s\s+)?(?:mauvais(?:e|es)?|faibles?|m[eé]diocres?|d[eé]cevant(?:e|es|s)?|pauvres?|catastrophiques?|horribles?)`,
    be: String.raw`(?:a\s+[eé]t[eé]|[eé]tait|est)`,
    playedBadly: String.raw`(?:a\s+mal\s+jou[eé]|joue\s+mal|jouait\s+mal)`,
    sloppy: String.raw`(?:tr[eè]s\s+)?(?:brouillon(?:ne)?s?|approximati(?:f|ve)s?|n[eé]gligent(?:e|es|s)?|brouillons)`,
    sloppyOnBall: String.raw`(?:\s+(?:avec\s+le\s+ballon|balle\s+au\s+pied|en\s+possession(?:\s+du\s+ballon)?))?`,
  },
  de: {
    have: String.raw`(?:hatte|hat|verzeichnete|erzielte|gab)`,
    more: String.raw`mehr`,
    fewer: String.raw`weniger`,
    than: String.raw`als\s+`,
    shotNoun: String.raw`(?:sch[uü]sse?|torsch[uü]sse?|torsch[uü]ss)`,
    onTarget: String.raw`(?:auf(?:s|\s+das)?\s+tor)`,
    possessionNoun: String.raw`ballbesitz`,
    goalNoun: String.raw`tore?`,
    negatedHave: String.raw`(?:hatte|hat)`,
    none: String.raw`(?:keine[nm]?\s+)`,
    beforeGoal: String.raw`vor\s+dem\s+(?:tor|treffer)`,
    every: String.raw`(?:alle|jeder|jede|jedes)`,
    of: String.raw`(?:von|der|des)`,
    shotWere: String.raw`(?:waren|war|ging|gingen)`,
    onTargetPredicate: String.raw`(?:auf(?:s|\s+das)?\s+tor)`,
    scored: String.raw`(?:hat\s+(?:ein\s+tor\s+)?(?:erzielt|geschossen|getroffen)|traf|erzielte\s+ein\s+tor|hat\s+getroffen)`,
    passing: String.raw`(?:(?:das\s+)?passspiel|(?:die\s+)?p[aä]sse)`,
    passingBe: String.raw`(?:war|waren|ist|sind|war\s+bisher|waren\s+bisher)`,
    poor: String.raw`(?:sehr\s+)?(?:schlecht|schwach|mies|d[uü]rftig|enttäuschend|enttaeuschend|miserabel)`,
    be: String.raw`(?:war|ist)`,
    playedBadly: String.raw`(?:hat\s+schlecht\s+gespielt|spielte\s+schlecht|spielt\s+schlecht)`,
    sloppy: String.raw`(?:sehr\s+)?(?:schlampig|nachl[aä]ssig|schludrig|fahrl[aä]ssig)`,
    sloppyOnBall: String.raw`(?:\s+(?:am|mit\s+dem)\s+ball(?:\s+um)?)?`,
  },
}

const ARABIC = {
  shotNoun: String.raw`(?:تسديدات|تسديدة|تصويبات|تصويبة)`,
  onTarget: String.raw`على\s+المرمى`,
  possessionNoun: String.raw`(?:استحواذ(?:اً|ا)?|الاستحواذ)`,
  goalNoun: String.raw`(?:أهداف(?:اً|ا)?|هدف(?:اً|ا)?|أهدافا)`,
  more: String.raw`أكثر`,
  fewer: String.raw`أقل`,
}

const METRIC_PHRASE = (lexicon: Pick<Lexicon, 'shotNoun' | 'onTarget' | 'possessionNoun' | 'goalNoun'>, arabic = false) =>
  arabic
    ? String.raw`(?:${lexicon.shotNoun}(?:\s+${lexicon.onTarget})?|${lexicon.possessionNoun}|${lexicon.goalNoun})`
    : String.raw`(?:${lexicon.shotNoun}(?:\s+${lexicon.onTarget})?|${lexicon.possessionNoun}|${lexicon.goalNoun})`

function classifyMetric(phrase: string, language: NativeLanguage): Metric {
  const lexicon = language === 'ar' ? ARABIC : LEXICONS[language]
  if (new RegExp(lexicon.possessionNoun, 'iu').test(phrase)) return 'possession'
  if (new RegExp(lexicon.shotNoun, 'iu').test(phrase)) {
    const target = new RegExp(lexicon.onTarget, 'iu').test(phrase) ||
      (language === 'de' && /torsch[uü]ss/iu.test(phrase))
    return target ? 'shots on target' : 'shots'
  }
  return 'goals'
}

type Clause = {
  expression: RegExp
  canonical: (groups: Record<string, string>, language: NativeLanguage) => string
}

const END = String.raw`\s*[.!?؟]*$`

function build(language: Exclude<NativeLanguage, 'ar'>): Clause[] {
  const lex = LEXICONS[language]
  const metric = METRIC_PHRASE(lex)
  const opponent = String.raw`(?:\s+${lex.than}${entity('opponent')})?`
  const rx = (source: string) => new RegExp(`^${source}${END}`, 'iu')
  const noun = (name: string) => entity(name)
  return [
    {
      // "<team> had more/fewer <metric> [than <team>]"
      expression: rx(String.raw`${noun('subject')}\s+${lex.have}\s+(?<direction>${lex.more}|${lex.fewer})(?:\s+de\s+|\s+d['’]\s*|\s+)(?<metric>${metric})${opponent}`),
      canonical: (g, l) => comparison(g, l),
    },
    {
      // "<team> had no <metric> [before the goal]"
      expression: rx(String.raw`${noun('subject')}\s+${lex.negatedHave}\s+${lex.none}(?<metric>${metric})(?<before>\s+${lex.beforeGoal})?`),
      canonical: (g, l) => noShots(g, l),
    },
    {
      // German places the time reference before the object: "<team> hatte vor dem Tor keinen Schuss aufs Tor"
      expression: rx(String.raw`${noun('subject')}\s+${lex.negatedHave}\s+(?<before>${lex.beforeGoal}\s+)${lex.none}(?<metric>${metric})`),
      canonical: (g, l) => noShots(g, l),
    },
    {
      // "every <team> shot was on target"
      expression: rx(String.raw`${lex.every}\s+${lex.shotNoun}\s+${lex.of}\s*${noun('subject')}\s+${lex.shotWere}\s+${lex.onTargetPredicate}`),
      canonical: ({ subject }) => `Every ${subject} shot was on target.`,
    },
    {
      // "<player> has scored"
      expression: rx(String.raw`${noun('subject')}\s+${lex.scored}`),
      canonical: ({ subject }) => `${subject} has scored.`,
    },
    {
      // "<player>'s passing has been poor": noun phrase first, owner after the preposition
      expression: rx(String.raw`${lex.passing}\s+${lex.of}\s*${noun('subject')}\s+${lex.passingBe}\s+(?<adjective>${lex.poor})`),
      canonical: ({ subject }) => `${subject}’s passing has been poor.`,
    },
    {
      expression: rx(String.raw`${noun('subject')}(?<genitive>[’']s?)?\s+${lex.passing}\s+${lex.passingBe}(?:\s+bisher)?\s+(?<adjective>${lex.poor})`),
      // German writes the genitive as a bare "-s" ("Sakas Passspiel"); a name that really ends in "s" would use an apostrophe.
      canonical: ({ subject }, l) => `${l === 'de' ? subject.replace(/[’']s$|(?<![s’'])s$/iu, '') : subject}’s passing has been poor.`,
    },
    {
      // "<team> are sloppy on the ball"
      expression: rx(String.raw`${noun('subject')}\s+(?:est|es|ist|war|a\s+[eé]t[eé]|[eé]tait|sont|ha\s+sido|ha\s+estado|fue|estuvo|est[aá]|geht|ging|spielt|spielte|juega|jug[oó]|joue)\s+${lex.sloppy}${lex.sloppyOnBall}`),
      canonical: ({ subject }) => `${subject} are sloppy on the ball.`,
    },
    {
      // "<player or team> has been poor"
      expression: rx(String.raw`${noun('subject')}\s+${lex.be}\s+(?<adjective>${lex.poor})`),
      canonical: ({ subject }) => `${subject} has been poor.`,
    },
    {
      expression: rx(String.raw`${noun('subject')}\s+${lex.playedBadly}`),
      canonical: ({ subject }) => `${subject} has been poor.`,
    },
  ]
}

function comparison(groups: Record<string, string>, language: NativeLanguage): string {
  const lexicon = language === 'ar' ? ARABIC : LEXICONS[language]
  const word = (groups.direction ?? '').toLowerCase()
  const fewer = new RegExp(`^${lexicon.fewer}$`, 'iu').test(word)
  const metric = classifyMetric(groups.metric ?? '', language)
  const verb = metric === 'goals' ? 'scored' : 'had'
  const tail = groups.opponent ? ` than ${groups.opponent}` : ''
  return `${groups.subject} ${verb} ${fewer ? 'fewer' : 'more'} ${metric}${tail}.`
}

function noShots(groups: Record<string, string>, language: NativeLanguage): string {
  const metric = classifyMetric(groups.metric ?? '', language)
  return `${groups.subject} had no ${metric}${groups.before ? ' before the goal' : ''}.`
}

const CLAUSES: Record<Exclude<NativeLanguage, 'ar'>, Clause[]> = {
  es: build('es'),
  fr: build('fr'),
  de: build('de'),
}

// Arabic orders words differently (verb-subject-object is common) and writes the verb in several forms.
function buildArabic(): Clause[] {
  const metric = METRIC_PHRASE(ARABIC, true)
  const rx = (source: string) => new RegExp(`^${source}${END}`, 'iu')
  const noun = (name: string) => entity(name)
  const opponent = String.raw`(?:\s+من\s+${entity('opponent')})?`
  const sloppy = String.raw`(?:مهمل(?:اً|ا|ة)?|مشتت(?:اً|ا)?|فوضوي(?:اً|ا)?|غير\s+دقيق(?:اً|ا)?|غير\s+منظم(?:اً|ا)?)`
  const poor = String.raw`(?:(?:سيئ|سيء|ضعيف|رديء|مخيب|متواضع)(?:اً|ا|ة)?)`
  return [
    {
      // "<team> had more/fewer <metric> than <team>"
      expression: rx(String.raw`${noun('subject')}\s+(?:(?:كان\s+)?(?:لديه|لديها|عنده)\s+)?(?<metric>${metric})\s+(?<direction>${ARABIC.more}|${ARABIC.fewer})${opponent}`),
      canonical: (g, l) => comparison(g, l),
    },
    {
      // Verb-first: "استحوذ <team> على الكرة أكثر من <team>", "سدد <team> أكثر"
      expression: rx(String.raw`(?<verb>استحوذ|استحوذت|سدد|سددت|سجل|سجلت)\s+${noun('subject')}(?:\s+(?<metric>${metric}))?(?:\s+على\s+الكرة)?\s+(?<direction>${ARABIC.more}|${ARABIC.fewer})(?:\s+(?<metric2>${metric}))?${opponent}`),
      canonical: (g, l) => {
        const verb = g.verb ?? ''
        const phrase = g.metric ?? g.metric2 ??
          (/^استحوذ/u.test(verb) ? 'استحواذ' : /^سجل/u.test(verb) ? 'أهداف' : 'تسديدات')
        return comparison({ ...g, metric: phrase }, l)
      },
    },
    {
      // "لم يسجل <team> أي تسديدة (على المرمى) [قبل الهدف]"
      expression: rx(String.raw`(?:لم\s+(?:يسجل|تسجل|يكن\s+لدى|يسدد|تسدد)|ليس\s+لدى)\s+${noun('subject')}\s+(?:أي\s+)?(?<metric>${metric})(?<before>\s+قبل\s+الهدف)?`),
      canonical: (g, l) => noShots(g, l),
    },
    {
      expression: rx(String.raw`${noun('subject')}\s+لم\s+(?:يسجل|تسجل|يسدد|تسدد)\s+(?:أي\s+)?(?<metric>${metric})(?<before>\s+قبل\s+الهدف)?`),
      canonical: (g, l) => noShots(g, l),
    },
    {
      // "كل تسديدات <team> كانت على المرمى"
      expression: rx(String.raw`(?:(?:كانت|كان|جاءت|جاء)\s+)?(?:كل|جميع)\s+(?:تسديدات|تسديدة|تصويبات)\s+${noun('subject')}\s+(?:(?:كانت|كان|جاءت|جاء)\s+)?على\s+المرمى`),
      canonical: ({ subject }) => `Every ${subject} shot was on target.`,
    },
    {
      // "سجل <player>" or "<player> سجل" without a number of goals
      expression: rx(String.raw`(?:سجل|سجلت)\s+${noun('subject')}(?:\s+(?:هدف(?:اً|ا)?|هدفا))?`),
      canonical: ({ subject }) => `${subject} has scored.`,
    },
    {
      expression: rx(String.raw`${noun('subject')}\s+(?:سجل|سجلت)(?:\s+(?:هدف(?:اً|ا)?|هدفا))?`),
      canonical: ({ subject }) => `${subject} has scored.`,
    },
    {
      // "كان تمرير <player> ضعيفاً"
      expression: rx(String.raw`(?:كان(?:ت)?\s+)?(?:تمرير|تمريرات)\s+${noun('subject')}\s+(?:كان(?:ت)?\s+)?(?<adjective>${poor})`),
      canonical: ({ subject }) => `${subject}’s passing has been poor.`,
    },
    {
      // "كان <team> مهملاً في الاستحواذ على الكرة"
      expression: rx(String.raw`(?:كان(?:ت)?\s+)?${noun('subject')}\s+(?:كان(?:ت)?\s+)?${sloppy}(?:\s+(?:في|عند|أثناء)\s+(?:الاستحواذ(?:\s+على\s+الكرة)?|التعامل\s+مع\s+الكرة|الكرة))?`),
      canonical: ({ subject }) => `${subject} are sloppy on the ball.`,
    },
    {
      expression: rx(String.raw`(?:كان(?:ت)?\s+)?${noun('subject')}\s+(?:كان(?:ت)?\s+)?(?<adjective>${poor})`),
      canonical: ({ subject }) => `${subject} has been poor.`,
    },
  ]
}

const ARABIC_CLAUSES = buildArabic()

const ARABIC_MARKS = /[\u064B-\u065F\u0670\u0640]/gu

// Words that make the captured subject a general noun phrase, never a team or player.
const NOT_AN_ENTITY = /^(?:el|la|los|las|le|les|der|die|das|es|er|sie|ella|él|il|elle|ils|elles|todos|alle|tous|toutes|kein|keine|ning[uú]n|aucun|aucune)$/iu

const NEGATION = /(?:^|\s)(?:no|ne|nicht|لم|لا|ما)(?:\s|$)|(?:^|\s)n['’]/iu

/** Rewrites one supported native-language clause to the interpreter's English wording, or returns undefined. */
export function canonicalizeNativeClaim(clause: string): string | undefined {
  const text = clause
    .normalize('NFC')
    .replace(ARABIC_MARKS, '')
    .replace(/^[¿¡\s]+/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
  if (!text) return undefined
  const groups = [...CLAUSE_SETS].flatMap(([, clauses]) => clauses)
  for (const { expression, canonical } of groups) {
    const match = expression.exec(text)
    if (!match?.groups) continue
    const subject = match.groups.subject
    if (!subject || NOT_AN_ENTITY.test(subject.split(' ')[0] ?? '')) continue
    // Negated comparisons ("no tuvo más…", "n’a pas eu plus…") are left to the negation-aware fallback tables.
    if (match.groups.direction !== undefined && NEGATION.test(text)) continue
    const language = languageOf(expression)
    const captured: Record<string, string> = {}
    for (const [key, value] of Object.entries(match.groups)) if (value !== undefined) captured[key] = value.trim()
    // German genitive "Sakas Passspiel" is captured apart from the name.
    return canonical(captured, language)
  }
  return undefined
}

const CLAUSE_SETS: Array<[NativeLanguage, Clause[]]> = [
  ['es', CLAUSES.es],
  ['fr', CLAUSES.fr],
  ['de', CLAUSES.de],
  ['ar', ARABIC_CLAUSES],
]

const LANGUAGE_BY_EXPRESSION = new Map<RegExp, NativeLanguage>()
for (const [language, clauses] of CLAUSE_SETS) {
  for (const { expression } of clauses) LANGUAGE_BY_EXPRESSION.set(expression, language)
}

function languageOf(expression: RegExp): NativeLanguage {
  return LANGUAGE_BY_EXPRESSION.get(expression) ?? 'es'
}
