import type { ClaimResult } from './apiContracts.ts'
import type {
  AnswerFact,
  ClaimPresentation,
  EntityRef,
  LimitationFact,
  PitchArea,
  PlayerFacts,
  ReasonCode,
  ScopeFact,
  TopicContext,
  TopicFacts,
} from './claimPresentation.ts'
import {
  comparisonMetricName,
  formatCountWithNoun,
  formatNumber,
  type ComparisonMetric,
} from './factualPresentation.ts'
import type { AppLanguage } from './localization.ts'
import { formatMatchClock, type MatchClock } from './matchClock.ts'

/**
 * Pure five-language renderer for ClaimPresentation descriptors (see claimPresentation.ts).
 *
 * Every sentence is built from a per-language template plus typed fields: codes, entity
 * references, counts, MatchClock objects and stable ids. Legacy English reply/limitation
 * strings are never read, translated or pattern-matched. The only free text embedded is the
 * user's verbatim `quote` (and `foreignTeams`) and caller-localized entity names.
 *
 * Contract for callers:
 * - `renderClaimPresentation` returns null for `structured-elsewhere` answers; use the existing
 *   structured formatters for those, and `renderPresentationLimitations` / `renderPresentationScope`
 *   / `renderPresentationReason` for the typed notes that still apply.
 * - A code, kind, topic, metric or version this renderer does not know produces the explicit
 *   localized "unsupported" text in the requested language. It never falls back to English.
 * - Numbers use formatNumber; clocks use formatMatchClock so stoppage stays as 45+3′.
 */
export type PresentationContext = {
  /** Localizes team and player names; the renderer never translates names itself. */
  nameOf: (entity: EntityRef) => string
}

export type RenderedClaimPresentation = {
  answer: string
  /** Localized verdict label derived from the typed verdict or answer code. */
  verdict: string
  limitations: string[]
  scope: string
  /** Localized reason label (and any typed follow-up hint), when the descriptor carries one. */
  note?: string
}

class UnsupportedPresentation extends Error {}

const EN = {
  'v.supported': 'Supported',
  'v.contradicted': 'Contradicted',
  'v.unsettled': 'Not enough evidence for a firm conclusion',
  'v.none': 'Statistics only, no verdict',
  'v.unavailable': 'Data not recorded',
  'v.notUnderstood': 'Not understood',
  'v.clarify': 'Needs clarification',
  'v.unsupported': 'Unsupported answer type',
  unsupported: 'This answer type is not supported by this version of the app, so it cannot be shown here.',
  legacy: 'This answer was saved before structured answers existed. The original English source is shown below; player and team identities are not inferred.',
  legacySource: 'Original English source',
  notRecorded: 'not recorded',
  bothTeams: 'both teams',
  'metric.physical-condition': 'Physical condition',
  'metric.shot-location': 'Shot location',
  'metric.territorial-control': 'Territorial control',
  'metric.build-up-pass-scope': 'Pass figures limited to build-up phases',
  'unavail.metric': '{metric} is not recorded in this match’s data, so there is no figure and no verdict.',
  'unavail.generic': 'The requested measure is not recorded in this match’s data, so there is no figure and no verdict.',
  'unrec.interpreter': 'The local interpreter cannot reliably identify the football evidence requested, so nothing was checked.',
  'unrec.prediction': 'This looks like a prediction. Only events up to {clock} are on record, so it cannot be checked.',
  'unrec.foreign': 'Not part of this match’s data: {names}. Nothing was checked.',
  clarification: 'The wording “{quote}” needs clarifying before it can be checked.',
  'claim.lead': 'Claim as understood: {text}.',
  'claim.some': '{subject} had at least {count}',
  'claim.none': '{subject} had {count}',
  'claim.every': 'every shot by {subject} was on target',
  'claim.notEvery': 'not every shot by {subject} was on target',
  'claim.noneOnTarget': 'none of the shots by {subject} was on target',
  'count.recorded': 'Recorded: {count}.',
  'count.recordedOf': 'Recorded: {count} from {total}.',
  'count.missing': 'No recorded figure is available.',
  'count.noShots': 'No shots are recorded, so a claim about every shot cannot be tested.',
  'ht.claimScored': '{subject} scored before half-time',
  'ht.claimDidNot': '{subject} did not score before half-time',
  'ht.goal': 'A first-half goal for {subject} is recorded at {clock}.',
  'ht.none': 'No first-half goal for {subject} is recorded in the completed first half (checked at {clock}).',
  'ht.open': 'The first half is not over at {clock}, so a first-half goal could still be recorded.',
  'focus.halfTime': 'goals before half-time',
  'focus.possession': 'possession',
  'focus.passing': 'passing',
  'focus.attacking': 'attacking output',
  'focus.involvement': 'recorded involvement',
  'focus.events': 'recorded match events',
  'understood.entity': 'A claim about {focus} for {entity}, checked against the recorded synthetic match data.',
  'understood.plain': 'A claim about {focus}, checked against the recorded synthetic match data.',
  'hist.claim': 'Claim: “{quote}”.',
  'hist.possession': 'Recorded possession over the checked window: {team} {value}% to {opponent} {opponentValue}%, from {minutes} of controlled play (contested and out-of-play time excluded).',
  'hist.runOfPlay': 'Possession share alone does not establish the run of play.',
  'dom.shares': '{team} had {value}% of recorded possession to {opponent}’s {opponentValue}%.',
  'dom.supports': 'This leans toward the claim, but possession share alone cannot establish dominance.',
  'dom.challenges': 'This leans against the claim, but possession share alone cannot settle it.',
  'dom.level': 'Possession is level, so it neither supports nor challenges the claim.',
  'topic.lead': 'Topic: {topic}.',
  'topic.leadNegated': 'Topic: {topic} (the opinion is negated).',
  'topic.specific': 'If you want a specific number, ask for a count such as shots or passes.',
  'topicname.overall-performance': 'overall performance',
  'topicname.involvement': 'involvement',
  'topicname.passing-quality': 'passing quality',
  'topicname.possession-losses': 'possession losses',
  'topicname.attacking-output': 'attacking output',
  'topicname.finishing': 'finishing',
  'topicname.defensive-approach': 'defensive approach',
  'topicname.pressure-progression': 'pressure and progression',
  'topicname.momentum': 'momentum',
  'topicname.physical-condition': 'physical condition',
  'topicname.prediction': 'prediction',
  'tf.passing': '{subject} completed {completions} of {attempts} recorded passes ({rate}).',
  'tf.passingNone': '{subject} has no recorded pass attempts, so no completion rate exists.',
  'tf.passingUnknown': 'Pass figures for {subject} are not recorded.',
  'tf.playerLosses': 'Possession losses recorded for {subject} (incomplete-pass endpoints): {count}.',
  'tf.playerLossesAreas': 'Pitch areas: {areas}.',
  'tf.playerLossesAttempts': 'Pass attempts: {attempts}.',
  'tf.teamLosses': 'Recorded possession losses for {subject} by pitch area: {areas}.',
  'tf.attacking': '{subject}: {items}.',
  'tf.involvement': '{subject} has {actions} recorded in this window.',
  'tf.statistics': 'The team figures for the selected window are shown with the statistics.',
  'tf.none': 'No recorded figures bear directly on this topic.',
  'area.defensive-third': 'defensive third',
  'area.middle-third': 'middle third',
  'area.final-third': 'final third',
  'area.item': '{area} {count}',
  'actions.one': '1 action',
  'actions.other': '{count} actions',
  'ctx.keeper': 'Shots on target are shown as context only; they do not measure the goalkeeper.',
  'ctx.possession': 'Possession context: {team} {value}% to {opponent} {opponentValue}%. This is context, not a measure of the claim.',
  'ctx.possessionNone': 'Possession shares are not available for context.',
  'ctx.pressure': 'Selected pressure observations: {team} {observations}, {opponent} {opponentObservations}. This is a partial sample used as context only.',
  'shape.defensive-shape': 'Defensive shape and positioning are not recorded.',
  'shape.pressure-progression': 'Pressure and progression are not measured as a whole; only selected observations are recorded.',
  'subj.lead': '“{quote}” is a broad judgement, and the records cannot settle it.',
  insufficient: '“{quote}” cannot be settled from the recorded data, so no verdict is given.',
  'pl.notYet': '{player} had not come on by this time.',
  'pl.unused': '{player} is an unused substitute, with no minutes in this window.',
  'pl.noActions': '{player} was on the pitch but has no recorded actions in this window.',
  'pl.participated': '{player} took part; no further figures are available here.',
  'pl.contrib': '{player}: {items}.',
  'pl.passes': '{completed} of {attempts} passes completed',
  'co.none': 'No possession-loss figures are available for this question.',
  'co.sample': 'Possession losses in the annotated build-up sample: {total}.',
  'co.all': 'Possession losses across all recorded passes: {total}.',
  'co.team': '{team}: {total} ({areas}).',
  'ev.possession': 'Possession',
  'ev.territorial-control': 'Territorial-control',
  'ev.shots': 'Shot',
  'ev.shots-on-target': 'Shots-on-target',
  'ev.goals': 'Goal',
  'ev.attacking-events': 'Attacking-event',
  'ev.player-events': 'Player-event',
  'ev.passing': 'Passing',
  'ev.possession-losses': 'Possession-loss',
  'ev.physical-measurements': 'Physical-measurement',
  'ev.build-up-phase': 'Build-up-phase annotation',
  'ev.lineups': 'Lineup',
  'ev.shot-location': 'Shot-location',
  'lim.clarification': 'The wording needs clarifying before it can be checked.',
  'lim.unavailableEvidence': '{kind} evidence is not recorded for this match.',
  'lim.metricNotRecorded': 'The requested metric is not recorded in this match’s data.',
  'lim.physicalCondition': 'Physical condition and fitness are not recorded, so no judgement is possible.',
  'lim.buildUpScope': 'Pass figures cannot be limited to build-up phases from the recorded data.',
  'lim.prediction': 'Predictions cannot be checked against events that have not been recorded.',
  'lim.interpreter': 'The local interpreter could not reliably identify the requested evidence, so no unrelated figures were used.',
  'lim.foreignTeam': 'A named team is not part of this match’s data, so no figures were used.',
  'lim.zeroAttempts': '{team} has no recorded shots, so a claim about every shot cannot be tested.',
  'lim.outcomes': 'Judged only on the recorded shot and goal outcomes for {subject}; chance quality is not recorded.',
  'lim.htFor.supports': '{goal} for {subject} supports the claim.',
  'lim.htFor.contradicts': '{goal} for {subject} contradicts the claim.',
  'lim.htGoal': 'A recorded first-half goal',
  'lim.htNoGoal': 'No recorded first-half goal',
  'lim.htUnsettled': 'The first half is not finished at the selected time, so the claim about {subject} cannot be settled yet.',
  'lim.passDescriptive': 'Pass figures are descriptive counts; they do not measure passing quality.',
  'lim.passCoverage': 'Pass coverage in this fixture is partial, so figures may understate the full match.',
  'lim.descriptiveOnly': 'These figures are descriptive only; no verdict is given.',
  'lim.noPassAttempts': 'No pass attempts are recorded in this window, so no completion rate can be calculated.',
  'lim.coachingSample': 'Based only on the annotated build-up sample. Teams: {subject}. Recorded possession losses (incomplete-pass endpoints): {total}. This is a partial sample, not complete match-wide evidence, and the locations do not establish tactical causes.',
  'lim.coachingAll': 'Counted across all recorded passes, not only build-up phases. Teams: {subject}. Recorded possession losses (incomplete-pass endpoints): {total}. The locations do not establish tactical causes.',
  'lim.topic': 'This is a broad judgement about {topic}; the recorded figures are context and do not give a verdict.',
  'lim.playerSparse': '{player} has few recorded actions, so these figures are thin evidence.',
  'lim.possessionShare': 'Recorded possession ({team} {value}% to {opponent} {opponentValue}%) is one measure and cannot settle a broad judgement by itself.',
  'lim.missingData': 'Missing data prevents a firm conclusion on “{quote}”.',
  'lim.contextOnly': 'The figures shown are context for “{quote}”, not a verdict.',
  'lim.noRelevant': 'No relevant recorded events were found in this window.',
  'lim.possessionCalc': 'Possession is calculated from clipped controlled intervals; contested and out-of-play time is excluded.',
  'lim.comparison': 'The comparison uses recorded counts only and does not establish quality or cause.',
  'lim.territory': 'Territorial control and chance quality are not recorded, so the claim cannot be settled.',
  'reason.metric-not-recorded': 'Metric not recorded',
  'reason.phase-scope-unavailable': 'Build-up phase scope is not available for this figure',
  'reason.interpreter-unreliable': 'Wording not reliably understood',
  'reason.prediction': 'Predictions cannot be checked',
  'reason.foreign-team': 'Team not in this match',
  'reason.needs-clarification': 'Needs clarification',
  'reason.player-not-in-fixture': 'Player not found in this match',
  'reason.player-choice': 'Choose which player you mean',
  'reason.no-attempts': 'No attempts recorded',
  'reason.coverage-incomplete': 'Record coverage is incomplete',
  'reason.not-yet-final': 'Not final at the selected time',
  'reason.player-not-yet-on-pitch': 'Player not yet on the pitch',
  'reason.player-unused-substitute': 'Unused substitute',
  'reason.sparse-player-records': 'Few recorded player actions',
  'reason.subjective-judgement': 'Broad judgement',
  'reason.no-relevant-events': 'No relevant events',
  'reason.insufficient-evidence': 'Insufficient evidence',
  'scope.match-so-far': 'Match so far, up to {clock}',
  'scope.last-10-minutes': 'Last 10 minutes, up to {clock}',
  'scope.beforeGoal': 'Before the {team} goal at {clock} (that goal and later events excluded)',
  'scope.firstHalf': 'First-half goals, checked at {clock}',
}

