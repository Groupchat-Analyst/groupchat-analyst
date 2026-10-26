/**
 * Semantic classes for ordinary football opinions. Each class is a vocabulary of related
 * wordings, not a list of exact sentences, and the same classification drives the local
 * interpreter, evidence selection and reply wording so they cannot disagree.
 *
 * This is deliberately bounded local-rule coverage. It is not evidence that any model
 * provider interprets the same wording correctly.
 */
export type OpinionTopic =
  | 'overall-performance'
  | 'involvement'
  | 'passing-quality'
  | 'possession-losses'
  | 'attacking-output'
  | 'finishing'
  | 'defensive-approach'
  | 'pressure-progression'
  | 'momentum'
  | 'physical-condition'
  | 'prediction'

export type OpinionPolarity = 'positive' | 'negative' | 'neutral'

export type OpinionClassification = {
  topic: OpinionTopic
  polarity: OpinionPolarity
  /** True when the take is itself negated, e.g. “hasn't had a horrible game”. */
  negated: boolean
}

const NEGATIVE_WORDS =
  'horrible|terrible|awful|dreadful|woeful|shocking|poor|bad|rubbish|disappointing|abysmal|dire|sloppy|loose|wasteful|careless|useless'
const POSITIVE_WORDS =
  'brilliant|great|excellent|superb|fantastic|outstanding|amazing|good|solid|decent|class|tidy|neat|crisp|clean|clinical|sharp'

