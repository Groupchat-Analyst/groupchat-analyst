import type { AppLanguage } from './localization.ts'

type NonArabic = Exclude<AppLanguage, 'en' | 'ar'>
type ByLanguage = Record<NonArabic, string>

/** Composer wording for each catalogue example (es/fr/de); Arabic wording lives in localization.ts. */
export const EXAMPLE_TEXT: Readonly<Record<string, ByLanguage>> = {
  'Saka has had a horrible game': {
    es: 'Saka ha tenido un partido horrible.',
    fr: 'Saka a fait un match horrible.',
    de: 'Saka hat ein schreckliches Spiel gemacht.',
  },
  'Eastport had more shots on target than Northbridge.': {
    es: 'Eastport tuvo más tiros a puerta que Northbridge.',
    fr: 'Eastport a eu plus de tirs cadrés que Northbridge.',
    de: 'Eastport hatte mehr Schüsse aufs Tor als Northbridge.',
  },
  'How many passes did Bruno complete?': {
    es: '¿Cuántos pases completó Bruno?',
    fr: 'Combien de passes Bruno a-t-il réussies ?',
    de: 'Wie viele Pässe hat Bruno vervollständigt?',
  },
  'How many passes did Pedro complete?': {
    es: '¿Cuántos pases completó Pedro?',
    fr: 'Combien de passes Pedro a-t-il réussies ?',
    de: 'Wie viele Pässe hat Pedro vervollständigt?',
  },
  'Northbridge parked the bus': {
    es: 'Northbridge aparcó el autobús.',
    fr: 'Northbridge a garé le bus.',
    de: 'Northbridge parkte den Bus.',
  },
  'Northbridge covered more distance than Eastport': {
    es: 'Northbridge recorrió más distancia que Eastport',
    fr: 'Northbridge a parcouru plus de distance qu’Eastport',
    de: 'Northbridge legte mehr Strecke zurück als Eastport',
  },
  'Eastport had more possession than Northbridge but Northbridge had more shots': {
    es: 'Eastport tuvo más posesión que Northbridge, pero Northbridge tuvo más tiros.',
    fr: 'Eastport a eu plus de possession que Northbridge, mais Northbridge a eu plus de tirs.',
    de: 'Eastport hatte mehr Ballbesitz als Northbridge, aber Northbridge hatte mehr Schüsse.',
  },
  'Northbridge had more possession than Eastport': {
    es: 'Northbridge tuvo más posesión que Eastport.',
    fr: 'Northbridge a eu plus de possession qu’Eastport.',
    de: 'Northbridge hatte mehr Ballbesitz als Eastport.',
  },
  'Saka’s passing has been poor': {
    es: 'El juego de pase de Saka ha sido malo.',
    fr: 'Les passes de Saka ont été mauvaises.',
    de: 'Sakas Passspiel war schlecht.',
  },
  'Northbridge are sloppy on the ball': {
    es: 'Northbridge es descuidado con el balón.',
    fr: 'Northbridge est brouillon avec le ballon.',
    de: 'Northbridge geht schlampig mit dem Ball um.',
  },
  'Kingswell City had no shots on target.': {
    es: 'Kingswell City no tuvo ningún tiro a puerta.',
    fr: 'Kingswell City n’a cadré aucun tir.',
    de: 'Kingswell City hatte keinen Schuss aufs Tor.',
  },
  'Westhaven FC had more possession than Kingswell City': {
    es: 'Westhaven FC tuvo más posesión que Kingswell City.',
    fr: 'Westhaven FC a eu plus de possession que Kingswell City.',
    de: 'Westhaven FC hatte mehr Ballbesitz als Kingswell City.',
  },
  'Haaland’s passing has been poor': {
    es: 'El juego de pase de Haaland ha sido malo.',
    fr: 'Les passes de Haaland ont été mauvaises.',
    de: 'Haalands Passspiel war schlecht.',
  },
  'Westhaven FC had no shots on target before the goal': {
    es: 'Westhaven FC no tuvo tiros a puerta antes del gol.',
    fr: 'Westhaven FC n’a eu aucun tir cadré avant le but.',
    de: 'Westhaven FC hatte vor dem Tor keinen Schuss aufs Tor.',
  },
  'Abraham has scored': {
    es: 'Abraham ha marcado.',
    fr: 'Abraham a marqué.',
    de: 'Abraham hat getroffen.',
  },
  'Every Alderwick United shot was on target': {
    es: 'Todos los tiros de Alderwick United fueron a puerta.',
    fr: 'Tous les tirs d’Alderwick United étaient cadrés.',
    de: 'Jeder Schuss von Alderwick United ging aufs Tor.',
  },
  'Redmere FC had no shots on target before the goal': {
    es: 'Redmere FC no tuvo tiros a puerta antes del gol.',
    fr: 'Redmere FC n’a eu aucun tir cadré avant le but.',
    de: 'Redmere FC hatte vor dem Tor keinen Schuss aufs Tor.',
  },
  'Redmere FC had more shots than Alderwick United': {
    es: 'Redmere FC tuvo más tiros que Alderwick United.',
    fr: 'Redmere FC a eu plus de tirs qu’Alderwick United.',
    de: 'Redmere FC hatte mehr Schüsse als Alderwick United.',
  },
  'Jackson has been poor': {
    es: 'Jackson ha estado mal.',
    fr: 'Jackson a été mauvais.',
    de: 'Jackson war schlecht.',
  },
}