type DictKey = keyof typeof EN
type Dict = Record<DictKey, string>

const ES: Dict = {
  'v.supported': 'Respaldada',
  'v.contradicted': 'Contradicha',
  'v.unsettled': 'No hay evidencia suficiente para una conclusión firme',
  'v.none': 'Solo estadísticas, sin veredicto',
  'v.unavailable': 'Datos no registrados',
  'v.notUnderstood': 'No entendida',
  'v.clarify': 'Necesita aclaración',
  'v.unsupported': 'Tipo de respuesta no compatible',
  unsupported: 'Esta versión de la aplicación no admite este tipo de respuesta, así que no puede mostrarse aquí.',
  legacy: 'Esta respuesta se guardó antes de que existieran las respuestas estructuradas. Abajo se muestra el texto original en inglés; no se deducen identidades de jugadores ni de equipos.',
  legacySource: 'Texto original en inglés',
  notRecorded: 'no registrado',
  bothTeams: 'ambos equipos',
  'metric.physical-condition': 'El estado físico',
  'metric.shot-location': 'La ubicación de los tiros',
  'metric.territorial-control': 'El control territorial',
  'metric.build-up-pass-scope': 'Las cifras de pases limitadas a la fase de construcción',
  'unavail.metric': '{metric} no se registra en los datos de este partido, así que no hay cifra ni veredicto.',
  'unavail.generic': 'La medida solicitada no se registra en los datos de este partido, así que no hay cifra ni veredicto.',
  'unrec.interpreter': 'El intérprete local no puede identificar con fiabilidad la evidencia de fútbol solicitada, así que no se comprobó nada.',
  'unrec.prediction': 'Esto parece una predicción. Solo constan los eventos hasta {clock}, así que no puede comprobarse.',
  'unrec.foreign': 'No forma parte de los datos de este partido: {names}. No se comprobó nada.',
  clarification: 'La formulación «{quote}» necesita aclararse antes de poder comprobarse.',
  'claim.lead': 'Afirmación tal como se entendió: {text}.',
  'claim.some': '{subject} tuvo al menos {count}',
  'claim.none': '{subject} tuvo {count}',
  'claim.every': 'todos los tiros de {subject} fueron a puerta',
  'claim.notEvery': 'no todos los tiros de {subject} fueron a puerta',
  'claim.noneOnTarget': 'ninguno de los tiros de {subject} fue a puerta',
  'count.recorded': 'Registrado: {count}.',
  'count.recordedOf': 'Registrado: {count} de {total}.',
  'count.missing': 'No hay ninguna cifra registrada.',
  'count.noShots': 'No hay tiros registrados, así que no puede comprobarse una afirmación sobre todos los tiros.',
  'ht.claimScored': '{subject} marcó antes del descanso',
  'ht.claimDidNot': '{subject} no marcó antes del descanso',
  'ht.goal': 'Consta un gol de {subject} en la primera parte, en el {clock}.',
  'ht.none': 'No consta ningún gol de {subject} en la primera parte ya completada (comprobado en el {clock}).',
  'ht.open': 'La primera parte no ha terminado en el {clock}, así que aún podría registrarse un gol.',
  'focus.halfTime': 'goles antes del descanso',
  'focus.possession': 'posesión',
  'focus.passing': 'pases',
  'focus.attacking': 'ataque',
  'focus.involvement': 'participación registrada',
  'focus.events': 'eventos registrados del partido',
  'understood.entity': 'Una afirmación sobre {focus} de {entity}, comprobada con los datos sintéticos registrados del partido.',
  'understood.plain': 'Una afirmación sobre {focus}, comprobada con los datos sintéticos registrados del partido.',
  'hist.claim': 'Afirmación: «{quote}».',
  'hist.possession': 'Posesión registrada en el periodo comprobado: {team} {value}% frente a {opponent} {opponentValue}%, sobre {minutes} de juego controlado (sin contar el juego disputado ni el balón fuera de juego).',
  'hist.runOfPlay': 'El porcentaje de posesión por sí solo no establece el desarrollo del juego.',
  'dom.shares': '{team} tuvo el {value}% de la posesión registrada frente al {opponentValue}% de {opponent}.',
  'dom.supports': 'Esto apunta en el sentido de la afirmación, pero el porcentaje de posesión por sí solo no puede establecer dominio.',
  'dom.challenges': 'Esto apunta en contra de la afirmación, pero el porcentaje de posesión por sí solo no la resuelve.',
  'dom.level': 'La posesión está igualada, así que ni respalda ni cuestiona la afirmación.',
  'topic.lead': 'Tema: {topic}.',
  'topic.leadNegated': 'Tema: {topic} (la opinión está negada).',
  'topic.specific': 'Si quieres una cifra concreta, pide un recuento, como tiros o pases.',
  'topicname.overall-performance': 'rendimiento general',
  'topicname.involvement': 'participación',
  'topicname.passing-quality': 'calidad de pase',
  'topicname.possession-losses': 'pérdidas de posesión',
  'topicname.attacking-output': 'producción ofensiva',
  'topicname.finishing': 'definición',
  'topicname.defensive-approach': 'planteamiento defensivo',
  'topicname.pressure-progression': 'presión y progresión',
  'topicname.momentum': 'dinámica del partido',
  'topicname.physical-condition': 'estado físico',
  'topicname.prediction': 'predicción',
  'tf.passing': '{subject} completó {completions} de {attempts} pases registrados ({rate}).',
  'tf.passingNone': '{subject} no tiene intentos de pase registrados, así que no existe porcentaje de acierto.',
  'tf.passingUnknown': 'Las cifras de pase de {subject} no se registran.',
  'tf.playerLosses': 'Pérdidas de posesión registradas de {subject} (finales de pase fallido): {count}.',
  'tf.playerLossesAreas': 'Zonas del campo: {areas}.',
  'tf.playerLossesAttempts': 'Intentos de pase: {attempts}.',
  'tf.teamLosses': 'Pérdidas de posesión registradas de {subject} por zona del campo: {areas}.',
  'tf.attacking': '{subject}: {items}.',
  'tf.involvement': '{subject} tiene {actions} registradas en esta ventana.',
  'tf.statistics': 'Las cifras del equipo para el periodo elegido se muestran con las estadísticas.',
  'tf.none': 'No hay cifras registradas que afecten directamente a este tema.',
  'area.defensive-third': 'tercio defensivo',
  'area.middle-third': 'tercio medio',
  'area.final-third': 'tercio final',
  'area.item': '{area} {count}',
  'actions.one': '1 acción',
  'actions.other': '{count} acciones',
  'ctx.keeper': 'Los tiros a puerta se muestran solo como contexto; no miden al portero.',
  'ctx.possession': 'Contexto de posesión: {team} {value}% frente a {opponent} {opponentValue}%. Es contexto, no una medida de la afirmación.',
  'ctx.possessionNone': 'No hay porcentajes de posesión disponibles como contexto.',
  'ctx.pressure': 'Observaciones de presión seleccionadas: {team} {observations}, {opponent} {opponentObservations}. Es una muestra parcial usada solo como contexto.',
  'shape.defensive-shape': 'La forma defensiva y el posicionamiento no se registran.',
  'shape.pressure-progression': 'La presión y la progresión no se miden en conjunto; solo se registran observaciones seleccionadas.',
  'subj.lead': '«{quote}» es un juicio general y los registros no pueden resolverlo.',
  insufficient: '«{quote}» no puede resolverse con los datos registrados, así que no se da veredicto.',
  'pl.notYet': '{player} aún no había entrado en este momento.',
  'pl.unused': '{player} es suplente sin usar y no tiene minutos en esta ventana.',
  'pl.noActions': '{player} estuvo en el campo pero no tiene acciones registradas en esta ventana.',
  'pl.participated': '{player} participó; aquí no hay más cifras disponibles.',
  'pl.contrib': '{player}: {items}.',
  'pl.passes': '{completed} de {attempts} pases completados',
  'co.none': 'No hay cifras de pérdidas de posesión disponibles para esta pregunta.',
  'co.sample': 'Pérdidas de posesión en la muestra anotada de construcción: {total}.',
  'co.all': 'Pérdidas de posesión en todos los pases registrados: {total}.',
  'co.team': '{team}: {total} ({areas}).',
  'ev.possession': 'La evidencia de posesión',
  'ev.territorial-control': 'La evidencia de control territorial',
  'ev.shots': 'La evidencia de tiros',
  'ev.shots-on-target': 'La evidencia de tiros a puerta',
  'ev.goals': 'La evidencia de goles',
  'ev.attacking-events': 'La evidencia de eventos ofensivos',
  'ev.player-events': 'La evidencia de acciones de jugadores',
  'ev.passing': 'La evidencia de pases',
  'ev.possession-losses': 'La evidencia de pérdidas de posesión',
  'ev.physical-measurements': 'La evidencia de mediciones físicas',
  'ev.build-up-phase': 'La evidencia de anotaciones de fase de construcción',
  'ev.lineups': 'La evidencia de alineaciones',
  'ev.shot-location': 'La evidencia de ubicación de tiros',
  'lim.clarification': 'La formulación necesita aclararse antes de poder comprobarse.',
  'lim.unavailableEvidence': 'Sin registro para este partido: {kind}.',
  'lim.metricNotRecorded': 'La métrica solicitada no se registra en los datos de este partido.',
  'lim.physicalCondition': 'El estado físico y la condición no se registran, así que no es posible ningún juicio.',
  'lim.buildUpScope': 'Las cifras de pases no pueden limitarse a la fase de construcción con los datos registrados.',
  'lim.prediction': 'Las predicciones no pueden comprobarse con eventos que aún no se han registrado.',
  'lim.interpreter': 'El intérprete local no pudo identificar con fiabilidad la evidencia solicitada, así que no se usaron cifras sin relación.',
  'lim.foreignTeam': 'Un equipo mencionado no forma parte de los datos de este partido, así que no se usaron cifras.',
  'lim.zeroAttempts': '{team} no tiene tiros registrados, así que no puede comprobarse una afirmación sobre todos los tiros.',
  'lim.outcomes': 'Se juzga solo por los resultados registrados de tiros y goles de {subject}; la calidad de las ocasiones no se registra.',
  'lim.htFor.supports': '{goal} de {subject} respalda la afirmación.',
  'lim.htFor.contradicts': '{goal} de {subject} contradice la afirmación.',
  'lim.htGoal': 'Un gol registrado en la primera parte',
  'lim.htNoGoal': 'La ausencia de un gol registrado en la primera parte',
  'lim.htUnsettled': 'La primera parte no ha terminado en el momento elegido, así que la afirmación sobre {subject} aún no puede resolverse.',
  'lim.passDescriptive': 'Las cifras de pases son recuentos descriptivos; no miden la calidad del pase.',
  'lim.passCoverage': 'La cobertura de pases de este partido es parcial, así que las cifras pueden quedarse cortas respecto al partido completo.',
  'lim.descriptiveOnly': 'Estas cifras son solo descriptivas; no se da veredicto.',
  'lim.noPassAttempts': 'No hay intentos de pase registrados en esta ventana, así que no puede calcularse un porcentaje de acierto.',
  'lim.coachingSample': 'Basado solo en la muestra anotada de construcción. Equipos: {subject}. Pérdidas de posesión registradas (finales de pase fallido): {total}. Es una muestra parcial, no evidencia completa de todo el partido, y las ubicaciones no establecen causas tácticas.',
  'lim.coachingAll': 'Recuento sobre todos los pases registrados, no solo de la fase de construcción. Equipos: {subject}. Pérdidas de posesión registradas (finales de pase fallido): {total}. Las ubicaciones no establecen causas tácticas.',
  'lim.topic': 'Es un juicio general sobre {topic}; las cifras registradas son contexto y no dan un veredicto.',
  'lim.playerSparse': '{player} tiene pocas acciones registradas, así que estas cifras son una evidencia escasa.',
  'lim.possessionShare': 'La posesión registrada ({team} {value}% frente a {opponent} {opponentValue}%) es una medida y no puede resolver por sí sola un juicio general.',
  'lim.missingData': 'La falta de datos impide una conclusión firme sobre «{quote}».',
  'lim.contextOnly': 'Las cifras mostradas son contexto para «{quote}», no un veredicto.',
  'lim.noRelevant': 'No se encontraron eventos registrados relevantes en esta ventana.',
  'lim.possessionCalc': 'La posesión se calcula con intervalos controlados recortados; se excluye el tiempo disputado y con el balón fuera de juego.',
  'lim.comparison': 'La comparación usa solo recuentos registrados y no establece calidad ni causa.',
  'lim.territory': 'El control territorial y la calidad de las ocasiones no se registran, así que la afirmación no puede resolverse.',
  'reason.metric-not-recorded': 'Métrica no registrada',
  'reason.phase-scope-unavailable': 'El alcance de la fase de construcción no está disponible para esta cifra',
  'reason.interpreter-unreliable': 'Formulación no entendida con fiabilidad',
  'reason.prediction': 'Las predicciones no pueden comprobarse',
  'reason.foreign-team': 'Equipo que no está en este partido',
  'reason.needs-clarification': 'Necesita aclaración',
  'reason.player-not-in-fixture': 'Jugador no encontrado en este partido',
  'reason.player-choice': 'Elige a qué jugador te refieres',
  'reason.no-attempts': 'Sin intentos registrados',
  'reason.coverage-incomplete': 'Cobertura de registros incompleta',
  'reason.not-yet-final': 'No es definitivo en el momento elegido',
  'reason.player-not-yet-on-pitch': 'El jugador aún no ha entrado al campo',
  'reason.player-unused-substitute': 'Suplente sin usar',
  'reason.sparse-player-records': 'Pocas acciones registradas del jugador',
  'reason.subjective-judgement': 'Juicio general',
  'reason.no-relevant-events': 'Sin eventos relevantes',
  'reason.insufficient-evidence': 'Evidencia insuficiente',
  'scope.match-so-far': 'El partido hasta ahora, hasta el {clock}',
  'scope.last-10-minutes': 'Los últimos 10 minutos, hasta el {clock}',
  'scope.beforeGoal': 'Antes del gol de {team} en el {clock} (se excluyen ese gol y los eventos posteriores)',
  'scope.firstHalf': 'Goles de la primera parte, comprobados en el {clock}',
}

