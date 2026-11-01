import type { AppLanguage } from './localization.ts'

/**
 * Application-owned wording for structured player-resolution states. English is the key, so these
 * entries are reached through translateText/formatLocalizedMessage; nothing here comes from a model.
 */
export const RESOLUTION_MESSAGES = {
  choice: 'More than one player matches your wording: {players}. Choose who you mean.',
  absent:
    '“{name}” does not match anyone in this fixture’s squads, so no player was selected and nothing was calculated. Open “View squads” to see who is available.',
  unsupported:
    'I recognised {players}, but I can’t answer that wording yet. Try asking how they played or how many passes they completed.',
  unclear:
    'I couldn’t tell which team or player you mean, so nothing was calculated. Name a team or player and what you want to know.',
  providerWording: 'Provider wording (shown as received, not translated)',
} as const

export const resolutionTranslations: Record<Exclude<AppLanguage, 'en'>, Record<string, string>> = {
  es: {
    'Clarification:': 'Aclaración:',
    'Limitation:': 'Limitación:',
    'Checking the match…': 'Comprobando el partido…',
    'Loading the match…': 'Cargando el partido…',
    [RESOLUTION_MESSAGES.choice]: 'Más de un jugador coincide con tu texto: {players}. Elige a quién te refieres.',
    [RESOLUTION_MESSAGES.absent]:
      '«{name}» no coincide con nadie de las plantillas de este partido, así que no se seleccionó a ningún jugador ni se calculó nada. Abre «Ver las plantillas» para ver quién está disponible.',
    [RESOLUTION_MESSAGES.unsupported]:
      'He reconocido a {players}, pero todavía no puedo responder a esa formulación. Prueba a preguntar cómo jugó o cuántos pases completó.',
    [RESOLUTION_MESSAGES.unclear]:
      'No he podido saber a qué equipo o jugador te refieres, así que no se calculó nada. Nombra un equipo o jugador y qué quieres saber.',
    [RESOLUTION_MESSAGES.providerWording]: 'Texto del proveedor (tal como se recibió, sin traducir)',
  },
  fr: {
    'Clarification:': 'Précision :',
    'Limitation:': 'Limite :',
    'Checking the match…': 'Vérification du match…',
    'Loading the match…': 'Chargement du match…',
    [RESOLUTION_MESSAGES.choice]: 'Plusieurs joueurs correspondent à votre formulation : {players}. Choisissez celui que vous voulez dire.',
    [RESOLUTION_MESSAGES.absent]:
      '« {name} » ne correspond à personne dans les effectifs de ce match : aucun joueur n’a été sélectionné et rien n’a été calculé. Ouvrez « Voir les effectifs » pour voir qui est disponible.',
    [RESOLUTION_MESSAGES.unsupported]:
      'J’ai reconnu {players}, mais je ne peux pas encore répondre à cette formulation. Essayez de demander comment il a joué ou combien de passes il a réussies.',
    [RESOLUTION_MESSAGES.unclear]:
      'Je n’ai pas pu déterminer l’équipe ou le joueur visé : rien n’a été calculé. Nommez une équipe ou un joueur et ce que vous voulez savoir.',
    [RESOLUTION_MESSAGES.providerWording]: 'Formulation du fournisseur (telle que reçue, non traduite)',
  },
  de: {
    'Clarification:': 'Rückfrage:',
    'Limitation:': 'Einschränkung:',
    'Checking the match…': 'Spiel wird geprüft…',
    'Loading the match…': 'Spiel wird geladen…',
    [RESOLUTION_MESSAGES.choice]: 'Mehrere Spieler passen zu deiner Formulierung: {players}. Wähle, wen du meinst.',
    [RESOLUTION_MESSAGES.absent]:
      '„{name}“ passt zu keinem Spieler in den Kadern dieses Spiels. Es wurde kein Spieler ausgewählt und nichts berechnet. Öffne „Kader ansehen“, um zu sehen, wer verfügbar ist.',
    [RESOLUTION_MESSAGES.unsupported]:
      'Ich habe {players} erkannt, kann diese Formulierung aber noch nicht beantworten. Frag zum Beispiel, wie er gespielt hat oder wie viele Pässe er abgeschlossen hat.',
    [RESOLUTION_MESSAGES.unclear]:
      'Ich konnte nicht erkennen, welches Team oder welchen Spieler du meinst, daher wurde nichts berechnet. Nenne ein Team oder einen Spieler und was du wissen möchtest.',
    [RESOLUTION_MESSAGES.providerWording]: 'Wortlaut des Anbieters (unverändert, nicht übersetzt)',
  },
  ar: {
    'Clarification:': 'توضيح:',
    'Limitation:': 'القيد:',
    'Checking the match…': 'جارٍ التحقق من المباراة…',
    'Loading the match…': 'جارٍ تحميل المباراة…',
    [RESOLUTION_MESSAGES.choice]: 'ينطبق وصفك على أكثر من لاعب: {players}. اختر من تقصد.',
    [RESOLUTION_MESSAGES.absent]:
      'لا يطابق «{name}» أي لاعب في تشكيلتي هذه المباراة، لذلك لم يُختر أي لاعب ولم يُحسب شيء. افتح «عرض التشكيلات» لمعرفة اللاعبين المتاحين.',
    [RESOLUTION_MESSAGES.unsupported]:
      'تعرّفت على {players}، لكن لا يمكنني الإجابة عن هذه الصياغة بعد. جرّب أن تسأل كيف لعب أو كم تمريرة أكمل.',
    [RESOLUTION_MESSAGES.unclear]:
      'لم أستطع تحديد الفريق أو اللاعب الذي تقصده، لذلك لم يُحسب شيء. اذكر فريقاً أو لاعباً وما تريد معرفته.',
    [RESOLUTION_MESSAGES.providerWording]: 'صياغة المزوّد (كما وردت، دون ترجمة)',
  },
}