/** Short "what this example shows" help (es/fr/de); Arabic help lives in localization.ts. */
export const EXAMPLE_SHOWS: Readonly<Record<string, ByLanguage>> = {
  'Broad player opinion: his recorded contributions, no rating': {
    es: 'Opinión general sobre un jugador: sus aportes registrados, sin nota.',
    fr: 'Opinion générale sur un joueur : ses actions enregistrées, sans note.',
    de: 'Allgemeine Meinung zu einem Spieler: seine erfassten Beiträge, keine Bewertung.',
  },
  'Factual claim that changes between 57′ and 58′': {
    es: 'Afirmación factual cuyo resultado cambia entre el 57′ y el 58′.',
    fr: 'Affirmation factuelle dont le résultat change entre la 57′ et la 58′.',
    de: 'Tatsachenbehauptung, deren Ergebnis sich zwischen 57′ und 58′ ändert.',
  },
  'Ambiguous name: asks which Bruno': {
    es: 'Nombre ambiguo: pregunta a qué Bruno te refieres.',
    fr: 'Nom ambigu : demande de quel Bruno il s’agit.',
    de: 'Mehrdeutiger Name: fragt, welcher Bruno gemeint ist.',
  },
  'Ambiguous name: asks which Pedro': {
    es: 'Nombre ambiguo: pregunta a qué Pedro te refieres.',
    fr: 'Nom ambigu : demande de quel Pedro il s’agit.',
    de: 'Mehrdeutiger Name: fragt, welcher Pedro gemeint ist.',
  },
  'Tactical opinion the records cannot settle': {
    es: 'Opinión táctica que los registros no pueden resolver.',
    fr: 'Opinion tactique que les données ne permettent pas de trancher.',
    de: 'Taktische Meinung, die die Daten nicht entscheiden können.',
  },
  'Physical data that is not recorded': {
    es: 'Datos físicos que no se registran.',
    fr: 'Données physiques non enregistrées.',
    de: 'Physische Daten, die nicht erfasst werden.',
  },
  'Two claims: possession and shots can point different ways': {
    es: 'Dos afirmaciones: la posesión y los tiros pueden apuntar en direcciones distintas.',
    fr: 'Deux affirmations : la possession et les tirs peuvent aller dans des sens différents.',
    de: 'Zwei Behauptungen: Ballbesitz und Schüsse können in verschiedene Richtungen weisen.',
  },
  'Last-10-minutes window that differs from the whole match': {
    es: 'Ventana de los últimos 10 minutos, distinta del partido completo.',
    fr: 'Fenêtre des 10 dernières minutes, différente du match entier.',
    de: 'Fenster der letzten 10 Minuten, das sich vom ganzen Spiel unterscheidet.',
  },
  'Passing evidence with no benchmark': {
    es: 'Datos de pase sin referencia con la que compararlos.',
    fr: 'Données de passes sans référence de comparaison.',
    de: 'Passdaten ohne Vergleichsmaßstab.',
  },
  'Recorded possession losses by pitch third': {
    es: 'Pérdidas de balón registradas por tercio del campo.',
    fr: 'Pertes de balle enregistrées par tiers de terrain.',
    de: 'Erfasste Ballverluste nach Spielfelddrittel.',
  },
  'A zero-count claim on shots on target': {
    es: 'Afirmación de cero tiros a puerta.',
    fr: 'Affirmation de zéro tir cadré.',
    de: 'Behauptung von null Schüssen aufs Tor.',
  },
  'A player with shots but no recorded pass attempts': {
    es: 'Un jugador con tiros pero sin intentos de pase registrados.',
    fr: 'Un joueur avec des tirs mais sans tentative de passe enregistrée.',
    de: 'Ein Spieler mit Schüssen, aber ohne erfasste Passversuche.',
  },
  'No goal is recorded, so the question has no anchor': {
    es: 'No hay ningún gol registrado, así que la pregunta no tiene referencia.',
    fr: 'Aucun but n’est enregistré, la question n’a donc pas de point de repère.',
    de: 'Es ist kein Tor erfasst, daher hat die Frage keinen Bezugspunkt.',
  },
  'A substitute’s goal, which only exists from 88′': {
    es: 'El gol de un suplente, que solo existe a partir del 88′.',
    fr: 'Le but d’un remplaçant, qui n’existe qu’à partir de la 88′.',
    de: 'Das Tor eines Einwechselspielers, das es erst ab 88′ gibt.',
  },
  'A universal claim checked against every recorded shot': {
    es: 'Afirmación universal comprobada con cada tiro registrado.',
    fr: 'Affirmation universelle vérifiée sur chaque tir enregistré.',
    de: 'Allgemeine Behauptung, geprüft an jedem erfassten Schuss.',
  },
  'Three goals are recorded, so the question asks which one': {
    es: 'Hay tres goles registrados, así que la pregunta pide aclarar cuál.',
    fr: 'Trois buts sont enregistrés, la question demande donc lequel.',
    de: 'Es sind drei Tore erfasst, daher fragt die Frage, welches gemeint ist.',
  },
  'A factual comparison that is supported on the full match': {
    es: 'Comparación factual respaldada por el partido completo.',
    fr: 'Comparaison factuelle confirmée sur le match entier.',
    de: 'Sachlicher Vergleich, der über das ganze Spiel bestätigt wird.',
  },
}