const FR: Dict = {
  'v.supported': 'Confirmée',
  'v.contradicted': 'Contredite',
  'v.unsettled': 'Pas assez d’éléments pour une conclusion ferme',
  'v.none': 'Statistiques seulement, sans verdict',
  'v.unavailable': 'Données non enregistrées',
  'v.notUnderstood': 'Non comprise',
  'v.clarify': 'À préciser',
  'v.unsupported': 'Type de réponse non pris en charge',
  unsupported: 'Cette version de l’application ne prend pas en charge ce type de réponse ; elle ne peut donc pas être affichée ici.',
  legacy: 'Cette réponse a été enregistrée avant l’existence des réponses structurées. Le texte source d’origine en anglais est affiché ci-dessous ; les identités des joueurs et des équipes ne sont pas déduites.',
  legacySource: 'Texte source d’origine en anglais',
  notRecorded: 'non enregistré',
  bothTeams: 'les deux équipes',
  'metric.physical-condition': 'La condition physique',
  'metric.shot-location': 'L’emplacement des tirs',
  'metric.territorial-control': 'Le contrôle du terrain',
  'metric.build-up-pass-scope': 'Les chiffres de passes limités aux phases de construction',
  'unavail.metric': '{metric} : donnée non enregistrée dans ce match, donc ni chiffre ni verdict.',
  'unavail.generic': 'La mesure demandée n’est pas enregistrée dans les données de ce match ; il n’y a donc ni chiffre ni verdict.',
  'unrec.interpreter': 'L’interpréteur local ne peut pas identifier de façon fiable les éléments de football demandés ; rien n’a donc été vérifié.',
  'unrec.prediction': 'Cela ressemble à une prédiction. Seuls les événements jusqu’à {clock} sont enregistrés ; elle ne peut donc pas être vérifiée.',
  'unrec.foreign': 'Ne fait pas partie des données de ce match : {names}. Rien n’a été vérifié.',
  clarification: 'La formulation « {quote} » doit être précisée avant de pouvoir être vérifiée.',
  'claim.lead': 'Affirmation telle que comprise : {text}.',
  'claim.some': '{subject} a eu au moins {count}',
  'claim.none': '{subject} a eu {count}',
  'claim.every': 'tous les tirs de {subject} ont été cadrés',
  'claim.notEvery': 'tous les tirs de {subject} n’ont pas été cadrés',
  'claim.noneOnTarget': 'aucun des tirs de {subject} n’a été cadré',
  'count.recorded': 'Enregistré : {count}.',
  'count.recordedOf': 'Enregistré : {count} sur {total}.',
  'count.missing': 'Aucun chiffre enregistré n’est disponible.',
  'count.noShots': 'Aucun tir n’est enregistré ; une affirmation sur tous les tirs ne peut donc pas être vérifiée.',
  'ht.claimScored': '{subject} a marqué avant la mi-temps',
  'ht.claimDidNot': '{subject} n’a pas marqué avant la mi-temps',
  'ht.goal': 'Un but de {subject} en première mi-temps est enregistré à {clock}.',
  'ht.none': 'Aucun but de {subject} n’est enregistré dans la première mi-temps terminée (vérifié à {clock}).',
  'ht.open': 'La première mi-temps n’est pas terminée à {clock} ; un but pourrait donc encore être enregistré.',
  'focus.halfTime': 'les buts avant la mi-temps',
  'focus.possession': 'la possession',
  'focus.passing': 'les passes',
  'focus.attacking': 'l’attaque',
  'focus.involvement': 'la participation enregistrée',
  'focus.events': 'les événements enregistrés du match',
  'understood.entity': 'Une affirmation sur {focus} pour {entity}, vérifiée avec les données synthétiques enregistrées du match.',
  'understood.plain': 'Une affirmation sur {focus}, vérifiée avec les données synthétiques enregistrées du match.',
  'hist.claim': 'Affirmation : « {quote} ».',
  'hist.possession': 'Possession enregistrée sur la période vérifiée : {team} {value}% contre {opponent} {opponentValue}%, sur {minutes} de jeu contrôlé (jeu disputé et ballon hors jeu exclus).',
  'hist.runOfPlay': 'Le taux de possession seul n’établit pas le déroulement du jeu.',
  'dom.shares': '{team} a eu {value}% de la possession enregistrée contre {opponentValue}% pour {opponent}.',
  'dom.supports': 'Cela va dans le sens de l’affirmation, mais le taux de possession seul ne peut pas établir une domination.',
  'dom.challenges': 'Cela va à l’encontre de l’affirmation, mais le taux de possession seul ne peut pas trancher.',
  'dom.level': 'La possession est à égalité ; elle ne confirme ni ne contredit l’affirmation.',
  'topic.lead': 'Sujet : {topic}.',
  'topic.leadNegated': 'Sujet : {topic} (l’avis est formulé à la forme négative).',
  'topic.specific': 'Si vous voulez un chiffre précis, demandez un décompte, par exemple de tirs ou de passes.',
  'topicname.overall-performance': 'performance globale',
  'topicname.involvement': 'implication',
  'topicname.passing-quality': 'qualité de passe',
  'topicname.possession-losses': 'pertes de balle',
  'topicname.attacking-output': 'production offensive',
  'topicname.finishing': 'finition',
  'topicname.defensive-approach': 'approche défensive',
  'topicname.pressure-progression': 'pressing et progression',
  'topicname.momentum': 'dynamique du match',
  'topicname.physical-condition': 'condition physique',
  'topicname.prediction': 'prédiction',
  'tf.passing': '{subject} a réussi {completions} passes sur {attempts} enregistrées ({rate}).',
  'tf.passingNone': '{subject} n’a aucune tentative de passe enregistrée ; il n’existe donc pas de taux de réussite.',
  'tf.passingUnknown': 'Les chiffres de passes de {subject} ne sont pas enregistrés.',
  'tf.playerLosses': 'Pertes de balle enregistrées pour {subject} (passes manquées) : {count}.',
  'tf.playerLossesAreas': 'Zones du terrain : {areas}.',
  'tf.playerLossesAttempts': 'Tentatives de passe : {attempts}.',
  'tf.teamLosses': 'Pertes de balle enregistrées pour {subject} par zone du terrain : {areas}.',
  'tf.attacking': '{subject} : {items}.',
  'tf.involvement': '{subject} compte {actions} enregistrées dans cette fenêtre.',
  'tf.statistics': 'Les chiffres de l’équipe pour la période choisie sont affichés avec les statistiques.',
  'tf.none': 'Aucun chiffre enregistré ne concerne directement ce sujet.',
  'area.defensive-third': 'tiers défensif',
  'area.middle-third': 'tiers médian',
  'area.final-third': 'dernier tiers',
  'area.item': '{area} {count}',
  'actions.one': '1 action',
  'actions.other': '{count} actions',
  'ctx.keeper': 'Les tirs cadrés sont affichés à titre de contexte seulement ; ils ne mesurent pas le gardien.',
  'ctx.possession': 'Contexte de possession : {team} {value}% contre {opponent} {opponentValue}%. C’est un contexte, pas une mesure de l’affirmation.',
  'ctx.possessionNone': 'Les parts de possession ne sont pas disponibles comme contexte.',
  'ctx.pressure': 'Observations de pressing sélectionnées : {team} {observations}, {opponent} {opponentObservations}. Il s’agit d’un échantillon partiel utilisé comme contexte seulement.',
  'shape.defensive-shape': 'L’organisation défensive et le placement ne sont pas enregistrés.',
  'shape.pressure-progression': 'Le pressing et la progression ne sont pas mesurés dans leur ensemble ; seules des observations sélectionnées sont enregistrées.',
  'subj.lead': '« {quote} » est un jugement général que les données ne permettent pas de trancher.',
  insufficient: '« {quote} » ne peut pas être tranché à partir des données enregistrées ; aucun verdict n’est donné.',
  'pl.notYet': '{player} n’était pas encore entré en jeu à ce moment.',
  'pl.unused': '{player} est remplaçant non utilisé, sans minute dans cette fenêtre.',
  'pl.noActions': '{player} était sur le terrain mais n’a aucune action enregistrée dans cette fenêtre.',
  'pl.participated': '{player} a participé ; aucun autre chiffre n’est disponible ici.',
  'pl.contrib': '{player} : {items}.',
  'pl.passes': '{completed} passes réussies sur {attempts}',
  'co.none': 'Aucun chiffre de pertes de balle n’est disponible pour cette question.',
  'co.sample': 'Pertes de balle dans l’échantillon annoté de construction : {total}.',
  'co.all': 'Pertes de balle sur l’ensemble des passes enregistrées : {total}.',
  'co.team': '{team} : {total} ({areas}).',
  'ev.possession': 'Les éléments de possession',
  'ev.territorial-control': 'Les éléments de contrôle du terrain',
  'ev.shots': 'Les éléments sur les tirs',
  'ev.shots-on-target': 'Les éléments sur les tirs cadrés',
  'ev.goals': 'Les éléments sur les buts',
  'ev.attacking-events': 'Les éléments sur les actions offensives',
  'ev.player-events': 'Les éléments sur les actions des joueurs',
  'ev.passing': 'Les éléments sur les passes',
  'ev.possession-losses': 'Les éléments sur les pertes de balle',
  'ev.physical-measurements': 'Les mesures physiques',
  'ev.build-up-phase': 'Les annotations de phase de construction',
  'ev.lineups': 'Les éléments sur les compositions',
  'ev.shot-location': 'Les éléments sur l’emplacement des tirs',
  'lim.clarification': 'La formulation doit être précisée avant de pouvoir être vérifiée.',
  'lim.unavailableEvidence': 'Non enregistré pour ce match : {kind}.',
  'lim.metricNotRecorded': 'La mesure demandée n’est pas enregistrée dans les données de ce match.',
  'lim.physicalCondition': 'La condition physique n’est pas enregistrée ; aucun jugement n’est donc possible.',
  'lim.buildUpScope': 'Les chiffres de passes ne peuvent pas être limités aux phases de construction avec les données enregistrées.',
  'lim.prediction': 'Les prédictions ne peuvent pas être vérifiées avec des événements qui n’ont pas encore été enregistrés.',
  'lim.interpreter': 'L’interpréteur local n’a pas pu identifier de façon fiable les éléments demandés ; aucun chiffre sans rapport n’a donc été utilisé.',
  'lim.foreignTeam': 'Une équipe citée ne fait pas partie des données de ce match ; aucun chiffre n’a donc été utilisé.',
  'lim.zeroAttempts': '{team} n’a aucun tir enregistré ; une affirmation sur tous les tirs ne peut donc pas être vérifiée.',
  'lim.outcomes': 'Jugé uniquement sur les résultats enregistrés des tirs et des buts de {subject} ; la qualité des occasions n’est pas enregistrée.',
  'lim.htFor.supports': '{goal} de {subject} confirme l’affirmation.',
  'lim.htFor.contradicts': '{goal} de {subject} contredit l’affirmation.',
  'lim.htGoal': 'Un but enregistré en première mi-temps',
  'lim.htNoGoal': 'L’absence de but enregistré en première mi-temps',
  'lim.htUnsettled': 'La première mi-temps n’est pas terminée au moment choisi ; l’affirmation sur {subject} ne peut donc pas encore être tranchée.',
  'lim.passDescriptive': 'Les chiffres de passes sont des décomptes descriptifs ; ils ne mesurent pas la qualité de passe.',
  'lim.passCoverage': 'La couverture des passes de ce match est partielle ; les chiffres peuvent donc sous-estimer le match complet.',
  'lim.descriptiveOnly': 'Ces chiffres sont descriptifs seulement ; aucun verdict n’est donné.',
  'lim.noPassAttempts': 'Aucune tentative de passe n’est enregistrée dans cette fenêtre ; aucun taux de réussite ne peut donc être calculé.',
  'lim.coachingSample': 'Fondé uniquement sur l’échantillon annoté de construction. Équipes : {subject}. Pertes de balle enregistrées (passes manquées) : {total}. Il s’agit d’un échantillon partiel, pas d’une preuve complète sur tout le match, et les emplacements n’établissent pas de causes tactiques.',
  'lim.coachingAll': 'Décompte sur toutes les passes enregistrées, pas seulement les phases de construction. Équipes : {subject}. Pertes de balle enregistrées (passes manquées) : {total}. Les emplacements n’établissent pas de causes tactiques.',
  'lim.topic': 'Il s’agit d’un jugement général (sujet : {topic}) ; les chiffres enregistrés sont un contexte et ne donnent pas de verdict.',
  'lim.playerSparse': '{player} a peu d’actions enregistrées ; ces chiffres constituent donc un élément de preuve mince.',
  'lim.possessionShare': 'La possession enregistrée ({team} {value}% contre {opponent} {opponentValue}%) est une mesure parmi d’autres et ne peut pas trancher seule un jugement général.',
  'lim.missingData': 'Le manque de données empêche une conclusion ferme sur « {quote} ».',
  'lim.contextOnly': 'Les chiffres affichés sont un contexte pour « {quote} », pas un verdict.',
  'lim.noRelevant': 'Aucun événement enregistré pertinent n’a été trouvé dans cette fenêtre.',
  'lim.possessionCalc': 'La possession est calculée à partir d’intervalles contrôlés tronqués ; le temps disputé et le ballon hors jeu sont exclus.',
  'lim.comparison': 'La comparaison utilise uniquement des décomptes enregistrés et n’établit ni qualité ni cause.',
  'lim.territory': 'Le contrôle du terrain et la qualité des occasions ne sont pas enregistrés ; l’affirmation ne peut donc pas être tranchée.',
  'reason.metric-not-recorded': 'Mesure non enregistrée',
  'reason.phase-scope-unavailable': 'La portée de la phase de construction n’est pas disponible pour ce chiffre',
  'reason.interpreter-unreliable': 'Formulation non comprise de façon fiable',
  'reason.prediction': 'Les prédictions ne peuvent pas être vérifiées',
  'reason.foreign-team': 'Équipe absente de ce match',
  'reason.needs-clarification': 'À préciser',
  'reason.player-not-in-fixture': 'Joueur introuvable dans ce match',
  'reason.player-choice': 'Choisissez le joueur visé',
  'reason.no-attempts': 'Aucune tentative enregistrée',
  'reason.coverage-incomplete': 'Couverture des données incomplète',
  'reason.not-yet-final': 'Pas encore définitif au moment choisi',
  'reason.player-not-yet-on-pitch': 'Joueur pas encore sur le terrain',
  'reason.player-unused-substitute': 'Remplaçant non utilisé',
  'reason.sparse-player-records': 'Peu d’actions enregistrées pour le joueur',
  'reason.subjective-judgement': 'Jugement général',
  'reason.no-relevant-events': 'Aucun événement pertinent',
  'reason.insufficient-evidence': 'Éléments insuffisants',
  'scope.match-so-far': 'Match jusqu’ici, jusqu’à {clock}',
  'scope.last-10-minutes': 'Les 10 dernières minutes, jusqu’à {clock}',
  'scope.beforeGoal': 'Avant le but de {team} à {clock} (ce but et les événements suivants exclus)',
  'scope.firstHalf': 'Buts de la première mi-temps, vérifiés à {clock}',
}