// Order matters: narrower topics are tested before broad performance wording.
const TOPIC_PATTERNS: Array<[OpinionTopic, RegExp]> = [
  [
    'prediction',
    /\b(?:will|going to|gonna|bound to|set to)\s+(?:win|lose|draw|score|beat|finish|end up|concede|get)\b|\bto win (?:it|this|the (?:game|match))\b/i,
  ],
  [
    'physical-condition',
    /\b(?:injur\w*|hurt|limping|knock|tired|tiring|fatigu\w*|exhausted|leg[s]? (?:have )?gone|fit(?:ness)?|stamina|sprint\w*|worked? (?:so )?hard|working hard|running (?:a lot|around)|covered\s+(?:more|less|greater|a lot of)\s+(?:distance|ground)|ran\s+(?:more|further|farther|a lot)|distance covered)\b/i,
  ],
  [
    'defensive-approach',
    /\bpark(?:ed|ing) the bus\b|\blow block\b|\b(?:sat|sit|sits|sitting|dropped|dropping)\s+(?:deep|back)\b|\bbehind the ball\b|\bcompact\b|\bback (?:five|four|three)\b|\bdefensive (?:shape|set[- ]?up|line)\b|\bdefen[cs]\w*\b/i,
  ],
  [
    'pressure-progression',
    /\bpinned (?:back|in)\b|\b(?:can(?:'|’)?t|cannot|couldn(?:'|’)?t|unable to)\s+get out\b|\bpress(?:ed|ing)?\s+(?:high|well|badly|hard)\b|\bhigh press\b|\bpenned in\b|\bunder siege\b|\bback ?foot\b|\bstuck in (?:their|its) (?:own )?half\b|\b(?:territory|territorial)\b/i,
  ],
  ['momentum', /\bmomentum\b|\bswung\b|\bturned the (?:game|match)\b|\bgrowing into the (?:game|match)\b|\bon the up\b/i],
  [
    'finishing',
    /\bfinishing\b|\bfinish(?:ed|es)?\b|\bmissed (?:a |an |the )?(?:sitter|chance|chances|easy)\b|\bshould (?:have|'ve) scored\b|\bblaz(?:ed|ing)\b|\bclinical\b|\bwasteful\b|\bwasting chances\b|\bsitter\b/i,
  ],
  [
    'attacking-output',
    /\btesting the (?:keeper|goalkeeper)\b|\b(?:no|zero|few|any) shots\b|\b(?:hasn|haven|has not|have not|didn)(?:'|’)?t? ?(?:had|taken|managed|made) (?:a|any|one) shot\b|\b(?:little|no|any|lack of|zero) (?:attacking )?threat\b|\bnot (?:threatening|creating)\b|\btoothless\b|\bharmless\b|\bfiring blanks\b|\bthreaten(?:ed|ing)?\b/i,
  ],
  [
    'possession-losses',
    /\b(?:giving|gave|give|gives)\s+(?:the ball|it)\s+away\b|\bsloppy on the ball\b|\bcareless on the ball\b|\bturnovers?\b|\bdispossess\w*\b|\b(?:los(?:e|es|ing)|lost)\s+(?:the ball|possession|it)\b|\bcoughing it up\b|\bgiveaways?\b/i,
  ],
  [
    'passing-quality',
    new RegExp(
      `\\b(?:${NEGATIVE_WORDS}|${POSITIVE_WORDS})\\s+(?:passing|distribution)\\b|\\bmisplac\\w*\\b|\\bstring(?:ing)?\\s+(?:any\\s+|a few\\s+)?passes\\b|\\bpasses?\\s+(?:going\\s+)?astray\\b|\\b(?:wasting|wasted)\\s+passes\\b|\\bcan(?:'|’)?t pass\\b|\\bpassing\\b`,
      'i',
    ),
  ],
  [
    'involvement',
    /\binvisible\b|\banonymous\b|\bbarely (?:involved|touched|noticed|featured|seen|there)\b|\bhardly (?:involved|touched|seen|there)\b|\bnot (?:been )?(?:involved|getting involved|seen)\b|\bcarr(?:ying|ied|ies) the (?:team|side)\b|\beverywhere\b|\brunning the show\b|\bpulling the strings\b|\binfluential\b|\bnowhere to be seen\b/i,
  ],
  [
    'overall-performance',
    new RegExp(
      `\\b(?:${NEGATIVE_WORDS}|${POSITIVE_WORDS})\\s+(?:game|performance|match|day|night|half|display|outing|form)\\b|\\b(?:play(?:ed|ing|s)?|been|being|is|was|looking|looked)\\s+(?:really |very |so |quite |pretty )?(?:${NEGATIVE_WORDS}|${POSITIVE_WORDS}|well|badly|poorly)\\b|\\b(?:nightmare|stinker|shocker|blinder|mare|masterclass|struggl\\w*|in form|off form)\\b`,
      'i',
    ),
  ],
]

const NEGATION =
  /\b(?:not|never|no)\b|\b(?:isn|wasn|hasn|haven|hadn|aren|weren|didn|doesn|don|wouldn|couldn|can)(?:'|’)?t\b|\bcannot\b/i

export function classifyOpinion(text: string): OpinionClassification | undefined {
  const normalized = text.replace(/\s+/g, ' ')
  const hit = TOPIC_PATTERNS.find(([, pattern]) => pattern.test(normalized))
  if (!hit) return undefined
  const [topic] = hit
  const polarity: OpinionPolarity = new RegExp(`\\b(?:${NEGATIVE_WORDS})\\b|\\bstruggl\\w*|\\b(?:nightmare|stinker|shocker)\\b|\\binvisible|anonymous|toothless|harmless`, 'i').test(normalized)
    ? 'negative'
    : new RegExp(`\\b(?:${POSITIVE_WORDS})\\b|\\bblinder|masterclass|carrying the|influential`, 'i').test(normalized)
      ? 'positive'
      : 'neutral'
  // Topics whose own phrasing contains the negation ("not testing the keeper") are not "negated takes".
  const negated = NEGATION.test(normalized) && topic !== 'attacking-output' && topic !== 'involvement'
  return { topic, polarity, negated }
}

/** Evidence kinds a topic is allowed to retrieve for a player or a team subject. */
export function evidenceForTopic(
  topic: OpinionTopic,
  forPlayer: boolean,
): Array<
  | 'player-events'
  | 'passing'
  | 'shots'
  | 'goals'
  | 'possession'
  | 'possession-losses'
  | 'territorial-control'
  | 'physical-measurements'
  | 'attacking-events'
> {
  switch (topic) {
    case 'overall-performance':
    case 'involvement':
      return forPlayer
        ? ['player-events', 'passing', 'shots', 'goals']
        : ['possession', 'passing', 'shots', 'goals']
    case 'passing-quality':
      return ['passing']
    case 'possession-losses':
      return ['possession-losses', 'passing']
    case 'attacking-output':
    case 'finishing':
      return ['shots', 'goals']
    case 'defensive-approach':
    case 'pressure-progression':
      return ['territorial-control']
    case 'momentum':
      return ['possession', 'shots']
    case 'physical-condition':
      return ['physical-measurements']
    case 'prediction':
      return []
  }
}

const TOPIC_LIMITATIONS: Record<OpinionTopic, string> = {
  'overall-performance':
    'Recorded passes, shots, goals, recoveries and selected pressure observations do not add up to a performance rating, and no benchmark for “good” or “bad” is recorded.',
  involvement:
    'Counts of recorded actions are not a measure of involvement: only selected synthetic events are recorded (no touches or off-ball movement) and no benchmark for “quiet” or “influential” exists.',
  'passing-quality':
    'Pass completion is a descriptive rate from recorded passes. No benchmark or comparison defines “poor” or “tidy” passing, and pass difficulty is not recorded.',
  'possession-losses':
    'Recorded turnovers are incomplete-pass endpoints only. Dispossessions, a benchmark for “a lot”, and the reasons possession was lost are not recorded.',
  'attacking-output':
    'Recorded shots show attempts and outcomes, not chance quality or attacking threat. No expected-goals or off-ball data is recorded.',
  finishing:
    'No chance-quality or expected-goals data is recorded, so these figures cannot show whether chances were missed or finishing was poor.',
  'defensive-approach':
    'Defensive shape and positioning are not recorded, so this cannot be confirmed or refuted from the available data.',
  'pressure-progression':
    'Continuous field position, territory and pressing intensity are not recorded, so this cannot be confirmed or refuted from selected event locations.',
  momentum:
    'Momentum is not recorded. Possession share and shots in the window are context only and do not define it.',
  'physical-condition':
    'Fitness, injury and exertion are not recorded in this fixture.',
  prediction:
    'A prediction about later play cannot be checked: the records only cover what has happened up to the selected time.',
}

export function topicLimitation(topic: OpinionTopic): string {
  return TOPIC_LIMITATIONS[topic]
}

export const DEFENSIVE_SHAPE_PATTERN = TOPIC_PATTERNS.find(([topic]) => topic === 'defensive-approach')![1]
