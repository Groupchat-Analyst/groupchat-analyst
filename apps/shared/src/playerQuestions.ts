/**
 * Bounded, native-language question families that name one person.
 * Each family extracts only the name slot; the structured player-resolution flow decides
 * who that name refers to. Wording outside these families is never guessed.
 */
export type PlayerQuestionFamily = 'performance' | 'pass-completions'

export type PlayerQuestion = {
  family: PlayerQuestionFamily
  /** The name exactly as the user wrote it. */
  name: string
  /** English form understood by the deterministic local interpreter. */
  canonical: string
}

const NAME =
  "(?<name>[\\p{L}\\p{M}][\\p{L}\\p{M}'’.\\-]*(?:\\s+[\\p{L}\\p{M}][\\p{L}\\p{M}'’.\\-]*){0,2}?)"
const TIME = "(?:\\s+(?:today|hoy|aujourd['’]hui|heute|اليوم))?"
const END = `${TIME}\\s*[.!?؟]*$`

type Pattern = { expression: RegExp; keepWording: boolean }

const pattern = (source: string, keepWording = false): Pattern => ({
  expression: new RegExp(source, 'iu'),
  keepWording,
})

// Wording the English interpreter already understands is kept verbatim; other families are rewritten.
const PERFORMANCE_PATTERNS: Pattern[] = [
  // English
  pattern(`^how\\s+(?:did|has|does)\\s+${NAME}\\s+(?:play|played|perform|performed)${END}`, true),
  pattern(`^how\\s+(?:was|is|has)\\s+${NAME}(?:\\s+(?:been|played|playing|doing))?${END}`),
  pattern(`^how\\s+good\\s+(?:was|is)\\s+${NAME}${END}`, true),
  pattern(`^(?:was|is)\\s+${NAME}\\s+(?:good|any good|great)${END}`),
  pattern(`^(?:did|has)\\s+${NAME}\\s+(?:play|played)\\s+well${END}`),
  // Spanish
  pattern(`^¿?c[oó]mo\\s+(?:jug[oó]|ha\\s+jugado|estuvo|fue|va)\\s+${NAME}${END}`),
  pattern(`^¿?jug[oó]\\s+(?:bien|mal)\\s+${NAME}${END}`),
  pattern(`^¿?(?:fue|estuvo)\\s+(?:bueno|buena|bien)\\s+${NAME}${END}`),
  // French
  pattern(`^comment\\s+${NAME}\\s+a-t-il\\s+jou[eé]${END}`),
  pattern(`^comment\\s+(?:a\\s+jou[eé]|[eé]tait|joue)\\s+${NAME}${END}`),
  pattern(`^${NAME}\\s+a-t-il\\s+(?:bien\\s+)?jou[eé]${END}`),
  pattern(`^${NAME}\\s+a-t-il\\s+[eé]t[eé]\\s+bon${END}`),
  // German
  pattern(`^wie\\s+hat\\s+${NAME}\\s+gespielt${END}`),
  pattern(`^wie\\s+(?:war|spielte|spielt)\\s+${NAME}${END}`),
  pattern(`^hat\\s+${NAME}\\s+gut\\s+gespielt${END}`),
  pattern(`^war\\s+${NAME}\\s+gut${END}`),
  // Arabic
  pattern(`^(?:كيف|ما)\\s+(?:لعب|لعبت|كان\\s+أداء|كان\\s+مستوى|أدى)\\s+${NAME}${END}`),
  pattern(`^هل\\s+لعب\\s+${NAME}\\s+(?:جيد[اً]?|بشكل\\s+جيد)${END}`),
  pattern(`^هل\\s+كان\\s+${NAME}\\s+جيد[اً]?${END}`),
]

const PASS_PATTERNS: Pattern[] = [
  pattern(`^how\\s+many\\s+(?:completed\\s+)?passes\\s+(?:did|has)\\s+${NAME}\\s+(?:complete|completed|make|made)${END}`, true),
  pattern(`^¿?cu[aá]ntos\\s+pases\\s+(?:complet[oó]|ha\\s+completado|acert[oó])\\s+${NAME}${END}`),
  pattern(`^combien\\s+de\\s+passes\\s+${NAME}\\s+a-t-il\\s+(?:r[eé]ussi|r[eé]ussies|compl[eé]t[eé]|compl[eé]t[eé]es)${END}`),
  pattern(`^combien\\s+de\\s+passes\\s+a\\s+r[eé]ussi\\s+${NAME}${END}`),
  pattern(`^wie\\s+viele\\s+p[aä]sse\\s+hat\\s+${NAME}\\s+(?:abgeschlossen|komplettiert|erfolgreich\\s+gespielt|gespielt)${END}`),
  pattern(`^كم\\s+(?:عدد\\s+)?(?:تمريرة|التمريرات|تمريرات)(?:\\s+التي)?\\s+(?:أكمل|أكملها|أتم|أتمها|أكملت)\\s+${NAME}${END}`),
]

// Words that make a captured slot a general noun phrase rather than a person.
const NOT_A_PERSON = new Set([
  'the', 'this', 'that', 'it', 'he', 'she', 'they', 'everyone', 'everybody', 'team', 'match', 'game',
  'el', 'la', 'los', 'las', 'partido', 'equipo', 'le', 'les', 'match', 'équipe', 'equipe',
  'der', 'die', 'das', 'spiel', 'mannschaft', 'er', 'sie', 'es',
  'المباراة', 'الفريق', 'هو', 'هي', 'اللقاء',
  'today', 'tonight', 'yesterday', 'now', 'hoy', 'ahora', 'heute', 'jetzt', 'اليوم', 'الآن',
])

function usableName(name: string): boolean {
  const first = name.trim().split(/\s+/u)[0]?.toLowerCase().replace(/[’']/gu, '')
  return Boolean(first) && !NOT_A_PERSON.has(first!)
}

/** Conservative test for naming a person who is absent from the roster, rather than a general noun phrase. */
export function looksLikePersonName(name: string): boolean {
  const tokens = name.trim().split(/\s+/u)
  if (tokens.length === 0 || tokens.length > 2) return false
  if (/['’]s\b/iu.test(name)) return false
  return tokens.every((token) =>
    /\p{Script=Arabic}/u.test(token)
      ? !token.startsWith('ال')
      : /^\p{Lu}/u.test(token),
  )
}

export function parsePlayerQuestion(opinion: string): PlayerQuestion | null {
  const text = opinion.trim()
  for (const [family, patterns, template] of [
    ['pass-completions', PASS_PATTERNS, (name: string) => `How many passes did ${name} complete?`],
    ['performance', PERFORMANCE_PATTERNS, (name: string) => `How did ${name} play?`],
  ] as const) {
    for (const { expression, keepWording } of patterns) {
      const name = expression.exec(text)?.groups?.name?.trim()
      if (name && usableName(name)) {
        return { family, name, canonical: keepWording ? opinion : template(name) }
      }
    }
  }
  return null
}