const DE: Dict = {
  'v.supported': 'Bestätigt',
  'v.contradicted': 'Widerlegt',
  'v.unsettled': 'Nicht genug Belege für ein sicheres Fazit',
  'v.none': 'Nur Statistik, kein Urteil',
  'v.unavailable': 'Daten nicht erfasst',
  'v.notUnderstood': 'Nicht verstanden',
  'v.clarify': 'Klärung nötig',
  'v.unsupported': 'Nicht unterstützter Antworttyp',
  unsupported: 'Dieser Antworttyp wird von dieser Version der App nicht unterstützt und kann hier nicht angezeigt werden.',
  legacy: 'Diese Antwort wurde gespeichert, bevor es strukturierte Antworten gab. Unten steht der englische Originaltext; Identitäten von Spielern und Teams werden nicht abgeleitet.',
  legacySource: 'Englischer Originaltext',
  notRecorded: 'nicht erfasst',
  bothTeams: 'beide Teams',
  'metric.physical-condition': 'Die körperliche Verfassung',
  'metric.shot-location': 'Der Ort der Schüsse',
  'metric.territorial-control': 'Die Raumkontrolle',
  'metric.build-up-pass-scope': 'Auf den Spielaufbau begrenzte Passzahlen',
  'unavail.metric': '{metric} wird in den Daten dieses Spiels nicht erfasst, daher gibt es weder eine Zahl noch ein Urteil.',
  'unavail.generic': 'Die gewünschte Größe wird in den Daten dieses Spiels nicht erfasst, daher gibt es weder eine Zahl noch ein Urteil.',
  'unrec.interpreter': 'Der lokale Interpreter kann die gewünschten Fußballbelege nicht zuverlässig erkennen, daher wurde nichts geprüft.',
  'unrec.prediction': 'Das klingt nach einer Prognose. Nur Ereignisse bis {clock} sind erfasst, daher lässt sie sich nicht prüfen.',
  'unrec.foreign': 'Nicht Teil der Daten dieses Spiels: {names}. Es wurde nichts geprüft.',
  clarification: 'Die Formulierung „{quote}“ muss geklärt werden, bevor sie geprüft werden kann.',
  'claim.lead': 'Aussage, wie sie verstanden wurde: {text}.',
  'claim.some': '{subject} hatte mindestens {count}',
  'claim.none': '{subject} hatte {count}',
  'claim.every': 'jeder Schuss von {subject} ging aufs Tor',
  'claim.notEvery': 'nicht jeder Schuss von {subject} ging aufs Tor',
  'claim.noneOnTarget': 'keiner der Schüsse von {subject} ging aufs Tor',
  'count.recorded': 'Erfasst: {count}.',
  'count.recordedOf': 'Erfasst: {count} bei insgesamt {totalNumber} Schüssen.',
  'count.missing': 'Es liegt keine erfasste Zahl vor.',
  'count.noShots': 'Es sind keine Schüsse erfasst, daher lässt sich eine Aussage über jeden Schuss nicht prüfen.',
  'ht.claimScored': '{subject} traf vor der Halbzeit',
  'ht.claimDidNot': '{subject} traf nicht vor der Halbzeit',
  'ht.goal': 'Ein Tor von {subject} in der ersten Halbzeit ist bei {clock} erfasst.',
  'ht.none': 'In der abgeschlossenen ersten Halbzeit ist kein Tor von {subject} erfasst (geprüft bei {clock}).',
  'ht.open': 'Die erste Halbzeit ist bei {clock} noch nicht vorbei, daher könnte noch ein Tor erfasst werden.',
  'focus.halfTime': 'Tore vor der Halbzeit',
  'focus.possession': 'Ballbesitz',
  'focus.passing': 'Pässe',
  'focus.attacking': 'Angriff',
  'focus.involvement': 'erfasste Beteiligung',
  'focus.events': 'erfasste Spielereignisse',
  'understood.entity': 'Eine Behauptung zu {focus} von {entity}, geprüft anhand der erfassten synthetischen Spieldaten.',
  'understood.plain': 'Eine Behauptung zu {focus}, geprüft anhand der erfassten synthetischen Spieldaten.',
  'hist.claim': 'Aussage: „{quote}“.',
  'hist.possession': 'Erfasster Ballbesitz im geprüften Zeitraum: {team} {value}% gegenüber {opponent} {opponentValue}%, aus {minutes} kontrolliertem Spiel (umkämpfte und Aus-Zeiten ausgenommen).',
  'hist.runOfPlay': 'Der Ballbesitzanteil allein belegt den Spielverlauf nicht.',
  'dom.shares': '{team} hatte {value}% des erfassten Ballbesitzes gegenüber {opponentValue}% bei {opponent}.',
  'dom.supports': 'Das spricht eher für die Aussage, doch der Ballbesitzanteil allein kann Dominanz nicht belegen.',
  'dom.challenges': 'Das spricht eher gegen die Aussage, doch der Ballbesitzanteil allein kann sie nicht klären.',
  'dom.level': 'Der Ballbesitz ist ausgeglichen und stützt die Aussage daher weder noch stellt er sie infrage.',
  'topic.lead': 'Thema: {topic}.',
  'topic.leadNegated': 'Thema: {topic} (die Meinung ist verneint).',
  'topic.specific': 'Wenn du eine konkrete Zahl möchtest, frage nach einer Anzahl, etwa Schüsse oder Pässe.',
  'topicname.overall-performance': 'Gesamtleistung',
  'topicname.involvement': 'Einbindung',
  'topicname.passing-quality': 'Passqualität',
  'topicname.possession-losses': 'Ballverluste',
  'topicname.attacking-output': 'Offensivleistung',
  'topicname.finishing': 'Abschluss',
  'topicname.defensive-approach': 'Defensivverhalten',
  'topicname.pressure-progression': 'Druck und Vorwärtsspiel',
  'topicname.momentum': 'Spielfluss',
  'topicname.physical-condition': 'körperliche Verfassung',
  'topicname.prediction': 'Prognose',
  'tf.passing': '{subject} spielte {completions} von {attempts} erfassten Pässen erfolgreich ({rate}).',
  'tf.passingNone': 'Für {subject} sind keine Passversuche erfasst, daher gibt es keine Passquote.',
  'tf.passingUnknown': 'Passzahlen von {subject} sind nicht erfasst.',
  'tf.playerLosses': 'Erfasste Ballverluste von {subject} (missglückte Pässe): {count}.',
  'tf.playerLossesAreas': 'Spielfeldzonen: {areas}.',
  'tf.playerLossesAttempts': 'Passversuche: {attempts}.',
  'tf.teamLosses': 'Erfasste Ballverluste von {subject} nach Spielfeldzone: {areas}.',
  'tf.attacking': '{subject}: {items}.',
  'tf.involvement': '{subject} hat {actions} in diesem Zeitfenster erfasst.',
  'tf.statistics': 'Die Teamzahlen für den gewählten Zeitraum stehen bei den Statistiken.',
  'tf.none': 'Keine erfassten Zahlen betreffen dieses Thema unmittelbar.',
  'area.defensive-third': 'Defensivdrittel',
  'area.middle-third': 'Mitteldrittel',
  'area.final-third': 'Angriffsdrittel',
  'area.item': '{area} {count}',
  'actions.one': '1 Aktion',
  'actions.other': '{count} Aktionen',
  'ctx.keeper': 'Schüsse aufs Tor werden nur als Kontext gezeigt; sie messen den Torhüter nicht.',
  'ctx.possession': 'Ballbesitz-Kontext: {team} {value}% gegenüber {opponent} {opponentValue}%. Das ist Kontext, kein Maß für die Aussage.',
  'ctx.possessionNone': 'Ballbesitzanteile sind als Kontext nicht verfügbar.',
  'ctx.pressure': 'Ausgewählte Pressing-Beobachtungen: {team} {observations}, {opponent} {opponentObservations}. Das ist eine Teilstichprobe und dient nur als Kontext.',
  'shape.defensive-shape': 'Defensivformation und Positionierung werden nicht erfasst.',
  'shape.pressure-progression': 'Druck und Vorwärtsspiel werden nicht als Ganzes gemessen; nur ausgewählte Beobachtungen sind erfasst.',
  'subj.lead': '„{quote}“ ist ein allgemeines Urteil, das sich mit den Daten nicht klären lässt.',
  insufficient: '„{quote}“ lässt sich mit den erfassten Daten nicht klären, daher gibt es kein Urteil.',
  'pl.notYet': '{player} war zu diesem Zeitpunkt noch nicht eingewechselt.',
  'pl.unused': '{player} ist nicht eingesetzter Ersatzspieler und hat in diesem Zeitfenster keine Minuten.',
  'pl.noActions': '{player} stand auf dem Platz, hat in diesem Zeitfenster aber keine erfassten Aktionen.',
  'pl.participated': '{player} war beteiligt; weitere Zahlen liegen hier nicht vor.',
  'pl.contrib': '{player}: {items}.',
  'pl.passes': '{completed} von {attempts} Pässen angekommen',
  'co.none': 'Für diese Frage liegen keine Zahlen zu Ballverlusten vor.',
  'co.sample': 'Ballverluste in der annotierten Aufbau-Stichprobe: {total}.',
  'co.all': 'Ballverluste über alle erfassten Pässe: {total}.',
  'co.team': '{team}: {total} ({areas}).',
  'ev.possession': 'Ballbesitz-Belege',
  'ev.territorial-control': 'Belege zur Raumkontrolle',
  'ev.shots': 'Schuss-Belege',
  'ev.shots-on-target': 'Belege zu Schüssen aufs Tor',
  'ev.goals': 'Tor-Belege',
  'ev.attacking-events': 'Belege zu Offensivaktionen',
  'ev.player-events': 'Belege zu Spieleraktionen',
  'ev.passing': 'Pass-Belege',
  'ev.possession-losses': 'Belege zu Ballverlusten',
  'ev.physical-measurements': 'Körperliche Messwerte',
  'ev.build-up-phase': 'Annotationen zur Aufbauphase',
  'ev.lineups': 'Aufstellungs-Belege',
  'ev.shot-location': 'Belege zum Schussort',
  'lim.clarification': 'Die Formulierung muss geklärt werden, bevor sie geprüft werden kann.',
  'lim.unavailableEvidence': 'Für dieses Spiel nicht erfasst: {kind}.',
  'lim.metricNotRecorded': 'Die gewünschte Größe wird in den Daten dieses Spiels nicht erfasst.',
  'lim.physicalCondition': 'Körperliche Verfassung und Fitness werden nicht erfasst, daher ist kein Urteil möglich.',
  'lim.buildUpScope': 'Passzahlen lassen sich mit den erfassten Daten nicht auf den Spielaufbau begrenzen.',
  'lim.prediction': 'Prognosen lassen sich nicht mit Ereignissen prüfen, die noch nicht erfasst sind.',
  'lim.interpreter': 'Der lokale Interpreter konnte die gewünschten Belege nicht zuverlässig erkennen, daher wurden keine unbeteiligten Zahlen verwendet.',
  'lim.foreignTeam': 'Ein genanntes Team gehört nicht zu den Daten dieses Spiels, daher wurden keine Zahlen verwendet.',
  'lim.zeroAttempts': 'Für {team} sind keine Schüsse erfasst, daher lässt sich eine Aussage über jeden Schuss nicht prüfen.',
  'lim.outcomes': 'Beurteilt nur nach den erfassten Schuss- und Torergebnissen von {subject}; die Chancenqualität wird nicht erfasst.',
  'lim.htFor.supports': '{goal} von {subject} stützt die Aussage.',
  'lim.htFor.contradicts': '{goal} von {subject} widerlegt die Aussage.',
  'lim.htGoal': 'Ein erfasstes Tor in der ersten Halbzeit',
  'lim.htNoGoal': 'Das Fehlen eines erfassten Tores in der ersten Halbzeit',
  'lim.htUnsettled': 'Die erste Halbzeit ist zum gewählten Zeitpunkt nicht beendet, daher lässt sich die Aussage über {subject} noch nicht klären.',
  'lim.passDescriptive': 'Passzahlen sind beschreibende Zählungen; sie messen die Passqualität nicht.',
  'lim.passCoverage': 'Die Passabdeckung in diesem Spiel ist teilweise, daher können die Zahlen das gesamte Spiel unterschätzen.',
  'lim.descriptiveOnly': 'Diese Zahlen sind nur beschreibend; es gibt kein Urteil.',
  'lim.noPassAttempts': 'In diesem Zeitfenster sind keine Passversuche erfasst, daher lässt sich keine Passquote berechnen.',
  'lim.coachingSample': 'Nur auf Basis der annotierten Aufbau-Stichprobe. Teams: {subject}. Erfasste Ballverluste (missglückte Pässe): {total}. Das ist eine Teilstichprobe und kein vollständiger Beleg für das ganze Spiel; die Orte belegen keine taktischen Ursachen.',
  'lim.coachingAll': 'Gezählt über alle erfassten Pässe, nicht nur in der Aufbauphase. Teams: {subject}. Erfasste Ballverluste (missglückte Pässe): {total}. Die Orte belegen keine taktischen Ursachen.',
  'lim.topic': 'Das ist ein allgemeines Urteil über {topic}; die erfassten Zahlen sind Kontext und ergeben kein Urteil.',
  'lim.playerSparse': 'Für {player} sind nur wenige Aktionen erfasst, daher sind diese Zahlen ein dünner Beleg.',
  'lim.possessionShare': 'Der erfasste Ballbesitz ({team} {value}% gegenüber {opponent} {opponentValue}%) ist eine Messgröße und kann ein allgemeines Urteil nicht allein klären.',
  'lim.missingData': 'Fehlende Daten verhindern ein sicheres Fazit zu „{quote}“.',
  'lim.contextOnly': 'Die gezeigten Zahlen sind Kontext zu „{quote}“, kein Urteil.',
  'lim.noRelevant': 'In diesem Zeitfenster wurden keine relevanten erfassten Ereignisse gefunden.',
  'lim.possessionCalc': 'Der Ballbesitz wird aus beschnittenen kontrollierten Intervallen berechnet; umkämpfte und Aus-Zeiten sind ausgenommen.',
  'lim.comparison': 'Der Vergleich nutzt nur erfasste Zählungen und belegt weder Qualität noch Ursache.',
  'lim.territory': 'Raumkontrolle und Chancenqualität werden nicht erfasst, daher lässt sich die Aussage nicht klären.',
  'reason.metric-not-recorded': 'Größe nicht erfasst',
  'reason.phase-scope-unavailable': 'Der Aufbauphasen-Bezug ist für diese Zahl nicht verfügbar',
  'reason.interpreter-unreliable': 'Formulierung nicht zuverlässig verstanden',
  'reason.prediction': 'Prognosen lassen sich nicht prüfen',
  'reason.foreign-team': 'Team nicht in diesem Spiel',
  'reason.needs-clarification': 'Klärung nötig',
  'reason.player-not-in-fixture': 'Spieler in diesem Spiel nicht gefunden',
  'reason.player-choice': 'Wähle den gemeinten Spieler',
  'reason.no-attempts': 'Keine Versuche erfasst',
  'reason.coverage-incomplete': 'Datenabdeckung unvollständig',
  'reason.not-yet-final': 'Zum gewählten Zeitpunkt noch nicht endgültig',
  'reason.player-not-yet-on-pitch': 'Spieler noch nicht auf dem Platz',
  'reason.player-unused-substitute': 'Nicht eingesetzter Ersatzspieler',
  'reason.sparse-player-records': 'Wenige erfasste Spieleraktionen',
  'reason.subjective-judgement': 'Allgemeines Urteil',
  'reason.no-relevant-events': 'Keine relevanten Ereignisse',
  'reason.insufficient-evidence': 'Unzureichende Belege',
  'scope.match-so-far': 'Spiel bisher, bis {clock}',
  'scope.last-10-minutes': 'Letzte 10 Minuten, bis {clock}',
  'scope.beforeGoal': 'Vor dem Tor von {team} bei {clock} (dieses Tor und spätere Ereignisse ausgenommen)',
  'scope.firstHalf': 'Tore der ersten Halbzeit, geprüft bei {clock}',
}

const AR: Dict = {
  'v.supported': 'مؤيَّد',
  'v.contradicted': 'مدحوض',
  'v.unsettled': 'الأدلة لا تكفي لاستنتاج حاسم',
  'v.none': 'إحصاءات فقط، دون حكم',
  'v.unavailable': 'بيانات غير مسجّلة',
  'v.notUnderstood': 'غير مفهوم',
  'v.clarify': 'يحتاج إلى توضيح',
  'v.unsupported': 'نوع إجابة غير مدعوم',
  unsupported: 'هذا النوع من الإجابات غير مدعوم في هذا الإصدار من التطبيق، لذلك لا يمكن عرضه هنا.',
  legacy: 'حُفظت هذه الإجابة قبل وجود الإجابات المهيكلة. يظهر النص الأصلي بالإنجليزية أدناه، ولا يتم استنتاج هويات اللاعبين أو الفرق.',
  legacySource: 'النص الأصلي بالإنجليزية',
  notRecorded: 'غير مسجّل',
  bothTeams: 'كلا الفريقين',
  'metric.physical-condition': 'الحالة البدنية',
  'metric.shot-location': 'مكان التسديدات',
  'metric.territorial-control': 'السيطرة على المساحات',
  'metric.build-up-pass-scope': 'أرقام التمرير المقتصرة على مراحل بناء اللعب',
  'unavail.metric': '{metric}: لا توجد بيانات مسجّلة في هذه المباراة، لذلك لا يوجد رقم ولا حكم.',
  'unavail.generic': 'المقياس المطلوب غير مسجّل في بيانات هذه المباراة، لذلك لا يوجد رقم ولا حكم.',
  'unrec.interpreter': 'لا يستطيع المفسِّر المحلي تحديد أدلة كرة القدم المطلوبة بدقة، لذلك لم يُفحص أي شيء.',
  'unrec.prediction': 'يبدو هذا توقعاً. الأحداث المسجّلة تصل حتى {clock} فقط، لذلك لا يمكن فحصه.',
  'unrec.foreign': 'ليس ضمن بيانات هذه المباراة: {names}. لم يُفحص أي شيء.',
  clarification: 'الصياغة «{quote}» تحتاج إلى توضيح قبل أن يمكن فحصها.',
  'claim.lead': 'الادعاء كما فُهم: {text}.',
  'claim.some': 'سجّل {subject} على الأقل {count}',
  'claim.none': 'سجّل {subject} {count}',
  'claim.every': 'كانت كل تسديدات {subject} على المرمى',
  'claim.notEvery': 'لم تكن كل تسديدات {subject} على المرمى',
  'claim.noneOnTarget': 'لم تكن أي من تسديدات {subject} على المرمى',
  'count.recorded': 'المسجّل: {count}.',
  'count.recordedOf': 'المسجّل: {count} من أصل {total}.',
  'count.missing': 'لا يتوفر أي رقم مسجّل.',
  'count.noShots': 'لا توجد تسديدات مسجّلة، لذلك لا يمكن فحص ادعاء عن كل التسديدات.',
  'ht.claimScored': 'سجّل {subject} قبل الاستراحة',
  'ht.claimDidNot': 'لم يسجّل {subject} قبل الاستراحة',
  'ht.goal': 'سُجّل هدف لـ{subject} في الشوط الأول عند {clock}.',
  'ht.none': 'لا يوجد هدف مسجّل لـ{subject} في الشوط الأول المكتمل (فُحص عند {clock}).',
  'ht.open': 'لم ينتهِ الشوط الأول عند {clock}، لذلك قد يُسجَّل هدف بعد.',
  'focus.halfTime': 'الأهداف قبل نهاية الشوط الأول',
  'focus.possession': 'الاستحواذ',
  'focus.passing': 'التمريرات',
  'focus.attacking': 'الهجوم',
  'focus.involvement': 'المشاركة المسجّلة',
  'focus.events': 'أحداث المباراة المسجّلة',
  'understood.entity': 'ادعاء بشأن {focus} لدى {entity}، جرى فحصه مقابل بيانات المباراة الاصطناعية المسجّلة.',
  'understood.plain': 'ادعاء بشأن {focus}، جرى فحصه مقابل بيانات المباراة الاصطناعية المسجّلة.',
  'hist.claim': 'الادعاء: «{quote}».',
  'hist.possession': 'الاستحواذ المسجّل في الفترة المفحوصة: {team} {value}% مقابل {opponent} {opponentValue}%، من {minutes} من اللعب المسيطَر عليه (باستثناء اللعب المتنازع عليه والكرة خارج الملعب).',
  'hist.runOfPlay': 'نسبة الاستحواذ وحدها لا تثبت مجريات اللعب.',
  'dom.shares': 'استحوذ {team} على {value}% من الاستحواذ المسجّل مقابل {opponentValue}% لـ{opponent}.',
  'dom.supports': 'يميل هذا إلى تأييد الادعاء، لكن نسبة الاستحواذ وحدها لا تثبت الهيمنة.',
  'dom.challenges': 'يميل هذا إلى معارضة الادعاء، لكن نسبة الاستحواذ وحدها لا تحسمه.',
  'dom.level': 'الاستحواذ متعادل، فلا يؤيد الادعاء ولا يعارضه.',
  'topic.lead': 'الموضوع: {topic}.',
  'topic.leadNegated': 'الموضوع: {topic} (الرأي منفيّ).',
  'topic.specific': 'إذا أردت رقماً محدداً، اطلب عدّاً مثل التسديدات أو التمريرات.',
  'topicname.overall-performance': 'الأداء العام',
  'topicname.involvement': 'المشاركة',
  'topicname.passing-quality': 'جودة التمرير',
  'topicname.possession-losses': 'فقدان الكرة',
  'topicname.attacking-output': 'الإنتاج الهجومي',
  'topicname.finishing': 'إنهاء الهجمات',
  'topicname.defensive-approach': 'الأسلوب الدفاعي',
  'topicname.pressure-progression': 'الضغط والتقدم باللعب',
  'topicname.momentum': 'زخم المباراة',
  'topicname.physical-condition': 'الحالة البدنية',
  'topicname.prediction': 'التوقع',
  'tf.passing': 'أتمّ {subject} {completions} من {attempts} تمريرة مسجّلة ({rate}).',
  'tf.passingNone': 'لا توجد محاولات تمرير مسجّلة لـ{subject}، لذلك لا توجد نسبة نجاح.',
  'tf.passingUnknown': 'أرقام التمرير الخاصة بـ{subject} غير مسجّلة.',
  'tf.playerLosses': 'مرات فقدان الكرة المسجّلة لـ{subject} (تمريرات غير ناجحة): {count}.',
  'tf.playerLossesAreas': 'مناطق الملعب: {areas}.',
  'tf.playerLossesAttempts': 'محاولات التمرير: {attempts}.',
  'tf.teamLosses': 'مرات فقدان الكرة المسجّلة لـ{subject} حسب منطقة الملعب: {areas}.',
  'tf.attacking': '{subject}: {items}.',
  'tf.involvement': 'لدى {subject} {actions} مسجّلة في هذه الفترة.',
  'tf.statistics': 'أرقام الفريق للفترة المحددة معروضة مع الإحصاءات.',
  'tf.none': 'لا توجد أرقام مسجّلة تخص هذا الموضوع مباشرة.',
  'area.defensive-third': 'الثلث الدفاعي',
  'area.middle-third': 'ثلث الوسط',
  'area.final-third': 'الثلث الأخير',
  'area.item': '{area} {count}',
  'actions.one': 'إجراء واحد',
  'actions.other': '{count} إجراءات',
  'ctx.keeper': 'تُعرض التسديدات على المرمى للسياق فقط؛ فهي لا تقيس أداء الحارس.',
  'ctx.possession': 'سياق الاستحواذ: {team} {value}% مقابل {opponent} {opponentValue}%. هذا سياق وليس مقياساً للادعاء.',
  'ctx.possessionNone': 'نسب الاستحواذ غير متاحة للسياق.',
  'ctx.pressure': 'ملاحظات الضغط المختارة: {team} {observations}، {opponent} {opponentObservations}. هذه عيّنة جزئية تُستخدم للسياق فقط.',
  'shape.defensive-shape': 'الشكل الدفاعي والتمركز غير مسجّلين.',
  'shape.pressure-progression': 'لا يُقاس الضغط والتقدم باللعب ككل؛ المسجّل ملاحظات مختارة فقط.',
  'subj.lead': '«{quote}» حكم عام، ولا تستطيع السجلات حسمه.',
  insufficient: 'لا يمكن حسم «{quote}» من البيانات المسجّلة، لذلك لا يُعطى حكم.',
  'pl.notYet': 'لم يكن {player} قد دخل الملعب في هذا الوقت.',
  'pl.unused': '{player} بديل لم يشارك، ولا دقائق له في هذه الفترة.',
  'pl.noActions': 'كان {player} في الملعب لكن لا توجد له إجراءات مسجّلة في هذه الفترة.',
  'pl.participated': 'شارك {player}؛ لا تتوفر أرقام أخرى هنا.',
  'pl.contrib': '{player}: {items}.',
  'pl.passes': '{completed} من {attempts} تمريرة ناجحة',
  'co.none': 'لا تتوفر أرقام فقدان الكرة لهذا السؤال.',
  'co.sample': 'مرات فقدان الكرة في عيّنة بناء اللعب الموسومة: {total}.',
  'co.all': 'مرات فقدان الكرة في كل التمريرات المسجّلة: {total}.',
  'co.team': '{team}: {total} ({areas}).',
  'ev.possession': 'أدلة الاستحواذ',
  'ev.territorial-control': 'أدلة السيطرة على المساحات',
  'ev.shots': 'أدلة التسديدات',
  'ev.shots-on-target': 'أدلة التسديدات على المرمى',
  'ev.goals': 'أدلة الأهداف',
  'ev.attacking-events': 'أدلة الأحداث الهجومية',
  'ev.player-events': 'أدلة إجراءات اللاعبين',
  'ev.passing': 'أدلة التمرير',
  'ev.possession-losses': 'أدلة فقدان الكرة',
  'ev.physical-measurements': 'القياسات البدنية',
  'ev.build-up-phase': 'وسوم مرحلة بناء اللعب',
  'ev.lineups': 'أدلة التشكيلات',
  'ev.shot-location': 'أدلة مكان التسديدات',
  'lim.clarification': 'الصياغة تحتاج إلى توضيح قبل أن يمكن فحصها.',
  'lim.unavailableEvidence': '{kind} غير مسجّلة لهذه المباراة.',
  'lim.metricNotRecorded': 'المقياس المطلوب غير مسجّل في بيانات هذه المباراة.',
  'lim.physicalCondition': 'الحالة البدنية واللياقة غير مسجّلتين، لذلك لا يمكن إصدار حكم.',
  'lim.buildUpScope': 'لا يمكن حصر أرقام التمرير في مراحل بناء اللعب اعتماداً على البيانات المسجّلة.',
  'lim.prediction': 'لا يمكن فحص التوقعات بأحداث لم تُسجَّل بعد.',
  'lim.interpreter': 'لم يستطع المفسِّر المحلي تحديد الأدلة المطلوبة بدقة، لذلك لم تُستخدم أرقام غير ذات صلة.',
  'lim.foreignTeam': 'فريق مذكور ليس ضمن بيانات هذه المباراة، لذلك لم تُستخدم أي أرقام.',
  'lim.zeroAttempts': 'لا توجد تسديدات مسجّلة لـ{team}، لذلك لا يمكن فحص ادعاء عن كل التسديدات.',
  'lim.outcomes': 'الحكم مبني فقط على نتائج التسديدات والأهداف المسجّلة لـ{subject}؛ جودة الفرص غير مسجّلة.',
  'lim.htFor.supports': '{goal} لـ{subject} يؤيد الادعاء.',
  'lim.htFor.contradicts': '{goal} لـ{subject} يدحض الادعاء.',
  'lim.htGoal': 'وجود هدف مسجّل في الشوط الأول',
  'lim.htNoGoal': 'غياب أي هدف مسجّل في الشوط الأول',
  'lim.htUnsettled': 'لم ينتهِ الشوط الأول عند الوقت المحدد، لذلك لا يمكن حسم الادعاء عن {subject} بعد.',
  'lim.passDescriptive': 'أرقام التمرير عدّ وصفي؛ فهي لا تقيس جودة التمرير.',
  'lim.passCoverage': 'تغطية التمرير في هذه المباراة جزئية، لذلك قد تقل الأرقام عن المباراة كاملة.',
  'lim.descriptiveOnly': 'هذه الأرقام وصفية فقط؛ ولا يُعطى حكم.',
  'lim.noPassAttempts': 'لا توجد محاولات تمرير مسجّلة في هذه الفترة، لذلك لا يمكن حساب نسبة نجاح.',
  'lim.coachingSample': 'مبني فقط على عيّنة بناء اللعب الموسومة. الفرق: {subject}. مرات فقدان الكرة المسجّلة (تمريرات غير ناجحة): {total}. هذه عيّنة جزئية وليست دليلاً كاملاً على المباراة كلها، والمواقع لا تثبت أسباباً تكتيكية.',
  'lim.coachingAll': 'العدّ على كل التمريرات المسجّلة، وليس مراحل بناء اللعب فقط. الفرق: {subject}. مرات فقدان الكرة المسجّلة (تمريرات غير ناجحة): {total}. المواقع لا تثبت أسباباً تكتيكية.',
  'lim.topic': 'هذا حكم عام عن {topic}؛ الأرقام المسجّلة سياق ولا تعطي حكماً.',
  'lim.playerSparse': 'إجراءات {player} المسجّلة قليلة، لذلك هذه الأرقام دليل ضعيف.',
  'lim.possessionShare': 'الاستحواذ المسجّل ({team} {value}% مقابل {opponent} {opponentValue}%) مقياس واحد ولا يستطيع وحده حسم حكم عام.',
  'lim.missingData': 'نقص البيانات يمنع استنتاجاً حاسماً بشأن «{quote}».',
  'lim.contextOnly': 'الأرقام المعروضة سياق لـ«{quote}» وليست حكماً.',
  'lim.noRelevant': 'لم تُعثر على أحداث مسجّلة ذات صلة في هذه الفترة.',
  'lim.possessionCalc': 'يُحسب الاستحواذ من فترات سيطرة مقتطعة؛ ويُستثنى الوقت المتنازع عليه والكرة خارج الملعب.',
  'lim.comparison': 'تعتمد المقارنة على أعداد مسجّلة فقط ولا تثبت الجودة ولا السبب.',
  'lim.territory': 'السيطرة على المساحات وجودة الفرص غير مسجّلتين، لذلك لا يمكن حسم الادعاء.',
  'reason.metric-not-recorded': 'مقياس غير مسجّل',
  'reason.phase-scope-unavailable': 'نطاق مرحلة بناء اللعب غير متاح لهذا الرقم',
  'reason.interpreter-unreliable': 'الصياغة لم تُفهم بدقة',
  'reason.prediction': 'لا يمكن فحص التوقعات',
  'reason.foreign-team': 'فريق ليس في هذه المباراة',
  'reason.needs-clarification': 'يحتاج إلى توضيح',
  'reason.player-not-in-fixture': 'اللاعب غير موجود في هذه المباراة',
  'reason.player-choice': 'اختر اللاعب المقصود',
  'reason.no-attempts': 'لا محاولات مسجّلة',
  'reason.coverage-incomplete': 'تغطية السجلات غير مكتملة',
  'reason.not-yet-final': 'غير نهائي عند الوقت المحدد',
  'reason.player-not-yet-on-pitch': 'اللاعب لم يدخل الملعب بعد',
  'reason.player-unused-substitute': 'بديل لم يشارك',
  'reason.sparse-player-records': 'إجراءات مسجّلة قليلة للاعب',
  'reason.subjective-judgement': 'حكم عام',
  'reason.no-relevant-events': 'لا أحداث ذات صلة',
  'reason.insufficient-evidence': 'أدلة غير كافية',
  'scope.match-so-far': 'المباراة حتى الآن، حتى {clock}',
  'scope.last-10-minutes': 'آخر 10 دقائق، حتى {clock}',
  'scope.beforeGoal': 'قبل هدف {team} عند {clock} (يُستثنى ذلك الهدف وما بعده من أحداث)',
  'scope.firstHalf': 'أهداف الشوط الأول، فُحصت عند {clock}',
}

const DICTS: Record<AppLanguage, Record<string, string>> = { en: EN, es: ES, fr: FR, de: DE, ar: AR }

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? '')

function text(language: AppLanguage, key: string, values: Record<string, string> = {}): string {
  const template = DICTS[language]?.[key]
  if (template === undefined) throw new UnsupportedPresentation(key)
  return fill(template, values)
}

const clockText = (clock: MatchClock) => formatMatchClock(clock)
const percent = (value: number, language: AppLanguage) => `${formatNumber(value, language)}%`
const joinList = (items: string[], language: AppLanguage) => items.join(language === 'ar' ? '، ' : ', ')

const COUNT_METRICS: ReadonlySet<string> = new Set<ComparisonMetric>([
  'shots', 'shots-on-target', 'goals', 'recoveries', 'pressure-observations',
  'pass-attempts', 'pass-completions', 'minutes-played',
])

function countText(metric: string, value: number, language: AppLanguage): string {
  if (!COUNT_METRICS.has(metric)) throw new UnsupportedPresentation(metric)
  return formatCountWithNoun(metric as ComparisonMetric, value, language)
}

function metricLabel(metric: string, language: AppLanguage): string | null {
  if (DICTS[language][`metric.${metric}`] !== undefined) return text(language, `metric.${metric}`)
  try {
    return comparisonMetricName(metric as ComparisonMetric, language) ?? null
  } catch {
    return null
  }
}

const sentence = (parts: Array<string | undefined>) => parts.filter(Boolean).join(' ')

function areaList(
  areas: Array<{ area: PitchArea; count: number | null }>,
  language: AppLanguage,
): string {
  return joinList(
    areas.map(({ area, count }) =>
      text(language, 'area.item', {
        area: text(language, `area.${area}`),
        count: count === null ? text(language, 'notRecorded') : formatNumber(count, language),
      })),
    language,
  )
}

function renderPlayerFacts(facts: PlayerFacts, ctx: PresentationContext, language: AppLanguage): string {
  const player = ctx.nameOf(facts.player)
  if (facts.participation === 'not-yet-on-pitch') return text(language, 'pl.notYet', { player })
  if (facts.participation === 'unused-substitute') return text(language, 'pl.unused', { player })
  if (facts.participation !== 'participated') throw new UnsupportedPresentation(facts.participation)
  if (facts.contributions.length === 0) {
    return text(language, facts.noRecordedActions ? 'pl.noActions' : 'pl.participated', { player })
  }
  const items = facts.contributions.map((item) => {
    if (item.code === 'passes') {
      return text(language, 'pl.passes', {
        completed: formatNumber(item.completed, language),
        attempts: formatNumber(item.attempts, language),
      })
    }
    if (item.code === 'minutes') return countText('minutes-played', item.minutes, language)
    return countText(item.code, item.count, language)
  })
  return text(language, 'pl.contrib', { player, items: joinList(items, language) })
}

function renderTopicFacts(
  facts: TopicFacts,
  subject: string,
  ctx: PresentationContext,
  language: AppLanguage,
): string {
  switch (facts.kind) {
    case 'passing': {
      if (facts.attempts === null) return text(language, 'tf.passingUnknown', { subject })
      if (facts.attempts === 0) return text(language, 'tf.passingNone', { subject })
      return text(language, 'tf.passing', {
        subject,
        completions: formatNumber(facts.completions ?? 0, language),
        attempts: formatNumber(facts.attempts, language),
        rate: facts.ratePercent === null ? text(language, 'notRecorded') : percent(facts.ratePercent, language),
      })
    }
    case 'player-possession-losses':
      return sentence([
        text(language, 'tf.playerLosses', { subject, count: formatNumber(facts.count, language) }),
        facts.areas.length > 0
          ? text(language, 'tf.playerLossesAreas', {
              areas: joinList(facts.areas.map((area) => text(language, `area.${area}`)), language),
            })
          : undefined,
        facts.attempts === null
          ? undefined
          : text(language, 'tf.playerLossesAttempts', { attempts: formatNumber(facts.attempts, language) }),
      ])
    case 'team-possession-losses':
      return text(language, 'tf.teamLosses', { subject, areas: areaList(facts.areas, language) })
    case 'attacking': {
      const item = (metric: string, value: number | null) =>
        value === null
          ? `${metricLabel(metric, language)}: ${text(language, 'notRecorded')}`
          : countText(metric, value, language)
      return text(language, 'tf.attacking', {
        subject,
        items: joinList(
          [item('shots', facts.shots), item('shots-on-target', facts.onTarget), item('goals', facts.goals)],
          language,
        ),
      })
    }
    case 'involvement':
      return sentence([
        text(language, 'tf.involvement', {
          subject,
          actions: facts.actions === 1
            ? text(language, 'actions.one')
            : text(language, 'actions.other', { count: formatNumber(facts.actions, language) }),
        }),
        renderPlayerFacts(facts.playerFacts, ctx, language),
      ])
    case 'player-summary':
      return renderPlayerFacts(facts.playerFacts, ctx, language)
    case 'statistics':
      return text(language, 'tf.statistics')
    case 'none':
      return text(language, 'tf.none')
    default:
      throw new UnsupportedPresentation('topic-facts')
  }
}

function renderTopicContext(context: TopicContext, ctx: PresentationContext, language: AppLanguage): string {
  const team = (value: string) => ctx.nameOf({ kind: 'team', team: value as never })
  switch (context.kind) {
    case 'keeper':
      return text(language, 'ctx.keeper')
    case 'possession-context':
      return context.shares === null
        ? text(language, 'ctx.possessionNone')
        : text(language, 'ctx.possession', {
            team: team(context.shares.team),
            value: formatNumber(context.shares.value, language),
            opponent: team(context.shares.opponent),
            opponentValue: formatNumber(context.shares.opponentValue, language),
          })
    case 'pressure-sample':
      return text(language, 'ctx.pressure', {
        team: team(context.team),
        observations: formatNumber(context.observations, language),
        opponent: team(context.opponent),
        opponentObservations: formatNumber(context.opponentObservations, language),
      })
    default:
      throw new UnsupportedPresentation('topic-context')
  }
}

function claimPhrase(
  answer: Extract<AnswerFact, { code: 'count-assertion' }>,
  subject: string,
  language: AppLanguage,
): string {
  switch (answer.form) {
    case 'some': return text(language, 'claim.some', { subject, count: countText(answer.metric, 1, language) })
    case 'none': return text(language, 'claim.none', { subject, count: countText(answer.metric, 0, language) })
    case 'every': return text(language, 'claim.every', { subject })
    case 'not-every': return text(language, 'claim.notEvery', { subject })
    case 'none-on-target': return text(language, 'claim.noneOnTarget', { subject })
    default: throw new UnsupportedPresentation('count-form')
  }
}

function renderAnswerText(answer: AnswerFact, ctx: PresentationContext, language: AppLanguage): string | null {
  const team = (value: string) => ctx.nameOf({ kind: 'team', team: value as never })
  switch (answer.code) {
    case 'structured-elsewhere':
      return null
    case 'unavailable-metric': {
      const label = answer.metric === undefined ? null : metricLabel(answer.metric, language)
      return label === null
        ? text(language, 'unavail.generic')
        : text(language, 'unavail.metric', { metric: label })
    }
    case 'unrecognized':
      if (answer.reason === 'interpreter-unreliable') return text(language, 'unrec.interpreter')
      if (answer.reason === 'prediction') {
        return text(language, 'unrec.prediction', {
          clock: answer.through ? clockText(answer.through) : '',
        })
      }
      if (answer.reason === 'foreign-team') {
        return text(language, 'unrec.foreign', { names: joinList(answer.foreignTeams ?? [], language) })
      }
      throw new UnsupportedPresentation('unrecognized-reason')
    case 'clarification':
      return text(language, 'clarification', { quote: answer.quote })
    case 'count-assertion': {
      const subject = ctx.nameOf(answer.subject)
      const universal = answer.form === 'every' || answer.form === 'not-every' || answer.form === 'none-on-target'
      const claim = text(language, 'claim.lead', { text: claimPhrase(answer, subject, language) })
      let figures: string
      if (universal && answer.of === 0) figures = text(language, 'count.noShots')
      else if (answer.recorded === null) figures = text(language, 'count.missing')
      else if (answer.of === null) {
        figures = text(language, 'count.recorded', { count: countText(answer.metric, answer.recorded, language) })
      } else {
        figures = text(language, 'count.recordedOf', {
          count: countText(answer.metric, answer.recorded, language),
          total: countText('shots', answer.of, language),
          totalNumber: formatNumber(answer.of, language),
        })
      }
      return sentence([claim, figures])
    }
    case 'half-time': {
      const subject = ctx.nameOf(answer.subject)
      const claim = text(language, 'claim.lead', {
        text: text(language, answer.assertion === 'scored' ? 'ht.claimScored' : 'ht.claimDidNot', { subject }),
      })
      if (answer.outcome === 'goal-recorded') {
        if (!answer.goalClock) throw new UnsupportedPresentation('half-time-goal-clock')
        return sentence([claim, text(language, 'ht.goal', { subject, clock: clockText(answer.goalClock) })])
      }
      if (answer.outcome === 'no-goal-recorded') {
        return sentence([claim, text(language, 'ht.none', { subject, clock: clockText(answer.selectedClock) })])
      }
      if (answer.outcome === 'not-yet-final') {
        return sentence([claim, text(language, 'ht.open', { clock: clockText(answer.selectedClock) })])
      }
      throw new UnsupportedPresentation('half-time-outcome')
    }
    case 'historical': {
      const parts = [text(language, 'hist.claim', { quote: answer.quote })]
      if (answer.possession) {
        const p = answer.possession
        parts.push(text(language, 'hist.possession', {
          team: team(p.team),
          value: formatNumber(p.value, language),
          opponent: team(p.opponent),
          opponentValue: formatNumber(p.opponentValue, language),
          minutes: countText('minutes-played', p.minutes, language),
        }))
      }
      if (answer.playerFacts) parts.push(renderPlayerFacts(answer.playerFacts, ctx, language))
      if (answer.kind === 'run-of-play') parts.push(text(language, 'hist.runOfPlay'))
      else if (answer.kind !== 'circumstance' && answer.kind !== 'player') {
        throw new UnsupportedPresentation('historical-kind')
      }
      return sentence(parts)
    }
    case 'possession-dominance': {
      const aspectKey = answer.aspect === 'supports'
        ? 'dom.supports'
        : answer.aspect === 'challenges'
          ? 'dom.challenges'
          : answer.aspect === 'level'
            ? 'dom.level'
            : null
      if (aspectKey === null) throw new UnsupportedPresentation('possession-aspect')
      return sentence([
        text(language, 'dom.shares', {
          team: team(answer.team),
          value: formatNumber(answer.value, language),
          opponent: team(answer.opponent),
          opponentValue: formatNumber(answer.opponentValue, language),
        }),
        text(language, aspectKey),
      ])
    }
    case 'topic': {
      const subject = ctx.nameOf(answer.subject)
      const topic = text(language, `topicname.${answer.topic}`)
      return sentence([
        text(language, answer.negated ? 'topic.leadNegated' : 'topic.lead', { topic }),
        renderTopicFacts(answer.facts, subject, ctx, language),
        answer.context ? renderTopicContext(answer.context, ctx, language) : undefined,
      ])
    }
    case 'player-broad':
      return renderPlayerFacts(answer, ctx, language)
    case 'subjective-unsettled':
      return sentence([
        text(language, 'subj.lead', { quote: answer.quote }),
        answer.context ? renderTopicContext(answer.context, ctx, language) : undefined,
        answer.shape ? text(language, `shape.${answer.shape}`) : undefined,
      ])
    case 'insufficient':
      return text(language, 'insufficient', { quote: answer.quote })
    case 'coaching': {
      if (answer.none) return text(language, 'co.none')
      const lead = text(language, answer.phase === 'build-up-sample' ? 'co.sample' : 'co.all', {
        total: formatNumber(answer.total, language),
      })
      if (answer.phase !== 'build-up-sample' && answer.phase !== 'all-passes') {
        throw new UnsupportedPresentation('coaching-phase')
      }
      return sentence([
        lead,
        ...answer.teams.map((entry) =>
          text(language, 'co.team', {
            team: team(entry.team),
            total: formatNumber(entry.total, language),
            areas: areaList(entry.areas, language),
          })),
      ])
    }
    default:
      throw new UnsupportedPresentation('answer-code')
  }
}

function verdictKey(answer: AnswerFact): string {
  switch (answer.code) {
    case 'count-assertion':
    case 'half-time':
    case 'historical':
      if (answer.verdict === 'supported' || answer.verdict === 'contradicted' || answer.verdict === 'unsettled') {
        return `v.${answer.verdict}`
      }
      throw new UnsupportedPresentation('verdict')
    case 'unavailable-metric': return 'v.unavailable'
    case 'unrecognized': return 'v.notUnderstood'
    case 'clarification': return 'v.clarify'
    case 'possession-dominance':
    case 'topic':
    case 'player-broad':
    case 'subjective-unsettled':
    case 'insufficient':
    case 'coaching':
      return 'v.unsettled'
    case 'structured-elsewhere':
      return 'v.none'
    default:
      throw new UnsupportedPresentation('answer-code')
  }
}

export function renderLimitationFact(
  limitation: LimitationFact,
  ctx: PresentationContext,
  language: AppLanguage,
): string {
  try {
    const team = (value: string) => ctx.nameOf({ kind: 'team', team: value as never })
    switch (limitation.code) {
      case 'clarification-needed': return text(language, 'lim.clarification')
      case 'unavailable-evidence':
        return text(language, 'lim.unavailableEvidence', { kind: text(language, `ev.${limitation.kind}`) })
      case 'metric-not-recorded': return text(language, 'lim.metricNotRecorded')
      case 'physical-condition': return text(language, 'lim.physicalCondition')
      case 'build-up-pass-scope-unavailable': return text(language, 'lim.buildUpScope')
      case 'prediction': return text(language, 'lim.prediction')
      case 'interpreter-unreliable': return text(language, 'lim.interpreter')
      case 'foreign-team': return text(language, 'lim.foreignTeam')
      case 'zero-attempts-universal': return text(language, 'lim.zeroAttempts', { team: team(limitation.team) })
      case 'count-judged-on-outcomes':
        return text(language, 'lim.outcomes', { subject: ctx.nameOf(limitation.subject) })
      case 'halftime-supported':
      case 'halftime-contradicted':
        return text(
          language,
          limitation.code === 'halftime-supported' ? 'lim.htFor.supports' : 'lim.htFor.contradicts',
          {
            goal: text(language, limitation.recordedGoal ? 'lim.htGoal' : 'lim.htNoGoal'),
            subject: ctx.nameOf(limitation.subject),
          },
        )
      case 'halftime-unsettled':
        return text(language, 'lim.htUnsettled', { subject: ctx.nameOf(limitation.subject) })
      case 'pass-statistics-descriptive': return text(language, 'lim.passDescriptive')
      case 'pass-coverage-partial': return text(language, 'lim.passCoverage')
      case 'descriptive-statistics-only': return text(language, 'lim.descriptiveOnly')
      case 'no-pass-attempts': return text(language, 'lim.noPassAttempts')
      case 'coaching-build-up-sample':
      case 'coaching-all-passes':
        return text(
          language,
          limitation.code === 'coaching-build-up-sample' ? 'lim.coachingSample' : 'lim.coachingAll',
          {
            subject: limitation.subject ? ctx.nameOf(limitation.subject) : text(language, 'bothTeams'),
            total: formatNumber(limitation.total, language),
          },
        )
      case 'topic':
        return text(language, 'lim.topic', { topic: text(language, `topicname.${limitation.topic}`) })
      case 'player-sparse': return text(language, 'lim.playerSparse', { player: ctx.nameOf(limitation.player) })
      case 'possession-share-limit':
        return text(language, 'lim.possessionShare', {
          team: team(limitation.team),
          value: formatNumber(limitation.value, language),
          opponent: team(limitation.opponent),
          opponentValue: formatNumber(limitation.opponentValue, language),
        })
      case 'missing-data-prevents-conclusion': return text(language, 'lim.missingData', { quote: limitation.quote })
      case 'context-only': return text(language, 'lim.contextOnly', { quote: limitation.quote })
      case 'no-relevant-events': return text(language, 'lim.noRelevant')
      case 'possession-calculation-limit': return text(language, 'lim.possessionCalc')
      case 'comparison-generic': return text(language, 'lim.comparison')
      case 'territory-or-chance-quality-absent': return text(language, 'lim.territory')
      default: throw new UnsupportedPresentation('limitation-code')
    }
  } catch (error) {
    if (error instanceof UnsupportedPresentation) return text(language, 'unsupported')
    throw error
  }
}

/** Localized scope line; keeps period and stoppage in every clock (for example 45+3′). */
export function renderPresentationScope(scope: ScopeFact, ctx: PresentationContext, language: AppLanguage): string {
  try {
    switch (scope.kind) {
      case 'window':
        return text(language, `scope.${scope.period}`, { clock: clockText(scope.through) })
      case 'before-goal':
        return text(language, 'scope.beforeGoal', {
          team: ctx.nameOf({ kind: 'team', team: scope.anchorTeam }),
          clock: clockText(scope.anchorClock),
        })
      case 'first-half-goals':
        return text(language, 'scope.firstHalf', { clock: clockText(scope.through) })
      default:
        throw new UnsupportedPresentation('scope-kind')
    }
  } catch (error) {
    if (error instanceof UnsupportedPresentation) return text(language, 'unsupported')
    throw error
  }
}

export function renderPresentationReason(reason: ReasonCode, language: AppLanguage): string {
  const template = DICTS[language][`reason.${reason}`]
  return template ?? text(language, 'unsupported')
}

/** The topic a presentation-backed claim is about, in the reader's language; null for structured-elsewhere answers. */
export function renderPresentationFocus(answer: AnswerFact, language: AppLanguage): string | null {
  let key: string
  switch (answer.code) {
    case 'structured-elsewhere':
      return null
    case 'count-assertion': {
      const label = metricLabel(answer.metric, language)
      if (label !== null) return label.toLocaleLowerCase(language)
      key = 'focus.events'
      break
    }
    case 'half-time':
      key = 'focus.halfTime'
      break
    case 'possession-dominance':
      key = 'focus.possession'
      break
    case 'historical':
      key = answer.possession ? 'focus.possession' : answer.playerFacts ? 'focus.involvement' : 'focus.events'
      break
    case 'player-broad':
      key = 'focus.involvement'
      break
    case 'topic':
      key = answer.facts.kind === 'passing'
        ? 'focus.passing'
        : answer.facts.kind === 'attacking'
          ? 'focus.attacking'
          : answer.facts.kind === 'involvement' || answer.facts.kind === 'player-summary'
            ? 'focus.involvement'
            : 'focus.events'
      break
    default:
      key = 'focus.events'
  }
  return text(language, key)
}

/** "What we understood" line from typed answer facts; null for structured-elsewhere answers. */
export function renderPresentationUnderstood(
  presentation: ClaimPresentation,
  ctx: PresentationContext,
  language: AppLanguage,
): string | null {
  const { answer } = presentation
  const focus = renderPresentationFocus(answer, language)
  if (focus === null) return null
  const entity: EntityRef | undefined =
    answer.code === 'count-assertion' || answer.code === 'half-time' || answer.code === 'topic'
      ? answer.subject
      : answer.code === 'player-broad'
        ? answer.player
        : answer.code === 'possession-dominance'
          ? { kind: 'team', team: answer.team }
          : undefined
  return entity
    ? text(language, 'understood.entity', { focus, entity: ctx.nameOf(entity) })
    : text(language, 'understood.plain', { focus })
}

/**
 * One share-card key fact, "Name: 1 goal", from typed fields (recorded value, never null).
 * Returns null for metrics without a localized noun so callers omit it rather than show English.
 */
export function renderStatisticFact(
  name: string,
  metric: string,
  value: number,
  language: AppLanguage,
): string | null {
  const colon = language === 'fr' ? ' : ' : ': '
  if (COUNT_METRICS.has(metric)) return `${name}${colon}${countText(metric, value, language)}`
  if (metric === 'possession-percentage' || metric === 'pass-completion-percentage') {
    const label = metricLabel(metric, language)
    return label === null ? null : `${name}${colon}${percent(value, language)} ${label}`
  }
  return null
}

export function renderPresentationLimitations(
  presentation: Pick<ClaimPresentation, 'limitations'>,
  ctx: PresentationContext,
  language: AppLanguage,
): string[] {
  return presentation.limitations.map((limitation) => renderLimitationFact(limitation, ctx, language))
}

/** The localized answer sentence(s); null for `structured-elsewhere` (use the existing formatters). */
export function renderAnswerFact(answer: AnswerFact, ctx: PresentationContext, language: AppLanguage): string | null {
  try {
    return renderAnswerText(answer, ctx, language)
  } catch (error) {
    if (error instanceof UnsupportedPresentation) return text(language, 'unsupported')
    throw error
  }
}

export function renderClaimPresentation(
  presentation: ClaimPresentation,
  ctx: PresentationContext,
  language: AppLanguage,
): RenderedClaimPresentation | null {
  const unsupported = (): RenderedClaimPresentation => ({
    answer: text(language, 'unsupported'),
    verdict: text(language, 'v.unsupported'),
    limitations: [],
    scope: '',
  })
  if ((presentation as { version: number }).version !== 1) return unsupported()
  const answer = renderAnswerFact(presentation.answer, ctx, language)
  if (answer === null) return null
  let verdict: string
  try {
    verdict = text(language, verdictKey(presentation.answer))
  } catch (error) {
    if (error instanceof UnsupportedPresentation) verdict = text(language, 'v.unsupported')
    else throw error
  }
  const hint = presentation.answer.code === 'topic' && presentation.answer.suggestsSpecificCount
    ? text(language, 'topic.specific')
    : undefined
  const reason = presentation.reason ? renderPresentationReason(presentation.reason, language) : undefined
  const note = sentence([reason, hint])
  return {
    answer,
    verdict,
    limitations: renderPresentationLimitations(presentation, ctx, language),
    scope: renderPresentationScope(presentation.scope, ctx, language),
    ...(note ? { note } : {}),
  }
}

/** Localized label for a legacy assessment value; unknown values render the unsupported text. */
export function renderAssessmentLabel(
  assessment: ClaimResult['assessment'],
  language: AppLanguage,
): string {
  const key = ({
    supported: 'v.supported',
    contradicted: 'v.contradicted',
    'insufficient evidence for a firm conclusion': 'v.unsettled',
    'statistics provided': 'v.none',
    'clarification needed': 'v.clarify',
    'unavailable data': 'v.unavailable',
    'unrecognized language': 'v.notUnderstood',
  } as Record<string, string>)[assessment]
  return key === undefined ? text(language, 'unsupported') : text(language, key)
}

/** State shown for a saved response without `presentation`; nothing is inferred from its English text. */
export function renderLegacyCompatibility(language: AppLanguage): string {
  return text(language, 'legacy')
}

/** Label placed before the untouched English text of a response saved without `presentation`. */
export function renderLegacySourceLabel(language: AppLanguage): string {
  return text(language, 'legacySource')
}
