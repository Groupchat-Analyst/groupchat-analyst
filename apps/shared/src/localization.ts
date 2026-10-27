export type AppLanguage = 'en' | 'es' | 'fr' | 'de' | 'ar'

export const APP_LANGUAGES: ReadonlyArray<{
  code: AppLanguage
  label: string
  nativeLabel: string
  direction: 'ltr' | 'rtl'
}> = [
  { code: 'en', label: 'English', nativeLabel: 'English', direction: 'ltr' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', direction: 'ltr' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', direction: 'ltr' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', direction: 'ltr' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', direction: 'rtl' },
]

export const DEFAULT_LANGUAGE: AppLanguage = 'en'

const translations: Partial<Record<Exclude<AppLanguage, 'en'>, Record<string, string>>> = {
  es: {
    'Checked.': 'Comprobada.',
    'Original match': 'Partido original',
    'Return match': 'Partido de vuelta',
    'Westhaven fixture': 'Partido de Westhaven',
    'Redmere fixture': 'Partido de Redmere',
    'Explore this fictional match through its recorded events and evidence.': 'Explora este partido ficticio mediante sus eventos registrados y pruebas.',
    'A fictional football fixture for exploring evidence at selected moments.': 'Un partido de fútbol ficticio para explorar pruebas en momentos concretos.',
    'Recorded moment': 'Momento registrado',
    'See how one minute changes the opinion': 'Mira cómo cambia la opinión en un minuto',
    'The two checks interpret this opinion differently, so they cannot be compared directly.': 'Las dos comprobaciones interpretan esta opinión de forma distinta, así que no se pueden comparar directamente.',
    'An illustrative preview of the fictional replay, written from verified local-rule answers. It is not a live conversation and no AI model is involved.': 'Vista previa ilustrativa de la repetición ficticia, basada en respuestas verificadas por reglas locales. No es una conversación en directo y no interviene ningún modelo de IA.',
    'Evidence receipt at': 'Comprobante de pruebas en',
    'Illustrative · fictional replay · local rules ·': 'Ilustrativo · repetición ficticia · reglas locales ·',
    'Illustrative': 'Ilustrativo',
    'fictional replay': 'repetición ficticia',
    'Original match v': 'Partido original v',
    '· Original match v': '· Partido original v',
    'Return match v': 'Partido de vuelta v',
    'Westhaven fixture v': 'Partido de Westhaven v',
    'Redmere fixture v': 'Partido de Redmere v',
    'Extended card ·': 'Tarjeta ampliada ·',
    'Key facts': 'Datos clave',
    'Selected recorded moments': 'Momentos registrados seleccionados',
    'Evidence against': 'Pruebas en contra',
    'Verdict:': 'Veredicto:',
    At: 'En',
    'Groupchat Analyst home': 'Inicio de Groupchat Analyst',
    Matches: 'Partidos',
    'All matches': 'Todos los partidos',
    'Synthetic demo': 'Demo ficticia',
    'Choose a match': 'Elige un partido',
    'Fictional matches, each with its own story. Pick one to start.': 'Partidos ficticios, cada uno con su propia historia. Elige uno para empezar.',
    'That match isn’t available. Choose one below.': 'Ese partido no está disponible. Elige uno de la lista.',
    'example opinions': 'opiniones de ejemplo',
    '· fictional ·': '· ficticio ·',
    'Type an opinion, e.g. How many shots did Eastport have?': 'Escribe una opinión, por ejemplo: ¿Cuántos tiros tuvo Eastport?',
    'Type an opinion, e.g. How many shots did Kingswell City have?': 'Escribe una opinión, por ejemplo: ¿Cuántos tiros tuvo Kingswell City?',
    'Type an opinion, e.g. How many shots did Alderwick United have?': 'Escribe una opinión, por ejemplo: ¿Cuántos tiros tuvo Alderwick United?',
    'A counter-attacking effort goes wide.': 'Un contraataque termina fuera.',
    'The replay is ready.': 'La repetición está lista.',
    'Skip to your opinion': 'Ir directamente a tu opinión',
    Play: 'Reproducir',
    Pause: 'Pausar',
    Replay: 'Repetir',
    'Football opinions. A fuller picture.': 'Opiniones de fútbol. Una visión más completa.',
    'Demo match analysis': 'Análisis de partido de demostración',
    You: 'Tú',
    'Northbridge covered more distance than Eastport': 'Northbridge recorrió más distancia que Eastport',
    'Physical data that is not recorded': 'Dato físico no registrado',
    'Synthetic data': 'Datos sintéticos',
    'fictional match': 'partido ficticio',
    'read by local rules': 'interpretado por reglas locales',
    'read by Foundry (server-side)': 'interpretado por Foundry (en el servidor)',
    fictional: 'ficticio',
    'Football opinions. Checked.': 'Opiniones de fútbol. Comprobadas.',
    'Your mate’s football opinion.': 'La opinión de tu colega sobre fútbol.',
    'Your mate’s football opinion. Checked.': 'La opinión de tu colega sobre fútbol. Comprobada.',
    'Pick a match. Check the moment. Bring the evidence back to the chat.': 'Elige un partido. Comprueba el minuto. Comparte las pruebas en el chat.',
    'The answer can change as the match goes on, so check the same opinion again a minute later.': 'La respuesta puede cambiar durante el partido: vuelve a comprobar la misma opinión un minuto después.',
    'Try it Out': 'Probar',
    'Fictional matches · Local rules · No AI model connected': 'Partidos ficticios · Reglas locales · Sin modelo de IA conectado',
    'Same opinion. Different minute.': 'La misma opinión. Otro minuto.',
    'Preview match minute': 'Minuto de la vista previa',
    'Illustrative conversation': 'Conversación ilustrativa',
    'Evidence receipt': 'Comprobante de pruebas',
    Opinion: 'Opinión',
    'Original wording': 'Texto original',
    Verdict: 'Veredicto',
    'Shots on target': 'Tiros a puerta',
    'shots on target': 'tiros a puerta',
    possession: 'posesión',
    'pass completion': 'precisión de pase',
    'pass attempts': 'intentos de pase',
    'pass completions': 'pases completados',
    'Descriptive statistics are provided from recorded synthetic passes. Pass-completion percentage is not available when no attempts are recorded; zero attempts is distinct from attempted passes with no completions.': 'Se ofrecen estadísticas descriptivas a partir de los pases sintéticos registrados. El porcentaje de pases completados no está disponible si no se registraron intentos; cero intentos es distinto de intentos registrados sin pases completados.',
    'elapsed participation minutes (recorded window; added time included)': 'minutos transcurridos de participación (ventana registrada; incluye el tiempo añadido)',
    'recorded recoveries': 'recuperaciones registradas',
    'selected pressure observations': 'observaciones de presión seleccionadas',
    shots: 'tiros',
    goals: 'goles',
    'passes completed': 'pases completados',
    'passes attempted': 'pases intentados',
    'pressure observations': 'observaciones de presión',
    'goal events': 'eventos de gol',
    'shot events': 'eventos de tiro',
    'player events': 'eventos de jugador',
    passing: 'pases',
    'possession losses': 'pérdidas de posesión',
    'physical measurements': 'mediciones físicas',
    'build up phase': 'fase de construcción',
    'territorial control': 'control territorial',
    lineups: 'alineaciones',
    'shot location': 'ubicación del tiro',
    'factual claim': 'afirmación factual',
    'statistical request': 'solicitud estadística',
    'subjective judgement': 'valoración subjetiva',
    'coaching question': 'pregunta táctica',
    'unavailable metric': 'métrica no disponible',
    'unrecognized language': 'lenguaje no reconocido',
    'elapsed minutes': 'minutos transcurridos',
    'Match score (a different figure)': 'Marcador (un dato distinto)',
    'Checked at': 'Comprobado en el minuto',
    'How it works': 'Cómo funciona',
    'Enter an opinion': 'Escribe una opinión',
    'Check a moment': 'Comprueba un minuto',
    'Check again and share': 'Vuelve a comprobar y comparte',
    'Nothing is checked until you press the check button.': 'No se comprueba nada hasta que pulses el botón.',
    'Built for your group chat.': 'Creado para las conversaciones de tu grupo.',
    'Check an opinion here, then share the evidence with your mates. A WhatsApp companion is planned; this demo doesn’t connect to your chats.': 'Comprueba aquí una opinión y comparte las pruebas con tus amigos. Está prevista una versión para WhatsApp; esta demo no se conecta a tus chats.',
    'What this demo is, and is not': 'Qué es y qué no es esta demo',
    'Every match is fictional. Players carry real names as invented identities; no performance, result or statistic is real.': 'Todos los partidos son ficticios. Los jugadores usan nombres reales como identidades inventadas; ninguna actuación, resultado o estadística es real.',
    'Opinions are read by a limited local rule set, not an AI model. Unfamiliar wording may be declined or answered with a question.': 'Las opiniones se interpretan con reglas locales limitadas, no con un modelo de IA. Puede que no se reconozcan expresiones poco habituales o que se pida una aclaración.',
    'Evidence comes from a sampled synthetic event record. There is no video, tracking, chance quality or defensive-shape data.': 'Las pruebas proceden de una muestra sintética de eventos. No hay vídeo, seguimiento, calidad de ocasiones ni datos de estructura defensiva.',
    'Answers live in your browser and are lost on refresh. Nothing is stored or sent anywhere except your opinion and the chosen minute for checking.': 'Las respuestas permanecen en el navegador y se pierden al actualizar la página. No se guarda ni envía nada salvo tu opinión y el minuto elegido para comprobarla.',
    Language: 'Idioma',
    'Fictional match replay': 'Repetición de partido ficticio',
    'Replay controls': 'Controles de repetición',
    'Play replay': 'Reproducir repetición',
    'Pause replay': 'Pausar repetición',
    'Replay from kick-off': 'Repetir desde el inicio',
    'Back one minute': 'Retroceder un minuto',
    'Forward one minute': 'Avanzar un minuto',
    'Match time': 'Minuto del partido',
    'Jump to a key moment': 'Ir a un momento clave',
    'Showing the last loaded moment': 'Mostrando el último minuto cargado',
    'The match could not be loaded.': 'No se pudo cargar el partido.',
    'The match could not be loaded. The last loaded moment is still shown.': 'No se pudo cargar el partido. Se sigue mostrando el último momento cargado.',
    'Loading…': 'Cargando…',
    Conversation: 'Conversación',
    'Answer detail': 'Detalle de la respuesta',
    Fan: 'Aficionado',
    Analyst: 'Analista',
    'Opinions and answers': 'Opiniones y respuestas',
    'Pick an example or type an opinion. I’ll check it against this match at the minute you choose.': 'Elige un ejemplo o escribe una opinión. La comprobaré con este partido en el minuto que selecciones.',
    'Your opinion': 'Tu opinión',
    'Asking about': 'Consultando el minuto',
    Change: 'Cambiar',
    'Evidence period': 'Periodo de las pruebas',
    'Match so far': 'Hasta ahora',
    'Last 10 minutes': 'Últimos 10 minutos',
    'First half': 'Primera parte',
    'Second half': 'Segunda parte',
    'Check this moment': 'Comprobar este minuto',
    'Checking…': 'Comprobando…',
    'Moving…': 'Avanzando…',
    'Example opinions': 'Opiniones de ejemplo',
    'Examples (these fill the box; nothing is sent until you check)': 'Ejemplos (rellenan el cuadro; no se envían hasta que compruebes)',
    'Fictional match: every performance and result is invented.': 'Partido ficticio: todas las actuaciones y resultados son inventados.',
    'Groupchat Analyst': 'Groupchat Analyst',
    'Claim': 'Afirmación',
    Supported: 'Respaldada',
    Contradicted: 'Contradicha',
    'Not enough evidence for a firm conclusion': 'No hay pruebas suficientes para una conclusión firme',
    'Needs clarification': 'Necesita aclaración',
    'Clarification needed': 'Aclaración necesaria',
    'Statistics only, no verdict': 'Solo estadísticas, sin veredicto',
    'Data not recorded': 'Dato no registrado',
    'Not understood': 'No se ha entendido',
    'Clarification:': 'Aclaración:',
    Limitation: 'Limitación',
    'Limitation:': 'Limitación:',
    Limitations: 'Limitaciones',
    'View evidence': 'Ver pruebas',
    Subject: 'Sujeto',
    'What we understood': 'Qué hemos entendido',
    'Request type': 'Tipo de solicitud',
    'Selected period': 'Periodo seleccionado',
    'Historical anchor': 'Referencia histórica',
    'Evidence needs': 'Pruebas necesarias',
    available: 'disponible',
    'not recorded': 'no registrado',
    'Statistic request answered from the selected records': 'Solicitud estadística respondida con los registros seleccionados',
    'The list below contains the relevant attributed records. Calculation denominators are available in the expandable trace.': 'La lista contiene los registros pertinentes y atribuidos. Los denominadores del cálculo aparecen en el detalle desplegable.',
    'These recorded events provide context, not a complete performance measure or verdict on the broader judgement.': 'Estos eventos registrados aportan contexto, no una medida completa del rendimiento ni un veredicto sobre la valoración general.',
    'Recorded turnover locations and linked passes': 'Ubicación de pérdidas registradas y pases relacionados',
    'No matching recorded evidence': 'No hay pruebas registradas coincidentes',
    'No unrelated event lists or statistics are substituted for this request.': 'No se sustituyen por listas de eventos o estadísticas no relacionadas.',
    'Relevant retrieved events': 'Eventos pertinentes recuperados',
    'These fixture events provide context for this opinion; they do not prove a subjective assessment.': 'Estos eventos del partido contextualizan la opinión, pero no demuestran una valoración subjetiva.',
    'How this was calculated': 'Cómo se calculó',
    'Player statistics': 'Estadísticas del jugador',
    'Answer ready': 'Respuesta lista',
    'Technical record · IDs': 'Registro técnico · identificadores',
    'Match data & coverage': 'Datos del partido y cobertura',
    'SOURCE & COVERAGE': 'FUENTE Y COBERTURA',
    'Synthetic fixture': 'Partido sintético',
    'Pass map': 'Mapa de pases',
    'Explore the pass map': 'Explorar el mapa de pases',
    'Follow the ball.': 'Sigue el balón.',
    'Selected match window': 'Ventana seleccionada del partido',
    'Pass map team': 'Equipo del mapa de pases',
    'Completed': 'Completado',
    'Incomplete · dashed': 'Incompleto · discontinuo',
    'Attack direction →': 'Dirección del ataque →',
    'Inspect a pass': 'Examinar un pase',
    'Completed pass': 'Pase completado',
    'Incomplete pass': 'Pase incompleto',
    'Technical record · IDs and original source wording (English)': 'Registro técnico · identificadores y texto original de origen (inglés)',
    'The descriptions above are localized. The records below retain original English source wording.': 'Las descripciones anteriores están traducidas. Los registros siguientes conservan la redacción original en inglés.',
    'Original source wording (English):': 'Redacción original de origen (inglés):',
    'Explore match events': 'Explorar eventos del partido',
    'Ask about a player': 'Preguntar por un jugador',
    'Fictional matchday squad': 'Plantilla ficticia del partido',
    'Choose a player': 'Elige un jugador',
    'Player clarification': 'Aclaración sobre el jugador',
    'Resolving your selection…': 'Resolviendo tu selección…',
    'Player selection failed.': 'No se pudo completar la selección del jugador.',
    'Player selected by you; no additional model call was made.': 'Has elegido al jugador; no se realizó otra llamada al modelo.',
    'Use this player': 'Usar este jugador',
    'About this demo & its data': 'Acerca de esta demo y sus datos',
    'Copy reply': 'Copiar respuesta',
    'Copy card text': 'Copiar texto de la tarjeta',
    'Download card image': 'Descargar imagen de la tarjeta',
    'Preview share card': 'Vista previa de la tarjeta para compartir',
    'Share what changed': 'Compartir los cambios',
    'Share the receipts': 'Compartir los comprobantes',
    'Copy what-changed text': 'Copiar texto de los cambios',
    'Download extended card': 'Descargar tarjeta ampliada',
    'What changed': 'Qué ha cambiado',
    Windows: 'Ventanas',
    Definition: 'Definición',
    Figure: 'Dato',
    Assessments: 'Valoraciones',
    'Calculation traces and coverage are in the claim details below.': 'Los cálculos y la cobertura están en los detalles de la afirmación.',
    'Earlier answer': 'Respuesta anterior',
    'Checked against': 'Comprobado con',
    'Local rules · no model connection': 'Reglas locales · sin conexión a un modelo',
    'Foundry · server-side interpretation': 'Foundry · interpretación en el servidor',
    'Foundry interpretation': 'Interpretación de Foundry',
    'Server-side local rule-based interpreter (no model connection). Statistics are still calculated by the application, not by AI.': 'Intérprete local basado en reglas en el servidor, sin conexión a un modelo. La aplicación calcula las estadísticas; no las calcula la IA.',
    'The guided demonstration only prepares a fictional 57′ replay and its opinion; nothing is checked until you press the submit button, and the 58′ re-check is also your choice. Local-rules reading is limited to a small set of phrasings, so unfamiliar wording may be declined.': 'La demostración guiada solo prepara una repetición ficticia en el 57′ y su opinión; no se comprueba nada hasta que pulses enviar, y la nueva comprobación en el 58′ también depende de ti. La lectura con reglas locales se limita a unas pocas expresiones, por lo que puede rechazar otras formulaciones.',
    '“Share the receipts” appears only where your browser can share image files. It hands the card image to your device’s share sheet and cannot tell whether anything was sent. Copy and download are always available.': 'La opción para compartir comprobantes solo aparece si tu navegador puede compartir imágenes. Envía la tarjeta al menú de compartir del dispositivo y no permite saber si se envió. Siempre puedes copiar o descargar.',
    'First-half stoppage time is 45+N′; second-half stoppage is 90+N′. Recent-minute windows exclude half-time. Historical “before” periods exclude the anchored event and all later events.': 'El tiempo añadido de la primera parte es 45+N′ y el de la segunda, 90+N′. Las ventanas de minutos recientes excluyen el descanso. Los periodos históricos «antes de» excluyen el evento de referencia y todos los posteriores.',
    'Fictional match': 'Partido ficticio',
    'Local rules demo': 'Demo de reglas locales',
    'How this was checked': 'Cómo se comprobó',
    'You ·': 'Tú ·',
    'This server is using limited local rules to read questions, with no model connection. It understands a small set of football phrasings.': 'Este servidor usa reglas locales limitadas para interpretar preguntas, sin conexión a un modelo. Reconoce un conjunto reducido de expresiones futbolísticas.',
    'Microsoft Foundry structured-output model. Statistics are still calculated by the application, not by AI.': 'Modelo de salida estructurada de Microsoft Foundry. La aplicación calcula las estadísticas; no las calcula la IA.',
    'The analysis service has not yet reported how it reads questions.': 'El servicio de análisis aún no ha indicado cómo interpreta las preguntas.',
    'Match statistics use the selected time and evidence period. Possession uses recorded controlled time only; contested and out-of-play time are excluded. Build-up and pressure observations cover selected samples.': 'Las estadísticas del partido usan la hora y el periodo de evidencia seleccionados. La posesión se calcula solo con tiempo controlado registrado; se excluyen el juego disputado y el tiempo fuera de juego. Las observaciones de construcción y presión cubren muestras seleccionadas.',
    'Player tracking, video, running distance, defensive shape and calibrated expected goals are not recorded. A missing measurement is not a zero.': 'No se registran seguimiento de jugadores, vídeo, distancia recorrida, forma defensiva ni goles esperados calibrados. La ausencia de una medición no equivale a cero.',
    'The analysis service returned an incomplete answer.': 'El servicio de análisis devolvió una respuesta incompleta.',
    'The analysis service answered for a different match, so the reply was not shown.': 'El servicio de análisis respondió sobre otro partido, por lo que no se mostró la respuesta.',
    'The analysis service could not be reached.': 'No se pudo conectar con el servicio de análisis.',
    'Limitations:': 'Limitaciones:',
    supported: 'respaldada',
    contradicted: 'contradicha',
    'insufficient evidence for a firm conclusion': 'pruebas insuficientes para una conclusión firme',
    'clarification needed': 'aclaración necesaria',
    'unavailable data': 'datos no disponibles',
    'statistics only, no verdict': 'solo estadísticas, sin veredicto',
    'This is a comparison of recorded events in the synthetic fixture, not a claim about chance quality or overall performance.': 'Esto compara eventos registrados de un partido sintético; no afirma nada sobre la calidad de las ocasiones ni el rendimiento general.',
    'Try again': 'Intentar de nuevo',
    'That check didn’t finish. Please try again.': 'La comprobación no terminó. Inténtalo de nuevo.',
    'Your earlier answer is still above.': 'Tu respuesta anterior sigue arriba.',
    Details: 'Detalles',
    'Reply copied.': 'Respuesta copiada.',
    'Card text copied.': 'Texto de la tarjeta copiado.',
    'What-changed text copied.': 'Texto de los cambios copiado.',
    'Clipboard access is unavailable. Select the card text above and copy it manually.': 'No se puede acceder al portapapeles. Selecciona y copia manualmente el texto de la tarjeta.',
    'Select the reply above and copy it manually.': 'Selecciona y copia manualmente la respuesta.',
    'Card image downloaded.': 'Imagen de la tarjeta descargada.',
    'Extended card image downloaded.': 'Imagen de la tarjeta ampliada descargada.',
    'Image download is unavailable. Copy the card text instead.': 'No se puede descargar la imagen. Copia el texto de la tarjeta.',
    'Same opinion, one minute later in the fictional replay.': 'La misma opinión, un minuto después en la repetición ficticia.',
    'Move to 58′': 'Ir al 58′',
    'The replay is at 58′. Use “Check again” to ask the same opinion against the new evidence.': 'La repetición está en el 58′. Pulsa «Volver a comprobar» para contrastar la misma opinión con nuevas pruebas.',
    'Check again': 'Volver a comprobar',
    'Same wording, same': 'Mismo texto, mismo',
    'The latest reply is for the saved opinion above': 'La última respuesta corresponde a la opinión guardada arriba',
    'Check this moment submits the edited wording instead': '«Comprobar este minuto» envía el texto editado',
    'Try the 57′ → 58′ demo': 'Probar la demo del 57′ → 58′',
    'Match selection': 'Selección de partido',
    'No matching event references in this section.': 'No hay referencias a eventos coincidentes en esta sección.',
    'Shareable card preview': 'Vista previa de la tarjeta para compartir',
    'What-changed card preview': 'Vista previa de la tarjeta de cambios',
    'Not available': 'No disponible',
    'Unrecorded player': 'Jugador no registrado',
    'Recorded events in match order': 'Eventos registrados por orden del partido',
    'Nothing recorded yet.': 'Aún no hay eventos registrados.',
    'Nothing has been recorded yet.': 'Todavía no se ha registrado nada.',
    'Latest recorded moment': 'Último momento registrado',
    'One recorded event — it does not show who is on top.': 'Un evento registrado no demuestra qué equipo domina.',
    'All recorded events': 'Todos los eventos registrados',
    recorded: 'registrados',
    starter: 'titular',
    substitute: 'suplente',
    Yes: 'Sí',
    No: 'No',
    'Selected pressure records': 'Observaciones de presión seleccionadas',
  },
  fr: {
    'Checked.': 'Vérifié.',
    'Original match': 'Match original',
    'Return match': 'Match retour',
    'Westhaven fixture': 'Match de Westhaven',
    'Redmere fixture': 'Match de Redmere',
    'Explore this fictional match through its recorded events and evidence.': 'Explorez ce match fictif à travers ses événements enregistrés et ses preuves.',
    'A fictional football fixture for exploring evidence at selected moments.': 'Un match de football fictif pour explorer les preuves à des moments précis.',
    'Recorded moment': 'Moment enregistré',
    'See how one minute changes the opinion': 'Voyez comment un avis change en une minute',
    'The two checks interpret this opinion differently, so they cannot be compared directly.': 'Les deux vérifications interprètent cet avis différemment ; elles ne peuvent donc pas être comparées directement.',
    'An illustrative preview of the fictional replay, written from verified local-rule answers. It is not a live conversation and no AI model is involved.': 'Aperçu illustratif de la rediffusion fictive, rédigé à partir de réponses vérifiées par les règles locales. Ce n’est pas une conversation en direct et aucun modèle d’IA n’intervient.',
    'Evidence receipt at': 'Reçu des preuves à',
    'Illustrative · fictional replay · local rules ·': 'Illustratif · rediffusion fictive · règles locales ·',
    'Illustrative': 'Illustratif',
    'fictional replay': 'rediffusion fictive',
    'Original match v': 'Match original v',
    '· Original match v': '· Match original v',
    'Return match v': 'Match retour v',
    'Westhaven fixture v': 'Match de Westhaven v',
    'Redmere fixture v': 'Match de Redmere v',
    'Extended card ·': 'Carte détaillée ·',
    'Key facts': 'Faits clés',
    'Selected recorded moments': 'Moments enregistrés sélectionnés',
    'Evidence against': 'Éléments contraires',
    'Verdict:': 'Verdict :',
    At: 'À',
    'Groupchat Analyst home': 'Accueil Groupchat Analyst',
    Matches: 'Matchs',
    'All matches': 'Tous les matchs',
    'Synthetic demo': 'Démo fictive',
    'Choose a match': 'Choisir un match',
    'Fictional matches, each with its own story. Pick one to start.': 'Des matchs fictifs, chacun avec son histoire. Choisissez-en un pour commencer.',
    'That match isn’t available. Choose one below.': 'Ce match n’est pas disponible. Choisissez-en un ci-dessous.',
    'example opinions': 'avis exemples',
    '· fictional ·': '· fictif ·',
    'Type an opinion, e.g. How many shots did Eastport have?': 'Saisissez un avis, par exemple : combien de tirs Eastport a-t-il tentés ?',
    'Type an opinion, e.g. How many shots did Kingswell City have?': 'Saisissez un avis, par exemple : combien de tirs Kingswell City a-t-il tentés ?',
    'Type an opinion, e.g. How many shots did Alderwick United have?': 'Saisissez un avis, par exemple : combien de tirs Alderwick United a-t-il tentés ?',
    'A counter-attacking effort goes wide.': 'Une contre-attaque termine à côté.',
    'The replay is ready.': 'La rediffusion est prête.',
    'Skip to your opinion': 'Aller directement à votre avis',
    Play: 'Lire',
    Pause: 'Pause',
    Replay: 'Rejouer',
    'Football opinions. A fuller picture.': 'Les avis sur le football. Une vision plus complète.',
    'Demo match analysis': 'Analyse du match de démonstration',
    You: 'Vous',
    'Northbridge covered more distance than Eastport': 'Northbridge a parcouru plus de distance qu’Eastport',
    'Physical data that is not recorded': 'Donnée physique non enregistrée',
    'Synthetic data': 'Données synthétiques',
    'fictional match': 'match fictif',
    'read by local rules': 'interprété par les règles locales',
    'read by Foundry (server-side)': 'interprété par Foundry (côté serveur)',
    fictional: 'fictif',
    'Football opinions. Checked.': 'Les avis sur le football. Vérifiés.',
    'Your mate’s football opinion.': 'L’avis foot de votre ami.',
    'Your mate’s football opinion. Checked.': 'L’avis foot de votre ami. Vérifié.',
    'Pick a match. Check the moment. Bring the evidence back to the chat.': 'Choisissez un match. Vérifiez le moment. Ramenez les preuves dans la conversation.',
    'The answer can change as the match goes on, so check the same opinion again a minute later.': 'La réponse peut évoluer pendant le match : vérifiez à nouveau le même avis une minute plus tard.',
    'Try it Out': 'Essayer',
    'Fictional matches · Local rules · No AI model connected': 'Matchs fictifs · Règles locales · Aucun modèle d’IA connecté',
    'Same opinion. Different minute.': 'Même avis. Minute différente.',
    'Preview match minute': 'Minute de l’aperçu',
    'Illustrative conversation': 'Conversation illustrative',
    'Evidence receipt': 'Reçu de preuves',
    Opinion: 'Avis',
    'Original wording': 'Formulation originale',
    Verdict: 'Verdict',
    'Shots on target': 'Tirs cadrés',
    'shots on target': 'tirs cadrés',
    possession: 'possession',
    'pass completion': 'réussite des passes',
    'pass attempts': 'tentatives de passe',
    'pass completions': 'passes réussies',
    'Descriptive statistics are provided from recorded synthetic passes. Pass-completion percentage is not available when no attempts are recorded; zero attempts is distinct from attempted passes with no completions.': 'Les statistiques descriptives proviennent des passes synthétiques enregistrées. Le pourcentage de passes réussies n’est pas disponible si aucune tentative n’est enregistrée ; zéro tentative est différent de tentatives enregistrées sans passe réussie.',
    'elapsed participation minutes (recorded window; added time included)': 'minutes écoulées de participation (fenêtre enregistrée ; temps additionnel inclus)',
    'recorded recoveries': 'récupérations enregistrées',
    'selected pressure observations': 'observations de pressing sélectionnées',
    shots: 'tirs',
    goals: 'buts',
    'passes completed': 'passes réussies',
    'passes attempted': 'passes tentées',
    'pressure observations': 'observations de pressing',
    'goal events': 'événements de but',
    'shot events': 'événements de tir',
    'player events': 'événements de joueur',
    passing: 'passes',
    'possession losses': 'pertes de balle',
    'physical measurements': 'mesures physiques',
    'build up phase': 'phase de construction',
    'territorial control': 'contrôle territorial',
    lineups: 'compositions',
    'shot location': 'emplacement du tir',
    'factual claim': 'affirmation factuelle',
    'statistical request': 'demande statistique',
    'subjective judgement': 'jugement subjectif',
    'coaching question': 'question tactique',
    'unavailable metric': 'indicateur indisponible',
    'unrecognized language': 'langue non reconnue',
    'elapsed minutes': 'minutes écoulées',
    'Match score (a different figure)': 'Score du match (donnée distincte)',
    'Checked at': 'Vérifié à',
    'How it works': 'Comment ça marche',
    'Enter an opinion': 'Saisir un avis',
    'Check a moment': 'Vérifier un instant',
    'Check again and share': 'Vérifier à nouveau et partager',
    'Nothing is checked until you press the check button.': 'Rien n’est vérifié avant d’appuyer sur le bouton.',
    'Built for your group chat.': 'Conçu pour votre groupe de discussion.',
    'Check an opinion here, then share the evidence with your mates. A WhatsApp companion is planned; this demo doesn’t connect to your chats.': 'Vérifiez un avis ici, puis partagez les preuves avec vos amis. Un compagnon WhatsApp est prévu ; cette démo ne se connecte pas à vos discussions.',
    'What this demo is, and is not': 'Ce que cette démo est — et n’est pas',
    'Every match is fictional. Players carry real names as invented identities; no performance, result or statistic is real.': 'Tous les matchs sont fictifs. Les joueurs portent des noms réels comme identités inventées ; aucune performance, aucun résultat ni aucune statistique n’est réel.',
    'Opinions are read by a limited local rule set, not an AI model. Unfamiliar wording may be declined or answered with a question.': 'Les avis sont interprétés par un ensemble limité de règles locales, pas par un modèle d’IA. Une formulation inhabituelle peut être refusée ou donner lieu à une question.',
    'Evidence comes from a sampled synthetic event record. There is no video, tracking, chance quality or defensive-shape data.': 'Les preuves proviennent d’un échantillon synthétique d’événements. Il n’y a ni vidéo, ni suivi, ni qualité des occasions, ni données sur le bloc défensif.',
    'Answers live in your browser and are lost on refresh. Nothing is stored or sent anywhere except your opinion and the chosen minute for checking.': 'Les réponses restent dans votre navigateur et disparaissent au rechargement. Rien n’est stocké ni envoyé, hormis votre avis et la minute choisie pour la vérification.',
    Language: 'Langue',
    'Fictional match replay': 'Replay d’un match fictif',
    'Replay controls': 'Commandes du replay',
    'Play replay': 'Lancer le replay',
    'Pause replay': 'Mettre le replay en pause',
    'Replay from kick-off': 'Rejouer depuis le coup d’envoi',
    'Back one minute': 'Reculer d’une minute',
    'Forward one minute': 'Avancer d’une minute',
    'Match time': 'Temps de jeu',
    'Jump to a key moment': 'Aller à un moment clé',
    'Showing the last loaded moment': 'Affichage du dernier instant chargé',
    'The match could not be loaded.': 'Le match n’a pas pu être chargé.',
    'The match could not be loaded. The last loaded moment is still shown.': 'Le match n’a pas pu être chargé. Le dernier instant chargé reste affiché.',
    'Loading…': 'Chargement…',
    Conversation: 'Conversation',
    'Answer detail': 'Détail de la réponse',
    Fan: 'Supporter',
    Analyst: 'Analyste',
    'Opinions and answers': 'Avis et réponses',
    'Pick an example or type an opinion. I’ll check it against this match at the minute you choose.': 'Choisissez un exemple ou saisissez un avis. Je le vérifierai par rapport à ce match à la minute choisie.',
    'Your opinion': 'Votre avis',
    'Asking about': 'Question sur',
    Change: 'Modifier',
    'Evidence period': 'Période des preuves',
    'Match so far': 'Depuis le début du match',
    'Last 10 minutes': '10 dernières minutes',
    'First half': 'Première mi-temps',
    'Second half': 'Deuxième mi-temps',
    'Check this moment': 'Vérifier cet instant',
    'Checking…': 'Vérification…',
    'Moving…': 'Déplacement…',
    'Example opinions': 'Avis exemples',
    'Examples (these fill the box; nothing is sent until you check)': 'Exemples (ils remplissent le champ ; rien n’est envoyé avant vérification)',
    'Fictional match: every performance and result is invented.': 'Match fictif : toutes les performances et tous les résultats sont inventés.',
    'Groupchat Analyst': 'Groupchat Analyst',
    Claim: 'Affirmation',
    Supported: 'Confirmée',
    Contradicted: 'Contredite',
    'Not enough evidence for a firm conclusion': 'Preuves insuffisantes pour une conclusion ferme',
    'Needs clarification': 'À préciser',
    'Clarification needed': 'Précision nécessaire',
    'Statistics only, no verdict': 'Statistiques uniquement, sans verdict',
    'Data not recorded': 'Donnée non enregistrée',
    'Not understood': 'Non compris',
    'Clarification:': 'Précision :',
    Limitation: 'Limite',
    'Limitation:': 'Limite :',
    Limitations: 'Limites',
    'View evidence': 'Voir les preuves',
    Subject: 'Sujet',
    'What we understood': 'Ce que nous avons compris',
    'Request type': 'Type de demande',
    'Selected period': 'Période sélectionnée',
    'Historical anchor': 'Repère historique',
    'Evidence needs': 'Preuves nécessaires',
    available: 'disponible',
    'not recorded': 'non enregistré',
    'Statistic request answered from the selected records': 'Demande statistique calculée à partir des enregistrements sélectionnés',
    'The list below contains the relevant attributed records. Calculation denominators are available in the expandable trace.': 'La liste ci-dessous contient les enregistrements pertinents attribués. Les dénominateurs figurent dans le détail du calcul.',
    'These recorded events provide context, not a complete performance measure or verdict on the broader judgement.': 'Ces événements enregistrés apportent un contexte, pas une mesure complète ni un verdict sur cette appréciation générale.',
    'Recorded turnover locations and linked passes': 'Emplacements des pertes de balle enregistrées et passes associées',
    'No matching recorded evidence': 'Aucune preuve enregistrée correspondante',
    'No unrelated event lists or statistics are substituted for this request.': 'Aucune liste d’événements ni statistique sans rapport ne remplace cette demande.',
    'Relevant retrieved events': 'Événements pertinents récupérés',
    'These fixture events provide context for this opinion; they do not prove a subjective assessment.': 'Ces événements donnent du contexte à cet avis ; ils ne prouvent pas une appréciation subjective.',
    'How this was calculated': 'Méthode de calcul',
    'Player statistics': 'Statistiques du joueur',
    'Answer ready': 'Réponse prête',
    'Technical record · IDs': 'Données techniques · identifiants',
    'Match data & coverage': 'Données du match et couverture',
    'SOURCE & COVERAGE': 'SOURCE ET COUVERTURE',
    'Synthetic fixture': 'Match synthétique',
    'Explore the pass map': 'Explorer la carte des passes',
    'Follow the ball.': 'Suivre le ballon.',
    'Selected match window': 'Fenêtre de match sélectionnée',
    'Pass map team': 'Équipe de la carte des passes',
    Completed: 'Réussie',
    'Incomplete · dashed': 'Incomplète · pointillée',
    'Attack direction →': 'Sens de l’attaque →',
    'Inspect a pass': 'Examiner une passe',
    'Completed pass': 'Passe réussie',
    'Incomplete pass': 'Passe manquée',
    'Technical record · IDs and original source wording (English)': 'Données techniques · identifiants et texte source original (anglais)',
    'The descriptions above are localized. The records below retain original English source wording.': 'Les descriptions ci-dessus sont localisées. Les enregistrements ci-dessous conservent le texte source original en anglais.',
    'Original source wording (English):': 'Texte source original (anglais) :',
    'Explore match events': 'Explorer les événements du match',
    'Ask about a player': 'Interroger sur un joueur',
    'Fictional matchday squad': 'Effectif fictif du match',
    'Choose a player': 'Choisir un joueur',
    'Player clarification': 'Précision sur le joueur',
    'Resolving your selection…': 'Résolution de votre choix…',
    'Player selection failed.': 'La sélection du joueur a échoué.',
    'Player selected by you; no additional model call was made.': 'Vous avez choisi le joueur ; aucun nouvel appel au modèle n’a été effectué.',
    'Use this player': 'Utiliser ce joueur',
    'About this demo & its data': 'À propos de la démo et des données',
    'Copy reply': 'Copier la réponse',
    'Copy card text': 'Copier le texte de la carte',
    'Download card image': 'Télécharger la carte',
    'Preview share card': 'Aperçu de la carte à partager',
    'Share what changed': 'Partager les changements',
    'Share the receipts': 'Partager les reçus',
    'Copy what-changed text': 'Copier le texte des changements',
    'Download extended card': 'Télécharger la carte détaillée',
    'What changed': 'Ce qui a changé',
    Windows: 'Périodes',
    Definition: 'Définition',
    Figure: 'Donnée',
    Assessments: 'Évaluations',
    'Calculation traces and coverage are in the claim details below.': 'Les traces de calcul et la couverture figurent dans les détails de l’affirmation ci-dessous.',
    'Earlier answer': 'Réponse précédente',
    'Checked against': 'Vérifié par rapport à',
    'Local rules · no model connection': 'Règles locales · sans connexion à un modèle',
    'Foundry · server-side interpretation': 'Foundry · interprétation côté serveur',
    'Foundry interpretation': 'Interprétation Foundry',
    'Server-side local rule-based interpreter (no model connection). Statistics are still calculated by the application, not by AI.': 'Interpréteur local à règles côté serveur, sans connexion à un modèle. Les statistiques sont calculées par l’application, pas par l’IA.',
    'The guided demonstration only prepares a fictional 57′ replay and its opinion; nothing is checked until you press the submit button, and the 58′ re-check is also your choice. Local-rules reading is limited to a small set of phrasings, so unfamiliar wording may be declined.': 'La démonstration guidée prépare uniquement un replay fictif à 57′ et son avis ; rien n’est vérifié avant votre envoi, et le nouveau contrôle à 58′ reste également à votre initiative. Les règles locales ne reconnaissent qu’un nombre limité de formulations ; les autres peuvent être refusées.',
    '“Share the receipts” appears only where your browser can share image files. It hands the card image to your device’s share sheet and cannot tell whether anything was sent. Copy and download are always available.': 'Le partage des reçus n’apparaît que si votre navigateur peut partager des fichiers image. La carte est transmise au menu de partage de l’appareil, sans savoir si elle a été envoyée. La copie et le téléchargement restent toujours disponibles.',
    'First-half stoppage time is 45+N′; second-half stoppage is 90+N′. Recent-minute windows exclude half-time. Historical “before” periods exclude the anchored event and all later events.': 'Le temps additionnel de la première période est 45+N′, celui de la seconde 90+N′. Les fenêtres récentes excluent la mi-temps. Les périodes historiques « avant » excluent l’événement de référence et tous les événements ultérieurs.',
    'Fictional match': 'Match fictif',
    'Local rules demo': 'Démo avec règles locales',
    'How this was checked': 'Comment cela a été vérifié',
    'You ·': 'Vous ·',
    'This server is using limited local rules to read questions, with no model connection. It understands a small set of football phrasings.': 'Ce serveur utilise un ensemble limité de règles locales pour interpréter les questions, sans connexion à un modèle. Il reconnaît un petit nombre de formulations footballistiques.',
    'Microsoft Foundry structured-output model. Statistics are still calculated by the application, not by AI.': 'Modèle à sortie structurée Microsoft Foundry. Les statistiques sont calculées par l’application, pas par l’IA.',
    'The analysis service has not yet reported how it reads questions.': 'Le service d’analyse n’a pas encore indiqué comment il interprète les questions.',
    'Match statistics use the selected time and evidence period. Possession uses recorded controlled time only; contested and out-of-play time are excluded. Build-up and pressure observations cover selected samples.': 'Les statistiques utilisent l’heure et la période de preuves sélectionnées. La possession repose uniquement sur le temps de contrôle enregistré ; les phases disputées et hors jeu sont exclues. La construction et les observations de pressing ne couvrent que des échantillons sélectionnés.',
    'Player tracking, video, running distance, defensive shape and calibrated expected goals are not recorded. A missing measurement is not a zero.': 'Le suivi des joueurs, la vidéo, la distance parcourue, l’organisation défensive et les buts attendus calibrés ne sont pas enregistrés. Une mesure absente n’est pas égale à zéro.',
    'The analysis service returned an incomplete answer.': 'Le service d’analyse a renvoyé une réponse incomplète.',
    'The analysis service answered for a different match, so the reply was not shown.': 'Le service d’analyse a répondu pour un autre match ; la réponse n’a donc pas été affichée.',
    'The analysis service could not be reached.': 'Le service d’analyse est inaccessible.',
    'Limitations:': 'Limites :',
    supported: 'étayée',
    contradicted: 'contredite',
    'insufficient evidence for a firm conclusion': 'éléments insuffisants pour conclure fermement',
    'clarification needed': 'précision nécessaire',
    'unavailable data': 'données indisponibles',
    'statistics only, no verdict': 'statistiques uniquement, sans verdict',
    'This is a comparison of recorded events in the synthetic fixture, not a claim about chance quality or overall performance.': 'Cette comparaison porte sur les événements enregistrés dans le match fictif ; elle ne renseigne ni sur la qualité des occasions ni sur la performance globale.',
    'Try again': 'Réessayer',
    'That check didn’t finish. Please try again.': 'La vérification n’a pas abouti. Veuillez réessayer.',
    'Your earlier answer is still above.': 'Votre réponse précédente est toujours affichée ci-dessus.',
    Details: 'Détails',
    'Reply copied.': 'Réponse copiée.',
    'Card text copied.': 'Texte de la carte copié.',
    'What-changed text copied.': 'Texte des changements copié.',
    'Clipboard access is unavailable. Select the card text above and copy it manually.': 'Le presse-papiers est inaccessible. Sélectionnez le texte ci-dessus et copiez-le manuellement.',
    'Select the reply above and copy it manually.': 'Sélectionnez la réponse ci-dessus et copiez-la manuellement.',
    'Card image downloaded.': 'Image de la carte téléchargée.',
    'Extended card image downloaded.': 'Image de la carte détaillée téléchargée.',
    'Image download is unavailable. Copy the card text instead.': 'Le téléchargement de l’image est indisponible. Copiez plutôt le texte de la carte.',
    'Same opinion, one minute later in the fictional replay.': 'Même avis, une minute plus tard dans le replay fictif.',
    'Move to 58′': 'Passer à 58′',
    'The replay is at 58′. Use “Check again” to ask the same opinion against the new evidence.': 'Le replay est à 58′. Utilisez « Vérifier à nouveau » pour confronter le même avis aux nouvelles preuves.',
    'Check again': 'Vérifier à nouveau',
    'The latest reply is for the saved opinion above': 'La dernière réponse correspond à l’avis enregistré ci-dessus',
    'Try the 57′ → 58′ demo': 'Essayer la démo 57′ → 58′',
    'No matching event references in this section.': 'Aucune référence à un événement correspondant dans cette section.',
    'Shareable card preview': 'Aperçu de la carte à partager',
    'What-changed card preview': 'Aperçu de la carte des changements',
    'Not available': 'Indisponible',
    'Unrecorded player': 'Joueur non enregistré',
    'Recorded events in match order': 'Événements enregistrés dans l’ordre du match',
    'Nothing recorded yet.': 'Aucun événement enregistré pour le moment.',
    'Nothing has been recorded yet.': 'Aucun événement n’a encore été enregistré.',
    'Latest recorded moment': 'Dernier moment enregistré',
    'One recorded event — it does not show who is on top.': 'Un événement enregistré ne montre pas quelle équipe domine.',
    'All recorded events': 'Tous les événements enregistrés',
    recorded: 'enregistrés',
    starter: 'titulaire',
    substitute: 'remplaçant',
    Yes: 'Oui',
    No: 'Non',
    'Selected pressure records': 'Observations de pression sélectionnées',
  },
  de: {
    'Checked.': 'Geprüft.',
    'Original match': 'Originalspiel',
    'Return match': 'Rückspiel',
    'Westhaven fixture': 'Westhaven-Spiel',
    'Redmere fixture': 'Redmere-Spiel',
    'Explore this fictional match through its recorded events and evidence.': 'Erkunde dieses fiktive Spiel anhand seiner aufgezeichneten Ereignisse und Belege.',
    'A fictional football fixture for exploring evidence at selected moments.': 'Ein fiktives Fußballspiel, um Belege zu ausgewählten Zeitpunkten zu erkunden.',
    'Recorded moment': 'Aufgezeichneter Moment',
    'See how one minute changes the opinion': 'Sieh, wie sich die Meinung in einer Minute ändert',
    'The two checks interpret this opinion differently, so they cannot be compared directly.': 'Die beiden Prüfungen interpretieren diese Meinung unterschiedlich und sind daher nicht direkt vergleichbar.',
    'An illustrative preview of the fictional replay, written from verified local-rule answers. It is not a live conversation and no AI model is involved.': 'Eine beispielhafte Vorschau der fiktiven Wiederholung auf Grundlage geprüfter Antworten der lokalen Regeln. Kein Live-Gespräch und kein KI-Modell ist beteiligt.',
    'Evidence receipt at': 'Beleg zum Zeitpunkt',
    'Illustrative · fictional replay · local rules ·': 'Beispielhaft · fiktive Wiederholung · lokale Regeln ·',
    'Illustrative': 'Beispielhaft',
    'fictional replay': 'fiktive Wiederholung',
    'Original match v': 'Originalspiel v',
    '· Original match v': '· Originalspiel v',
    'Return match v': 'Rückspiel v',
    'Westhaven fixture v': 'Westhaven-Spiel v',
    'Redmere fixture v': 'Redmere-Spiel v',
    'Extended card ·': 'Erweiterte Karte ·',
    'Key facts': 'Wichtige Fakten',
    'Selected recorded moments': 'Ausgewählte erfasste Momente',
    'Evidence against': 'Gegenbelege',
    'Verdict:': 'Urteil:',
    At: 'Bei',
    'Groupchat Analyst home': 'Groupchat Analyst Startseite',
    Matches: 'Spiele',
    'All matches': 'Alle Spiele',
    'Synthetic demo': 'Fiktive Demo',
    'Choose a match': 'Spiel auswählen',
    'Fictional matches, each with its own story. Pick one to start.': 'Fiktive Spiele mit jeweils eigener Geschichte. Wähle eines zum Starten.',
    'That match isn’t available. Choose one below.': 'Dieses Spiel ist nicht verfügbar. Wähle unten eines aus.',
    'example opinions': 'Beispielmeinungen',
    '· fictional ·': '· fiktiv ·',
    'Type an opinion, e.g. How many shots did Eastport have?': 'Gib eine Meinung ein, z. B.: Wie viele Schüsse hatte Eastport?',
    'Type an opinion, e.g. How many shots did Kingswell City have?': 'Gib eine Meinung ein, z. B.: Wie viele Schüsse hatte Kingswell City?',
    'Type an opinion, e.g. How many shots did Alderwick United have?': 'Gib eine Meinung ein, z. B.: Wie viele Schüsse hatte Alderwick United?',
    'A counter-attacking effort goes wide.': 'Ein Konter geht am Tor vorbei.',
    'The replay is ready.': 'Die Wiederholung ist bereit.',
    'Skip to your opinion': 'Direkt zur Meinung',
    Play: 'Abspielen',
    Pause: 'Pause',
    Replay: 'Wiederholen',
    'Football opinions. A fuller picture.': 'Fußballmeinungen. Ein vollständigeres Bild.',
    'Demo match analysis': 'Demo-Spielanalyse',
    You: 'Du',
    'Northbridge covered more distance than Eastport': 'Northbridge legte mehr Strecke zurück als Eastport',
    'Physical data that is not recorded': 'Nicht erfasste physische Daten',
    'Synthetic data': 'Synthetische Daten',
    'fictional match': 'fiktives Spiel',
    'read by local rules': 'mit lokalen Regeln interpretiert',
    'read by Foundry (server-side)': 'mit Foundry serverseitig interpretiert',
    fictional: 'fiktiv',
    'Football opinions. Checked.': 'Fußballmeinungen. Geprüft.',
    'Your mate’s football opinion.': 'Die Fußballmeinung deines Kumpels.',
    'Your mate’s football opinion. Checked.': 'Die Fußballmeinung deines Kumpels. Geprüft.',
    'Pick a match. Check the moment. Bring the evidence back to the chat.': 'Wähle ein Spiel. Prüfe den Moment. Bring die Belege zurück in den Chat.',
    'The answer can change as the match goes on, so check the same opinion again a minute later.': 'Die Antwort kann sich im Spielverlauf ändern. Prüfe dieselbe Meinung eine Minute später erneut.',
    'Try it Out': 'Ausprobieren',
    'Fictional matches · Local rules · No AI model connected': 'Fiktive Spiele · Lokale Regeln · Kein KI-Modell verbunden',
    'Same opinion. Different minute.': 'Gleiche Meinung. Andere Minute.',
    'Preview match minute': 'Vorschau-Spielminute',
    'Illustrative conversation': 'Beispielgespräch',
    'Evidence receipt': 'Beleg',
    Opinion: 'Meinung',
    'Original wording': 'Ursprünglicher Wortlaut',
    Verdict: 'Urteil',
    'Shots on target': 'Schüsse aufs Tor',
    'shots on target': 'Schüsse aufs Tor',
    possession: 'Ballbesitz',
    'pass completion': 'Passgenauigkeit',
    'pass attempts': 'Passversuche',
    'pass completions': 'vollständige Pässe',
    'Descriptive statistics are provided from recorded synthetic passes. Pass-completion percentage is not available when no attempts are recorded; zero attempts is distinct from attempted passes with no completions.': 'Beschreibende Statistiken beruhen auf erfassten synthetischen Pässen. Ein Passerfolgsprozentsatz ist nicht verfügbar, wenn keine Versuche erfasst wurden; null Versuche unterscheiden sich von erfassten Versuchen ohne erfolgreichen Pass.',
    'elapsed participation minutes (recorded window; added time included)': 'verstrichene Teilnahmeminuten (erfasster Zeitraum; Nachspielzeit eingeschlossen)',
    'recorded recoveries': 'erfasste Rückeroberungen',
    'selected pressure observations': 'ausgewählte Pressing-Beobachtungen',
    shots: 'Schüsse',
    goals: 'Tore',
    'passes completed': 'vollständige Pässe',
    'passes attempted': 'Passversuche',
    'pressure observations': 'Pressing-Beobachtungen',
    'goal events': 'Torereignisse',
    'shot events': 'Schussereignisse',
    'player events': 'Spielerereignisse',
    passing: 'Pässe',
    'possession losses': 'Ballverluste',
    'physical measurements': 'körperliche Messwerte',
    'build up phase': 'Aufbauphase',
    'territorial control': 'Raumkontrolle',
    lineups: 'Aufstellungen',
    'shot location': 'Schussposition',
    'factual claim': 'Tatsachenbehauptung',
    'statistical request': 'statistische Anfrage',
    'subjective judgement': 'subjektive Einschätzung',
    'coaching question': 'taktische Frage',
    'unavailable metric': 'nicht erfasste Kennzahl',
    'unrecognized language': 'nicht erkannte Sprache',
    'elapsed minutes': 'verstrichene Minuten',
    'Match score (a different figure)': 'Spielstand (eine andere Zahl)',
    'Checked at': 'Geprüft bei',
    'How it works': 'So funktioniert es',
    'Enter an opinion': 'Meinung eingeben',
    'Check a moment': 'Moment prüfen',
    'Check again and share': 'Erneut prüfen und teilen',
    'Nothing is checked until you press the check button.': 'Erst mit einem Klick auf die Prüftaste wird etwas überprüft.',
    'Built for your group chat.': 'Für eure Gruppen-Chats gemacht.',
    'Check an opinion here, then share the evidence with your mates. A WhatsApp companion is planned; this demo doesn’t connect to your chats.': 'Prüfe hier eine Meinung und teile die Belege mit deinen Freunden. Ein WhatsApp-Begleiter ist geplant; diese Demo greift nicht auf deine Chats zu.',
    'What this demo is, and is not': 'Was diese Demo ist – und was nicht',
    'Every match is fictional. Players carry real names as invented identities; no performance, result or statistic is real.': 'Alle Spiele sind fiktiv. Reale Spielernamen sind erfundene Identitäten; keine Leistung, kein Ergebnis und keine Statistik ist echt.',
    'Opinions are read by a limited local rule set, not an AI model. Unfamiliar wording may be declined or answered with a question.': 'Meinungen werden mit begrenzten lokalen Regeln und nicht mit einem KI-Modell interpretiert. Unbekannte Formulierungen werden möglicherweise abgelehnt oder mit einer Rückfrage beantwortet.',
    'Evidence comes from a sampled synthetic event record. There is no video, tracking, chance quality or defensive-shape data.': 'Die Belege stammen aus einem ausgewählten synthetischen Ereignisprotokoll. Video-, Tracking-, Chancenqualitäts- und Defensivform-Daten gibt es nicht.',
    'Answers live in your browser and are lost on refresh. Nothing is stored or sent anywhere except your opinion and the chosen minute for checking.': 'Antworten bleiben im Browser und gehen beim Aktualisieren verloren. Gespeichert oder gesendet werden nur deine Meinung und die gewählte Prüfminute.',
    Language: 'Sprache',
    'Fictional match replay': 'Fiktive Spielwiederholung',
    'Replay controls': 'Wiedergabesteuerung',
    'Play replay': 'Wiederholung abspielen',
    'Pause replay': 'Wiederholung pausieren',
    'Replay from kick-off': 'Ab Anpfiff wiederholen',
    'Back one minute': 'Eine Minute zurück',
    'Forward one minute': 'Eine Minute vor',
    'Match time': 'Spielminute',
    'Jump to a key moment': 'Zu einem Schlüsselereignis springen',
    'Showing the last loaded moment': 'Letzten geladenen Moment anzeigen',
    'The match could not be loaded.': 'Das Spiel konnte nicht geladen werden.',
    'The match could not be loaded. The last loaded moment is still shown.': 'Das Spiel konnte nicht geladen werden. Der letzte geladene Moment wird weiterhin angezeigt.',
    'Loading…': 'Wird geladen…',
    Conversation: 'Gespräch',
    'Answer detail': 'Antwortdetails',
    Fan: 'Fan',
    Analyst: 'Analyse',
    'Opinions and answers': 'Meinungen und Antworten',
    'Pick an example or type an opinion. I’ll check it against this match at the minute you choose.': 'Wähle ein Beispiel oder gib eine Meinung ein. Ich prüfe sie für dieses Spiel und die gewählte Minute.',
    'Your opinion': 'Deine Meinung',
    'Asking about': 'Abfrage für',
    Change: 'Ändern',
    'Evidence period': 'Belegzeitraum',
    'Match so far': 'Bisheriges Spiel',
    'Last 10 minutes': 'Letzte 10 Minuten',
    'First half': 'Erste Halbzeit',
    'Second half': 'Zweite Halbzeit',
    'Check this moment': 'Diesen Moment prüfen',
    'Checking…': 'Wird geprüft…',
    'Moving…': 'Wird bewegt…',
    'Example opinions': 'Beispielmeinungen',
    'Examples (these fill the box; nothing is sent until you check)': 'Beispiele (füllen das Feld; nichts wird vor dem Prüfen gesendet)',
    'Fictional match: every performance and result is invented.': 'Fiktives Spiel: alle Leistungen und Ergebnisse sind erfunden.',
    'Groupchat Analyst': 'Groupchat Analyst',
    Claim: 'Behauptung',
    Supported: 'Bestätigt',
    Contradicted: 'Widerlegt',
    'Not enough evidence for a firm conclusion': 'Keine ausreichenden Belege für eine sichere Schlussfolgerung',
    'Needs clarification': 'Rückfrage nötig',
    'Clarification needed': 'Rückfrage erforderlich',
    'Statistics only, no verdict': 'Nur Statistik, kein Urteil',
    'Data not recorded': 'Daten nicht erfasst',
    'Not understood': 'Nicht verstanden',
    'Clarification:': 'Rückfrage:',
    Limitation: 'Einschränkung',
    'Limitation:': 'Einschränkung:',
    Limitations: 'Einschränkungen',
    'View evidence': 'Belege anzeigen',
    Subject: 'Subjekt',
    'What we understood': 'Unser Verständnis',
    'Request type': 'Anfragetyp',
    'Selected period': 'Ausgewählter Zeitraum',
    'Historical anchor': 'Historischer Bezugspunkt',
    'Evidence needs': 'Benötigte Belege',
    available: 'verfügbar',
    'not recorded': 'nicht erfasst',
    'Statistic request answered from the selected records': 'Statistik aus den ausgewählten Aufzeichnungen berechnet',
    'The list below contains the relevant attributed records. Calculation denominators are available in the expandable trace.': 'Die Liste enthält relevante zugeordnete Datensätze. Nenner und Berechnung sind in der aufklappbaren Spur enthalten.',
    'These recorded events provide context, not a complete performance measure or verdict on the broader judgement.': 'Diese erfassten Ereignisse liefern Kontext, aber keine vollständige Leistungsmessung oder Bewertung des Gesamturteils.',
    'Recorded turnover locations and linked passes': 'Erfasste Ballverluste und zugehörige Pässe',
    'No matching recorded evidence': 'Keine passenden Belege erfasst',
    'No unrelated event lists or statistics are substituted for this request.': 'Es werden keine sachfremden Ereignisse oder Statistiken ersatzweise verwendet.',
    'Relevant retrieved events': 'Abgerufene relevante Ereignisse',
    'These fixture events provide context for this opinion; they do not prove a subjective assessment.': 'Diese Ereignisse liefern Kontext zur Meinung, beweisen aber kein subjektives Urteil.',
    'How this was calculated': 'So wurde berechnet',
    'Player statistics': 'Spielerstatistiken',
    'Answer ready': 'Antwort bereit',
    'Technical record · IDs': 'Technischer Datensatz · IDs',
    'Match data & coverage': 'Spieldaten und Abdeckung',
    'SOURCE & COVERAGE': 'QUELLE UND ABDECKUNG',
    'Synthetic fixture': 'Synthetisches Spiel',
    'Explore the pass map': 'Passkarte erkunden',
    'Follow the ball.': 'Dem Ball folgen.',
    'Selected match window': 'Ausgewähltes Spielfenster',
    'Pass map team': 'Team der Passkarte',
    Completed: 'Angekommen',
    'Incomplete · dashed': 'Nicht angekommen · gestrichelt',
    'Attack direction →': 'Angriffsrichtung →',
    'Inspect a pass': 'Pass untersuchen',
    'Completed pass': 'Angekommener Pass',
    'Incomplete pass': 'Fehlpass',
    'Technical record · IDs and original source wording (English)': 'Technischer Datensatz · IDs und ursprünglicher Quelltext (Englisch)',
    'The descriptions above are localized. The records below retain original English source wording.': 'Die Beschreibungen oben sind übersetzt. Die folgenden Datensätze behalten den englischen Originalquelltext bei.',
    'Original source wording (English):': 'Ursprünglicher Quelltext (Englisch):',
    'Explore match events': 'Spielereignisse erkunden',
    'Ask about a player': 'Zu einem Spieler fragen',
    'Fictional matchday squad': 'Fiktiver Spieltagskader',
    'Choose a player': 'Spieler auswählen',
    'Player clarification': 'Rückfrage zum Spieler',
    'Resolving your selection…': 'Auswahl wird aufgelöst…',
    'Player selection failed.': 'Die Spielerauswahl ist fehlgeschlagen.',
    'Player selected by you; no additional model call was made.': 'Du hast den Spieler ausgewählt; es gab keinen weiteren Modellaufruf.',
    'Use this player': 'Diesen Spieler verwenden',
    'About this demo & its data': 'Über diese Demo und ihre Daten',
    'Copy reply': 'Antwort kopieren',
    'Copy card text': 'Kartentext kopieren',
    'Download card image': 'Kartenbild herunterladen',
    'Preview share card': 'Vorschau der Karte',
    'Share what changed': 'Änderungen teilen',
    'Share the receipts': 'Belege teilen',
    'Copy what-changed text': 'Änderungstext kopieren',
    'Download extended card': 'Erweiterte Karte herunterladen',
    'What changed': 'Was hat sich geändert?',
    Windows: 'Zeiträume',
    Definition: 'Definition',
    Figure: 'Wert',
    Assessments: 'Bewertungen',
    'Calculation traces and coverage are in the claim details below.': 'Berechnungsspuren und Abdeckung stehen unten in den Behauptungsdetails.',
    'Earlier answer': 'Vorherige Antwort',
    'Checked against': 'Abgeglichen mit',
    'Local rules · no model connection': 'Lokale Regeln · keine Modellverbindung',
    'Foundry · server-side interpretation': 'Foundry · serverseitige Interpretation',
    'Foundry interpretation': 'Foundry-Interpretation',
    'Server-side local rule-based interpreter (no model connection). Statistics are still calculated by the application, not by AI.': 'Serverseitiger lokaler Regelinterpreter ohne Modellverbindung. Die Anwendung berechnet die Statistiken, nicht die KI.',
    'The guided demonstration only prepares a fictional 57′ replay and its opinion; nothing is checked until you press the submit button, and the 58′ re-check is also your choice. Local-rules reading is limited to a small set of phrasings, so unfamiliar wording may be declined.': 'Die geführte Demo bereitet nur eine fiktive Wiederholung bei 57′ und die dazugehörige Meinung vor. Geprüft wird erst nach dem Absenden; auch die erneute Prüfung bei 58′ ist freiwillig. Die lokalen Regeln erkennen nur wenige Formulierungen; unbekannte Formulierungen können abgelehnt werden.',
    '“Share the receipts” appears only where your browser can share image files. It hands the card image to your device’s share sheet and cannot tell whether anything was sent. Copy and download are always available.': 'Die Belege können nur geteilt werden, wenn der Browser Bilddateien teilen kann. Das Kartenbild wird an das Teilen-Menü des Geräts übergeben; ob es gesendet wurde, lässt sich nicht feststellen. Kopieren und Herunterladen sind immer möglich.',
    'First-half stoppage time is 45+N′; second-half stoppage is 90+N′. Recent-minute windows exclude half-time. Historical “before” periods exclude the anchored event and all later events.': 'Die Nachspielzeit der ersten Halbzeit wird als 45+N′, die der zweiten als 90+N′ angegeben. Zeitfenster der letzten Minuten schließen die Halbzeitpause aus. Historische Zeiträume „vor“ schließen das Ankerereignis und alle späteren Ereignisse aus.',
    'Fictional match': 'Fiktives Spiel',
    'Local rules demo': 'Demo mit lokalen Regeln',
    'How this was checked': 'So wurde dies geprüft',
    'You ·': 'Du ·',
    'This server is using limited local rules to read questions, with no model connection. It understands a small set of football phrasings.': 'Dieser Server interpretiert Fragen mit begrenzten lokalen Regeln und ohne Modellverbindung. Er erkennt nur eine kleine Auswahl von Fußballformulierungen.',
    'Microsoft Foundry structured-output model. Statistics are still calculated by the application, not by AI.': 'Strukturiertes Ausgabemodell von Microsoft Foundry. Die Anwendung berechnet die Statistiken, nicht die KI.',
    'The analysis service has not yet reported how it reads questions.': 'Der Analysedienst hat noch nicht angegeben, wie er Fragen interpretiert.',
    'Match statistics use the selected time and evidence period. Possession uses recorded controlled time only; contested and out-of-play time are excluded. Build-up and pressure observations cover selected samples.': 'Die Spielstatistiken verwenden den ausgewählten Zeitpunkt und Belegzeitraum. Ballbesitz basiert nur auf erfasster kontrollierter Spielzeit; umkämpfte und unterbrochene Zeit wird ausgeschlossen. Aufbau- und Pressing-Beobachtungen decken ausgewählte Stichproben ab.',
    'Player tracking, video, running distance, defensive shape and calibrated expected goals are not recorded. A missing measurement is not a zero.': 'Spielertracking, Video, Laufdistanz, Defensivformation und kalibrierte erwartete Tore sind nicht erfasst. Ein fehlender Messwert ist nicht null.',
    'The analysis service returned an incomplete answer.': 'Der Analysedienst hat eine unvollständige Antwort geliefert.',
    'The analysis service answered for a different match, so the reply was not shown.': 'Der Analysedienst hat ein anderes Spiel beantwortet; die Antwort wurde daher nicht angezeigt.',
    'The analysis service could not be reached.': 'Der Analysedienst ist nicht erreichbar.',
    'Limitations:': 'Einschränkungen:',
    supported: 'gestützt',
    contradicted: 'widerlegt',
    'insufficient evidence for a firm conclusion': 'nicht genug Belege für eine sichere Schlussfolgerung',
    'clarification needed': 'Klärung erforderlich',
    'unavailable data': 'Daten nicht verfügbar',
    'statistics only, no verdict': 'nur Statistiken, kein Urteil',
    'This is a comparison of recorded events in the synthetic fixture, not a claim about chance quality or overall performance.': 'Dies vergleicht erfasste Ereignisse im fiktiven Spiel und sagt nichts über Chancenqualität oder die Gesamtleistung aus.',
    'Try again': 'Erneut versuchen',
    'That check didn’t finish. Please try again.': 'Die Prüfung wurde nicht abgeschlossen. Bitte versuche es erneut.',
    'Your earlier answer is still above.': 'Deine vorherige Antwort steht weiterhin oben.',
    Details: 'Details',
    'Reply copied.': 'Antwort kopiert.',
    'Card text copied.': 'Kartentext kopiert.',
    'What-changed text copied.': 'Änderungstext kopiert.',
    'Clipboard access is unavailable. Select the card text above and copy it manually.': 'Die Zwischenablage ist nicht verfügbar. Markiere den Kartentext und kopiere ihn manuell.',
    'Select the reply above and copy it manually.': 'Markiere die Antwort und kopiere sie manuell.',
    'Card image downloaded.': 'Kartenbild heruntergeladen.',
    'Extended card image downloaded.': 'Erweitertes Kartenbild heruntergeladen.',
    'Image download is unavailable. Copy the card text instead.': 'Das Bild kann nicht heruntergeladen werden. Kopiere stattdessen den Kartentext.',
    'Same opinion, one minute later in the fictional replay.': 'Gleiche Meinung, eine Minute später in der fiktiven Wiederholung.',
    'Move to 58′': 'Zu 58′ wechseln',
    'The replay is at 58′. Use “Check again” to ask the same opinion against the new evidence.': 'Die Wiederholung steht bei 58′. Prüfe dieselbe Meinung mit „Erneut prüfen“ anhand der neuen Belege.',
    'Check again': 'Erneut prüfen',
    'The latest reply is for the saved opinion above': 'Die letzte Antwort bezieht sich auf die oben gespeicherte Meinung',
    'Try the 57′ → 58′ demo': 'Demo 57′ → 58′ ausprobieren',
    'No matching event references in this section.': 'Keine passenden Ereignisverweise in diesem Abschnitt.',
    'Shareable card preview': 'Vorschau der teilbaren Karte',
    'What-changed card preview': 'Vorschau der Änderungskarte',
    'Not available': 'Nicht verfügbar',
    'Unrecorded player': 'Spieler nicht erfasst',
    'Recorded events in match order': 'Erfasste Ereignisse in Spielreihenfolge',
    'Nothing recorded yet.': 'Noch nichts erfasst.',
    'Nothing has been recorded yet.': 'Bisher wurde nichts erfasst.',
    'Latest recorded moment': 'Letzter erfasster Moment',
    'One recorded event — it does not show who is on top.': 'Ein erfasstes Ereignis zeigt nicht, welches Team überlegen ist.',
    'All recorded events': 'Alle erfassten Ereignisse',
    recorded: 'erfasst',
    starter: 'in der Startelf',
    substitute: 'Ersatzspieler',
    Yes: 'Ja',
    No: 'Nein',
    'Selected pressure records': 'Ausgewählte Drucksituationen',
  },
  ar: {
    'Checked.': 'تم التحقق.',
    'Original match': 'المباراة الأصلية',
    'Return match': 'مباراة الإياب',
    'Westhaven fixture': 'مباراة وستهافن',
    'Redmere fixture': 'مباراة ريدمير',
    'Explore this fictional match through its recorded events and evidence.': 'استكشف هذه المباراة الخيالية من خلال أحداثها المسجلة وأدلتها.',
    'A fictional football fixture for exploring evidence at selected moments.': 'مباراة كرة قدم خيالية لاستكشاف الأدلة عند لحظات محددة.',
    'Recorded moment': 'لحظة مسجلة',
    'See how one minute changes the opinion': 'شاهد كيف يتغير الرأي خلال دقيقة',
    'The two checks interpret this opinion differently, so they cannot be compared directly.': 'يفسر الفحصان هذا الرأي بطرق مختلفة، لذا لا يمكن مقارنتهما مباشرةً.',
    'An illustrative preview of the fictional replay, written from verified local-rule answers. It is not a live conversation and no AI model is involved.': 'معاينة توضيحية لإعادة المباراة الخيالية، مبنية على إجابات مؤكدة بالقواعد المحلية. ليست محادثة مباشرة ولا يستخدم فيها نموذج ذكاء اصطناعي.',
    'Evidence receipt at': 'إيصال الأدلة عند',
    'Illustrative · fictional replay · local rules ·': 'توضيحي · إعادة خيالية · قواعد محلية ·',
    'Illustrative': 'توضيحي',
    'fictional replay': 'إعادة خيالية',
    'Original match v': 'المباراة الأصلية v',
    '· Original match v': '· المباراة الأصلية v',
    'Return match v': 'مباراة الإياب v',
    'Westhaven fixture v': 'مباراة وستهافن v',
    'Redmere fixture v': 'مباراة ريدمير v',
    'Extended card ·': 'بطاقة موسعة ·',
    'Key facts': 'الحقائق الأساسية',
    'Selected recorded moments': 'اللحظات المسجلة المحددة',
    'Evidence against': 'أدلة معارضة',
    'Verdict:': 'التقييم:',
    At: 'عند',
    'Groupchat Analyst home': 'الصفحة الرئيسية لمحلل المحادثة الجماعية',
    Matches: 'المباريات',
    'All matches': 'كل المباريات',
    'Synthetic demo': 'عرض تجريبي خيالي',
    'Choose a match': 'اختر مباراة',
    'Fictional matches, each with its own story. Pick one to start.': 'مباريات خيالية لكل منها قصتها. اختر مباراة للبدء.',
    'That match isn’t available. Choose one below.': 'هذه المباراة غير متاحة. اختر مباراة من القائمة.',
    'example opinions': 'آراء تجريبية',
    '· fictional ·': '· خيالي ·',
    'Type an opinion, e.g. How many shots did Eastport have?': 'اكتب رأياً، مثلاً: كم تسديدة لدى إيستبورت؟',
    'Type an opinion, e.g. How many shots did Kingswell City have?': 'اكتب رأياً، مثلاً: كم تسديدة لدى كينغزويل سيتي؟',
    'Type an opinion, e.g. How many shots did Alderwick United have?': 'اكتب رأياً، مثلاً: كم تسديدة لدى ألدرويك يونايتد؟',
    'A counter-attacking effort goes wide.': 'انتهت محاولة مرتدة خارج المرمى.',
    'The replay is ready.': 'الإعادة جاهزة.',
    'Skip to your opinion': 'انتقل مباشرة إلى رأيك',
    Play: 'تشغيل',
    Pause: 'إيقاف مؤقت',
    Replay: 'إعادة التشغيل',
    'Football opinions. A fuller picture.': 'آراء كروية. صورة أوضح.',
    'Demo match analysis': 'تحليل مباراة تجريبية',
    You: 'أنت',
    'Northbridge covered more distance than Eastport': 'قطع نورثبريدج مسافة أكبر من إيستبورت',
    'Physical data that is not recorded': 'بيانات بدنية غير مسجلة',
    'Synthetic data': 'بيانات اصطناعية',
    'fictional match': 'مباراة خيالية',
    'read by local rules': 'تم تفسيره بالقواعد المحلية',
    'read by Foundry (server-side)': 'تم تفسيره بواسطة Foundry على الخادم',
    fictional: 'خيالي',
    'Football opinions. Checked.': 'آراء كروية. موثّقة.',
    'Your mate’s football opinion.': 'رأي صديقك الكروي.',
    'Your mate’s football opinion. Checked.': 'رأي صديقك الكروي. تم التحقق.',
    'Pick a match. Check the moment. Bring the evidence back to the chat.': 'اختر مباراة. تحقّق من الدقيقة. وأحضر الأدلة إلى المحادثة.',
    'The answer can change as the match goes on, so check the same opinion again a minute later.': 'قد تتغير الإجابة أثناء المباراة؛ تحقّق من الرأي نفسه مجدداً بعد دقيقة.',
    'Try it Out': 'جرّب الآن',
    'Fictional matches · Local rules · No AI model connected': 'مباريات خيالية · قواعد محلية · لا يوجد نموذج ذكاء اصطناعي متصل',
    'Same opinion. Different minute.': 'الرأي نفسه. دقيقة مختلفة.',
    'Preview match minute': 'معاينة دقيقة المباراة',
    'Illustrative conversation': 'محادثة توضيحية',
    'Evidence receipt': 'إيصال الأدلة',
    Opinion: 'الرأي',
    'Original wording': 'الصياغة الأصلية',
    Verdict: 'التقييم',
    'Shots on target': 'تسديدات على المرمى',
    'shots on target': 'تسديدات على المرمى',
    possession: 'الاستحواذ',
    'pass completion': 'دقة التمرير',
    'pass attempts': 'محاولات تمرير',
    'pass completions': 'تمريرات مكتملة',
    'Descriptive statistics are provided from recorded synthetic passes. Pass-completion percentage is not available when no attempts are recorded; zero attempts is distinct from attempted passes with no completions.': 'تُعرض إحصاءات وصفية استناداً إلى تمريرات اصطناعية مسجلة. لا تتوفر نسبة التمريرات المكتملة عند عدم تسجيل أي محاولات؛ فعدم وجود محاولات يختلف عن تسجيل محاولات لم تسفر عن تمريرات مكتملة.',
    'elapsed participation minutes (recorded window; added time included)': 'دقائق مشاركة منقضية (ضمن النافذة المسجلة؛ تشمل الوقت بدل الضائع)',
    'recorded recoveries': 'استعادات مسجلة',
    'selected pressure observations': 'ملاحظات الضغط المحددة',
    shots: 'تسديدات',
    goals: 'أهداف',
    'passes completed': 'تمريرات مكتملة',
    'passes attempted': 'محاولات تمرير',
    'pressure observations': 'ملاحظات الضغط',
    'goal events': 'أحداث الأهداف',
    'shot events': 'أحداث التسديد',
    'player events': 'أحداث اللاعبين',
    passing: 'تمريرات',
    'possession losses': 'فقدان الاستحواذ',
    'physical measurements': 'قياسات بدنية',
    'build up phase': 'مرحلة البناء',
    'territorial control': 'السيطرة المكانية',
    lineups: 'التشكيلات',
    'shot location': 'موقع التسديدة',
    'factual claim': 'ادعاء واقعي',
    'statistical request': 'طلب إحصائي',
    'subjective judgement': 'حكم شخصي',
    'coaching question': 'سؤال تكتيكي',
    'unavailable metric': 'مقياس غير متاح',
    'unrecognized language': 'لغة غير مفهومة',
    'elapsed minutes': 'دقائق منقضية',
    'Match score (a different figure)': 'نتيجة المباراة (رقم مختلف)',
    'Checked at': 'تم التحقق عند',
    'How it works': 'كيف يعمل',
    'Enter an opinion': 'أدخل رأياً',
    'Check a moment': 'تحقّق من دقيقة',
    'Check again and share': 'أعد التحقق وشارك',
    'Nothing is checked until you press the check button.': 'لن يتم التحقق من شيء حتى تضغط زر التحقق.',
    'Built for your group chat.': 'صُمم للنقاشات في مجموعتك.',
    'Check an opinion here, then share the evidence with your mates. A WhatsApp companion is planned; this demo doesn’t connect to your chats.': 'تحقّق من رأي هنا ثم شارك الأدلة مع أصدقائك. نخطط لمرافق عبر واتساب؛ هذا العرض لا يتصل بمحادثاتك.',
    'What this demo is, and is not': 'ما يقدمه هذا العرض وما لا يقدمه',
    'Every match is fictional. Players carry real names as invented identities; no performance, result or statistic is real.': 'كل المباريات خيالية. أسماء اللاعبين الحقيقية مستخدمة كهويات متخيلة؛ لا يوجد أداء أو نتيجة أو إحصائية حقيقية.',
    'Opinions are read by a limited local rule set, not an AI model. Unfamiliar wording may be declined or answered with a question.': 'تُفسر الآراء بقواعد محلية محدودة، لا بنموذج ذكاء اصطناعي. قد لا تُفهم الصياغة غير المألوفة أو يُطلب توضيحها.',
    'Evidence comes from a sampled synthetic event record. There is no video, tracking, chance quality or defensive-shape data.': 'تأتي الأدلة من سجل أحداث اصطناعي محدود. لا تتوفر فيديوهات أو بيانات تتبع أو جودة الفرص أو شكل الدفاع.',
    'Answers live in your browser and are lost on refresh. Nothing is stored or sent anywhere except your opinion and the chosen minute for checking.': 'تُحفظ الإجابات في متصفحك وتُفقد عند التحديث. لا يُخزن أو يُرسل شيء سوى رأيك والدقيقة التي اخترتها للتحقق.',
    Language: 'اللغة',
    'Fictional match replay': 'إعادة مباراة خيالية',
    'Replay controls': 'عناصر التحكم بالإعادة',
    'Play replay': 'تشغيل الإعادة',
    'Pause replay': 'إيقاف الإعادة مؤقتاً',
    'Replay from kick-off': 'إعادة من بداية المباراة',
    'Back one minute': 'العودة دقيقة',
    'Forward one minute': 'التقدم دقيقة',
    'Match time': 'دقيقة المباراة',
    'Jump to a key moment': 'الانتقال إلى لحظة مهمة',
    'Showing the last loaded moment': 'عرض آخر لحظة تم تحميلها',
    'The match could not be loaded.': 'تعذّر تحميل المباراة.',
    'The match could not be loaded. The last loaded moment is still shown.': 'تعذّر تحميل المباراة. لا تزال آخر لحظة تم تحميلها معروضة.',
    'Loading…': 'جارٍ التحميل…',
    'Loading the match…': 'جارٍ تحميل المباراة…',
    Conversation: 'المحادثة',
    'Answer detail': 'تفاصيل الإجابة',
    Fan: 'المشجع',
    Analyst: 'المحلل',
    'Opinions and answers': 'الآراء والإجابات',
    'Pick an example or type an opinion. I’ll check it against this match at the minute you choose.': 'اختر مثالاً أو اكتب رأياً. سأتحقق منه في هذه المباراة عند الدقيقة التي تختارها.',
    'Your opinion': 'رأيك',
    'Asking about': 'السؤال عن',
    Change: 'تغيير',
    'Evidence period': 'فترة الأدلة',
    'Match so far': 'حتى الآن',
    'Last 10 minutes': 'آخر 10 دقائق',
    'First half': 'الشوط الأول',
    'Second half': 'الشوط الثاني',
    'Check this moment': 'تحقّق من هذه الدقيقة',
    'Checking…': 'جارٍ التحقق…',
    'Moving…': 'جارٍ الانتقال…',
    'Example opinions': 'آراء تجريبية',
    'Examples (these fill the box; nothing is sent until you check)': 'أمثلة (تملأ الحقل؛ لا يُرسل شيء حتى تضغط التحقق)',
    'Fictional match: every performance and result is invented.': 'مباراة خيالية: كل أداء ونتيجة مختلقان.',
    'Groupchat Analyst': 'محلل المحادثة الجماعية',
    Claim: 'الادعاء',
    Supported: 'مدعوم',
    Contradicted: 'مخالف للأدلة',
    'Not enough evidence for a firm conclusion': 'الأدلة غير كافية لاستنتاج حاسم',
    'Needs clarification': 'يحتاج إلى توضيح',
    'Clarification needed': 'يلزم التوضيح',
    'Statistics only, no verdict': 'إحصاءات فقط، دون حكم',
    'Data not recorded': 'البيانات غير مسجلة',
    'Not understood': 'لم يُفهم',
    'Clarification:': 'التوضيح:',
    Limitation: 'القيد',
    'Limitation:': 'القيد:',
    Limitations: 'القيود',
    'View evidence': 'عرض الأدلة',
    Subject: 'الموضوع',
    'What we understood': 'ما فهمناه',
    'Request type': 'نوع الطلب',
    'Selected period': 'الفترة المحددة',
    'Historical anchor': 'المرجع التاريخي',
    'Evidence needs': 'الأدلة المطلوبة',
    available: 'متاح',
    'not recorded': 'غير مسجل',
    'Statistic request answered from the selected records': 'تم حساب الطلب الإحصائي من السجلات المحددة',
    'The list below contains the relevant attributed records. Calculation denominators are available in the expandable trace.': 'تتضمن القائمة السجلات ذات الصلة المنسوبة للاعب أو الفريق. يظهر مقام الحساب في تفاصيل العملية.',
    'These recorded events provide context, not a complete performance measure or verdict on the broader judgement.': 'توفر هذه الأحداث المسجلة سياقاً فقط، ولا تمثل مقياساً كاملاً للأداء أو حكماً على التقييم العام.',
    'Recorded turnover locations and linked passes': 'مواقع فقدان الكرة المسجلة والتمريرات المرتبطة',
    'No matching recorded evidence': 'لا توجد أدلة مسجلة مطابقة',
    'No unrelated event lists or statistics are substituted for this request.': 'لن تُستبدل بهذا الطلب قوائم أحداث أو إحصاءات غير مرتبطة.',
    'Relevant retrieved events': 'الأحداث ذات الصلة',
    'These fixture events provide context for this opinion; they do not prove a subjective assessment.': 'توفر أحداث المباراة سياقاً لهذا الرأي، لكنها لا تثبت تقييماً شخصياً.',
    'How this was calculated': 'طريقة الحساب',
    'Technical record · IDs': 'السجل التقني · المعرّفات',
    'Match data & coverage': 'بيانات المباراة والتغطية',
    'SOURCE & COVERAGE': 'المصدر والتغطية',
    'Synthetic fixture': 'مباراة اصطناعية',
    'Explore the pass map': 'استكشف خريطة التمريرات',
    'Follow the ball.': 'تابع الكرة.',
    'Selected match window': 'نافذة المباراة المحددة',
    'Pass map team': 'فريق خريطة التمريرات',
    Completed: 'مكتملة',
    'Incomplete · dashed': 'غير مكتملة · متقطعة',
    'Attack direction →': 'اتجاه الهجوم →',
    'Inspect a pass': 'افحص تمريرة',
    'Completed pass': 'تمريرة مكتملة',
    'Incomplete pass': 'تمريرة غير مكتملة',
    'Technical record · IDs and original source wording (English)': 'السجل التقني · المعرّفات والنص الأصلي المصدر (بالإنجليزية)',
    'The descriptions above are localized. The records below retain original English source wording.': 'الأوصاف أعلاه مترجمة. تحتفظ السجلات التالية بالنص الأصلي المصدر باللغة الإنجليزية.',
    'Original source wording (English):': 'النص الأصلي المصدر (بالإنجليزية):',
    'Explore match events': 'استكشف أحداث المباراة',
    'Ask about a player': 'اسأل عن لاعب',
    'Fictional matchday squad': 'تشكيلة مباراة خيالية',
    'Choose a player': 'اختر لاعباً',
    'Player clarification': 'توضيح اللاعب',
    'Resolving your selection…': 'جارٍ تطبيق اختيارك…',
    'Player selection failed.': 'تعذّر إكمال اختيار اللاعب.',
    'Player selected by you; no additional model call was made.': 'اخترت اللاعب بنفسك؛ لم يُجرَ أي استدعاء إضافي للنموذج.',
    'Use this player': 'استخدم هذا اللاعب',
    'About this demo & its data': 'عن هذا العرض وبياناته',
    'Copy reply': 'انسخ الرد',
    'Copy card text': 'انسخ نص البطاقة',
    'Download card image': 'نزّل صورة البطاقة',
    'Preview share card': 'معاينة بطاقة المشاركة',
    'Share what changed': 'شارك ما تغيّر',
    'Share the receipts': 'شارك الإيصالات',
    'Copy what-changed text': 'انسخ نص التغييرات',
    'Download extended card': 'نزّل البطاقة الموسعة',
    'What changed': 'ما الذي تغيّر',
    Windows: 'الفترات',
    Definition: 'التعريف',
    Figure: 'القيمة',
    Assessments: 'التقييمات',
    'Calculation traces and coverage are in the claim details below.': 'تجد تفاصيل الحساب والتغطية ضمن تفاصيل الادعاء أدناه.',
    'Earlier answer': 'الإجابة السابقة',
    'Checked against': 'تم التحقق مقابل',
    'Local rules · no model connection': 'قواعد محلية · لا يوجد اتصال بنموذج',
    'Foundry · server-side interpretation': 'Foundry · تفسير على الخادم',
    'Foundry interpretation': 'تفسير Foundry',
    'Server-side local rule-based interpreter (no model connection). Statistics are still calculated by the application, not by AI.': 'مفسر محلي قائم على القواعد يعمل على الخادم دون اتصال بنموذج. يحسب التطبيق الإحصاءات، ولا يحسبها الذكاء الاصطناعي.',
    'The guided demonstration only prepares a fictional 57′ replay and its opinion; nothing is checked until you press the submit button, and the 58′ re-check is also your choice. Local-rules reading is limited to a small set of phrasings, so unfamiliar wording may be declined.': 'يجهز العرض الموجّه إعادة خيالية عند 57′ والرأي المرتبط بها فقط؛ لا يحدث التحقق حتى تضغط زر الإرسال، وإعادة التحقق عند 58′ اختيارية أيضاً. تقتصر القواعد المحلية على صيغ قليلة، وقد ترفض الصيغ غير المألوفة.',
    '“Share the receipts” appears only where your browser can share image files. It hands the card image to your device’s share sheet and cannot tell whether anything was sent. Copy and download are always available.': 'يظهر خيار مشاركة الإيصالات فقط إذا كان المتصفح يدعم مشاركة الصور. يرسل صورة البطاقة إلى قائمة المشاركة في جهازك، ولا يمكنه معرفة ما إذا تم إرسالها. يظل النسخ والتنزيل متاحين دائماً.',
    'First-half stoppage time is 45+N′; second-half stoppage is 90+N′. Recent-minute windows exclude half-time. Historical “before” periods exclude the anchored event and all later events.': 'يُعرض الوقت بدل الضائع للشوط الأول بصيغة 45+N′ وللثاني 90+N′. تستثني نوافذ الدقائق الأخيرة الاستراحة. وتستثني الفترات التاريخية «قبل» الحدث المرجعي وكل الأحداث اللاحقة.',
    'Fictional match': 'مباراة خيالية',
    'Local rules demo': 'عرض القواعد المحلية',
    'How this was checked': 'كيف تم التحقق من ذلك',
    'You ·': 'أنت ·',
    'This server is using limited local rules to read questions, with no model connection. It understands a small set of football phrasings.': 'يستخدم هذا الخادم قواعد محلية محدودة لفهم الأسئلة من دون اتصال بنموذج. وهو يفهم مجموعة صغيرة من صيغ كرة القدم.',
    'Microsoft Foundry structured-output model. Statistics are still calculated by the application, not by AI.': 'نموذج الإخراج المنظم من Microsoft Foundry. يحسب التطبيق الإحصاءات، ولا يحسبها الذكاء الاصطناعي.',
    'The analysis service has not yet reported how it reads questions.': 'لم يحدد تحليل الخدمة بعد كيفية فهم الأسئلة.',
    'Match statistics use the selected time and evidence period. Possession uses recorded controlled time only; contested and out-of-play time are excluded. Build-up and pressure observations cover selected samples.': 'تستخدم إحصاءات المباراة الوقت وفترة الأدلة المحددين. يُحسب الاستحواذ من زمن السيطرة المسجل فقط، مع استبعاد اللعب المتنازع عليه وخارج اللعب. تغطي ملاحظات البناء والضغط عينات محددة.',
    'Player tracking, video, running distance, defensive shape and calibrated expected goals are not recorded. A missing measurement is not a zero.': 'لا تتوفر بيانات تتبع اللاعبين أو الفيديو أو مسافة الجري أو الشكل الدفاعي أو الأهداف المتوقعة المعايرة. غياب القياس لا يعني أن قيمته صفر.',
    'The analysis service returned an incomplete answer.': 'أعادت خدمة التحليل إجابة غير مكتملة.',
    'The analysis service answered for a different match, so the reply was not shown.': 'أجابت خدمة التحليل عن مباراة أخرى، لذلك لم يُعرض الرد.',
    'The analysis service could not be reached.': 'تعذر الوصول إلى خدمة التحليل.',
    'Limitations:': 'القيود:',
    supported: 'مدعوم',
    contradicted: 'مناقض',
    'insufficient evidence for a firm conclusion': 'الأدلة غير كافية لاستنتاج حاسم',
    'clarification needed': 'يلزم التوضيح',
    'unavailable data': 'البيانات غير متاحة',
    'statistics only, no verdict': 'إحصاءات فقط، بلا حكم',
    'This is a comparison of recorded events in the synthetic fixture, not a claim about chance quality or overall performance.': 'هذه مقارنة للأحداث المسجلة في المباراة الخيالية، ولا تثبت جودة الفرص أو الأداء العام.',
    'Try again': 'أعد المحاولة',
    'That check didn’t finish. Please try again.': 'لم يكتمل التحقق. يُرجى المحاولة مرة أخرى.',
    'Your earlier answer is still above.': 'ما زالت إجابتك السابقة أعلاه.',
    Details: 'التفاصيل',
    'Reply copied.': 'تم نسخ الرد.',
    'Card text copied.': 'تم نسخ نص البطاقة.',
    'What-changed text copied.': 'تم نسخ نص التغييرات.',
    'Clipboard access is unavailable. Select the card text above and copy it manually.': 'الحافظة غير متاحة. حدّد نص البطاقة أعلاه وانسخه يدوياً.',
    'Select the reply above and copy it manually.': 'حدّد الرد أعلاه وانسخه يدوياً.',
    'Card image downloaded.': 'تم تنزيل صورة البطاقة.',
    'Extended card image downloaded.': 'تم تنزيل صورة البطاقة الموسعة.',
    'Image download is unavailable. Copy the card text instead.': 'تنزيل الصورة غير متاح. انسخ نص البطاقة بدلاً من ذلك.',
    'Same opinion, one minute later in the fictional replay.': 'الرأي نفسه بعد دقيقة في الإعادة الخيالية.',
    'Move to 58′': 'انتقل إلى 58′',
    'The replay is at 58′. Use “Check again” to ask the same opinion against the new evidence.': 'الإعادة عند 58′. استخدم «تحقق مجدداً» لمراجعة الرأي نفسه مقابل الأدلة الجديدة.',
    'Check again': 'تحقق مجدداً',
    'The latest reply is for the saved opinion above': 'الرد الأخير يخص الرأي المحفوظ أعلاه',
    'Try the 57′ → 58′ demo': 'جرّب العرض من 57′ إلى 58′',
    'No matching event references in this section.': 'لا توجد مراجع لأحداث مطابقة في هذا القسم.',
    'Shareable card preview': 'معاينة بطاقة المشاركة',
    'What-changed card preview': 'معاينة بطاقة التغييرات',
    'Not available': 'غير متاح',
    'Unrecorded player': 'لاعب غير مسجل',
    'Recorded events in match order': 'الأحداث المسجلة بترتيب المباراة',
    'Nothing recorded yet.': 'لم يُسجل شيء بعد.',
    'Nothing has been recorded yet.': 'لم يُسجَّل أي حدث حتى الآن.',
    'Latest recorded moment': 'أحدث لحظة مسجلة',
    'One recorded event — it does not show who is on top.': 'حدث واحد مسجل لا يوضح أي فريق يسيطر.',
    'All recorded events': 'كل الأحداث المسجلة',
    recorded: 'مسجلة',
    starter: 'أساسي',
    substitute: 'بديل',
    Yes: 'نعم',
    No: 'لا',
    'Selected pressure records': 'ملاحظات الضغط المحددة',
  },
}

const arabicSupplementalTranslations: Record<string, string> = {
  Claim: 'الادعاء',
  GOAL: 'هدف',
  'Player statistics': 'إحصاءات اللاعب',
  'Answer ready': 'الإجابة جاهزة',
  'Both teams': 'كلا الفريقين',
  '% possession': 'نسبة الاستحواذ',
  '% pass completion': 'نسبة التمريرات المكتملة',
  recoveries: 'استعادات',
  'running distance': 'مسافة الجري',
  'elapsed minutes of participation in recorded coverage (added time included)': 'دقائق المشاركة المنقضية ضمن التغطية المسجلة (يشمل الوقت بدل الضائع)',
  'defensive shape and positioning (not recorded, so no verdict)': 'الشكل الدفاعي والتمركز (غير مسجل، لذلك لا يصدر حكم)',
  'Broad player opinion: his recorded contributions, no rating': 'تقييم عام للاعب يستعرض مساهماته المسجلة من دون منحه درجة.',
  'Factual claim that changes between 57′ and 58′': 'ادعاء واقعي تتغير نتيجته بين الدقيقتين 57′ و58′.',
  'Ambiguous name: asks which Bruno': 'اسم ملتبس: يُطلب تحديد برونو المقصود.',
  'Tactical opinion the records cannot settle': 'رأي تكتيكي لا تستطيع السجلات حسمه.',
  'Physical data that is not recorded': 'بيانات بدنية غير مسجلة.',
  'Two claims: possession and shots can point different ways': 'ادعاءان: قد يشير الاستحواذ والتسديد إلى نتيجتين مختلفتين.',
  'Last-10-minutes window that differs from the whole match': 'نافذة الدقائق العشر الأخيرة تختلف عن المباراة كاملة.',
  'Passing evidence with no benchmark': 'أدلة تمرير بلا معيار للمقارنة.',
  'Recorded possession losses by pitch third': 'حالات فقدان الاستحواذ المسجلة بحسب ثلث الملعب.',
  'A zero-count claim on shots on target': 'ادعاء بعدم تسجيل أي تسديدة على المرمى.',
  'A player with shots but no recorded pass attempts': 'لاعب لديه تسديدات، لكن لم تُسجل له محاولات تمرير.',
  'No goal is recorded, so the question has no anchor': 'لم يُسجل أي هدف، لذلك لا يوجد هدف مرجعي للسؤال.',
  'Ambiguous name: asks which Pedro': 'اسم ملتبس: يُطلب تحديد بيدرو المقصود.',
  'A substitute’s goal, which only exists from 88′': 'هدف البديل مسجل عند الدقيقة 88′ فقط.',
  'A universal claim checked against every recorded shot': 'ادعاء شامل تمت مراجعته مقابل كل تسديدة مسجلة.',
  'Three goals are recorded, so the question asks which one': 'سُجلت ثلاثة أهداف، لذا يلزم تحديد الهدف المقصود.',
  'A factual comparison that is supported on the full match': 'مقارنة واقعية تدعمها بيانات المباراة كاملة.',
  'View evidence': 'عرض الأدلة',
  Subject: 'الموضوع',
  'What we understood': 'فهمنا للطلب',
  'Request type': 'نوع الطلب',
  'Selected period': 'الفترة المحددة',
  'Historical anchor': 'المرجع التاريخي',
  'Evidence needs': 'الأدلة المطلوبة',
  available: 'متاح',
  'not recorded': 'غير مسجل',
  'Statistic request answered from the selected records': 'إجابة الإحصاء من السجلات المحددة',
  'The list below contains the relevant attributed records. Calculation denominators are available in the expandable trace.': 'تتضمن القائمة السجلات ذات الصلة والمنسوبة للاعب أو الفريق. ويمكن الاطلاع على مقامات الحساب في تفاصيل التتبع القابلة للتوسيع.',
  'These recorded events provide context, not a complete performance measure or verdict on the broader judgement.': 'توفر هذه الأحداث المسجلة سياقاً فقط، ولا تمثل مقياساً كاملاً للأداء أو حكماً على التقييم العام.',
  'Recorded turnover locations and linked passes': 'مواقع فقدان الكرة المسجلة والتمريرات المرتبطة',
  'These turnovers come only from the explicitly linked, partial build-up sample. Associated records do not establish tactical causes.': 'تأتي حالات فقدان الكرة هذه من عينة جزئية محددة لمرحلة البناء ومرتبطة صراحةً. ولا تثبت السجلات المرتبطة أسباباً تكتيكية.',
  'These are all-pass turnovers. Associated records do not establish tactical causes.': 'هذه حالات فقدان الكرة الناتجة عن تمريرات غير مكتملة. ولا تثبت السجلات المرتبطة أسباباً تكتيكية.',
  'No matching recorded evidence': 'لا توجد أدلة مسجلة مطابقة',
  'No unrelated event lists or statistics are substituted for this request.': 'لم تُستبدل بهذا الطلب قوائم أحداث أو إحصاءات غير مرتبطة.',
  'Relevant retrieved events': 'الأحداث المسترجعة ذات الصلة',
  'These fixture events provide context for this opinion; they do not prove a subjective assessment.': 'توفر أحداث المباراة سياقاً لهذا الرأي، لكنها لا تثبت تقييماً ذاتياً.',
  'How this was calculated': 'كيفية إجراء الحساب',
  'Technical record · IDs': 'السجل التقني · المعرّفات',
  'Numerator IDs:': 'معرّفات البسط:',
  'Denominator IDs:': 'معرّفات المقام:',
  'participation within recorded window': 'المشاركة ضمن النافذة المسجلة',
  'completions among': 'تمريرات مكتملة من أصل',
  attempts: 'محاولات',
  'rate not available': 'النسبة غير متاحة',
  'rate unavailable': 'النسبة غير متاحة',
  'recorded window': 'النافذة المسجلة',
  'added time included': 'يشمل الوقت بدل الضائع',
  'half-time excluded': 'يستثني الاستراحة',
  'elapsed minutes': 'دقائق منقضية',
  'statistics provided': 'إحصاءات فقط، بلا حكم',
  'Claim evidence references': 'مراجع أدلة الادعاء',
  'Original wording': 'الصياغة الأصلية',
  'SOURCE & COVERAGE': 'المصدر والتغطية',
  'Match data & coverage': 'بيانات المباراة والتغطية',
  'Synthetic fixture': 'مباراة اصطناعية',
  'Possession percentages use only recorded controlled-possession minutes; contested play and time out of play are excluded.': 'تُحسب نسب الاستحواذ من دقائق السيطرة المسجلة فقط، مع استبعاد اللعب المتنازع عليه وخارج اللعب.',
  'Claims in this opinion': 'الادعاءات في هذا الرأي',
  'Evidence period': 'فترة الأدلة',
  'Match time': 'وقت المباراة',
  'Asking about': 'السؤال عن',
  Change: 'تغيير',
  'Send opinion': 'إرسال الرأي',
  'Check this moment': 'تحقق من هذه اللحظة',
  'Checking the match…': 'جارٍ التحقق من المباراة…',
  claim: 'ادعاء',
  claims: 'ادعاءات',
  'Simulated match using real-player names. All performances and results are fictional.': 'مباراة محاكاة تستخدم أسماء لاعبين حقيقية كمعرّفات خيالية. جميع الأداء والنتائج خيالية.',
  'Second simulated match using real-player names. All performances and results are fictional; this is an illustrative event sample, not a complete tracking dataset.': 'المباراة المحاكاة الثانية تستخدم أسماء لاعبين حقيقية كمعرّفات خيالية. جميع الأداء والنتائج خيالية؛ وهذه عينة توضيحية من الأحداث وليست بيانات تتبع كاملة.',
  'Third simulated match using real-player names. All performances and results are fictional; this is an illustrative event sample, not a complete tracking dataset.': 'المباراة المحاكاة الثالثة تستخدم أسماء لاعبين حقيقية كمعرّفات خيالية. جميع الأداء والنتائج خيالية؛ وهذه عينة توضيحية من الأحداث وليست بيانات تتبع كاملة.',
  'Fourth simulated match using real-player names. All performances and results are fictional; this is an illustrative event sample, not a complete tracking dataset.': 'المباراة المحاكاة الرابعة تستخدم أسماء لاعبين حقيقية كمعرّفات خيالية. جميع الأداء والنتائج خيالية؛ وهذه عينة توضيحية من الأحداث وليست بيانات تتبع كاملة.',
  'Timestamped match events': 'أحداث المباراة المؤرخة',
  'Possession duration': 'مدة الاستحواذ',
  'Pass outcomes and locations': 'نتائج التمرير ومواقعه',
  'Possession losses and recoveries': 'فقدان الاستحواذ والاستعادات',
  'Pressure events': 'أحداث الضغط',
  'Lineups and substitutions': 'التشكيلات والتبديلات',
  'Player-attributed synthetic actions': 'أحداث اصطناعية منسوبة للاعبين',
  'Continuous player/ball tracking': 'تتبع متواصل للاعبين والكرة',
  'Synchronized video': 'فيديو متزامن',
  'Physical measurements': 'قياسات بدنية',
  'Defined build-up phase': 'مرحلة بناء محددة',
  'Expected-goal or other advanced models': 'نماذج الأهداف المتوقعة أو نماذج متقدمة أخرى',
}

const evidenceTranslations: Record<Exclude<AppLanguage, 'en'>, Record<string, string>> = {
  es: {
    'The synthetic fixture records shots on target events.': 'El partido sintético contiene eventos registrados de tiros a puerta.',
    'The synthetic fixture records passing events.': 'El partido sintético contiene eventos de pases registrados.',
    'The synthetic fixture records possession losses events.': 'El partido sintético contiene eventos de pérdidas de posesión registradas.',
    'Each record below is labelled as supporting, challenging, contextual, calculation evidence, or a historical anchor.': 'Cada registro se identifica como prueba a favor, en contra, contextual, de cálculo o como referencia histórica.',
    'Low shot from the edge of the box, saved by the goalkeeper.': 'Disparo raso desde el borde del área, detenido por el portero.',
    'First-time effort from outside the area goes wide.': 'Disparo de primeras desde fuera del área que se va desviado.',
    'Northbridge win a corner.': 'Northbridge fuerza un córner.',
    'Header from a cross is held by the goalkeeper.': 'El portero atrapa un cabezazo tras un centro.',
    'A defender blocks a shot inside the area.': 'Un defensa bloquea un disparo dentro del área.',
    'Free-kick attempt clears the crossbar.': 'El lanzamiento de falta supera el larguero.',
    'Northbridge score with a close-range shot.': 'Northbridge marca con un remate a corta distancia.',
    'Eastport test the goalkeeper soon after the restart.': 'Eastport prueba al portero poco después de la reanudación.',
    'A counter-attacking effort goes wide.': 'Un disparo tras un contraataque se va desviado.',
    'Eastport level the score with a shot from the area.': 'Eastport empata con un disparo desde el área.',
    'A driven effort is pushed away by the goalkeeper.': 'El portero despeja un disparo potente.',
    'A defender gets in the way of a shot from the area.': 'Un defensa bloquea un disparo desde el área.',
    'A header from a cross is saved.': 'El portero detiene un cabezazo tras un centro.',
    'Eastport take the lead with a shot from close range.': 'Eastport se adelanta con un disparo a corta distancia.',
    'Late shot is held by the goalkeeper.': 'El portero atrapa un disparo en los últimos minutos.',
    'Northbridge shoot over in stoppage time.': 'Northbridge dispara por encima en el tiempo añadido.',
    'Long-range effort curls past the far post.': 'Un disparo lejano con efecto pasa junto al segundo palo.',
    'Turn and shot from the edge of the area is saved low.': 'El portero detiene abajo un giro y disparo desde el borde del área.',
    'Eastport score with a first-time finish from a cut-back.': 'Eastport marca de primeras tras un pase atrás.',
    'A defender blocks a shot from the right of the area.': 'Un defensa bloquea un disparo desde la derecha del área.',
    'Volley from a corner clears the bar.': 'Una volea tras un córner supera el larguero.',
    'Close-range effort is turned away at the near post.': 'El portero desvía un remate cercano junto al primer palo.',
    'Northbridge test the goalkeeper again soon after the restart.': 'Northbridge vuelve a probar al portero poco después de la reanudación.',
    'Northbridge level with a close-range finish.': 'Northbridge empata con un remate a corta distancia.',
    'Hurried shot from distance goes wide.': 'Un disparo precipitado desde lejos se va desviado.',
    'Shot is blocked on the six-yard line.': 'Un disparo es bloqueado en el área pequeña.',
    'Low drive is saved at full stretch.': 'El portero detiene un disparo raso estirándose al máximo.',
    'Header from a free-kick drifts wide.': 'Un cabezazo tras una falta se va desviado.',
    'Shot on the turn is saved by the goalkeeper.': 'El portero detiene un disparo de media vuelta.',
    'Northbridge score in stoppage time with a placed finish.': 'Northbridge marca con un remate colocado en el tiempo añadido.',
    'Late effort from outside the area misses the target.': 'Un disparo tardío desde fuera del área no encuentra portería.',
    'A defender gets across to block an early shot from the left.': 'Un defensa llega a tiempo para bloquear un primer disparo desde la izquierda.',
    'A snap shot on the break flies over the bar.': 'Un disparo rápido al contraataque se va por encima del larguero.',
    'A curling effort from the edge of the area is tipped away.': 'El portero desvía un disparo con efecto desde el borde del área.',
    'A low shot from the right drifts wide of the post.': 'Un disparo raso desde la derecha se va junto al poste.',
    'A shot from the left of the area is blocked.': 'Un disparo desde la izquierda del área es bloqueado.',
    'A close-range effort is pushed behind just before the break.': 'Un remate cercano es desviado a córner justo antes del descanso.',
    'A shot from a cut-back is saved low.': 'El portero detiene abajo un disparo tras un pase atrás.',
    'A shot from inside the area is blocked on the line.': 'Un disparo dentro del área es bloqueado sobre la línea.',
    'A substitute’s first touch is a shot, saved at the near post.': 'El primer toque de un suplente es un disparo que el portero detiene junto al primer palo.',
    'A hurried effort from distance goes wide.': 'Un disparo precipitado desde lejos se va desviado.',
    'A shot from the left drifts past the far post.': 'Un disparo desde la izquierda pasa junto al segundo palo.',
    'A stoppage-time header is saved on the line.': 'Un cabezazo en el tiempo añadido es detenido sobre la línea.',
    'An early shot from the left is saved at the near post.': 'El portero detiene junto al primer palo un disparo temprano desde la izquierda.',
    'A shot on the turn goes over the bar.': 'Un disparo de media vuelta se va por encima del larguero.',
    'Redmere take the lead with a close-range finish.': 'Redmere se adelanta con un remate a corta distancia.',
    'A defender blocks a shot from the right.': 'Un defensa bloquea un disparo desde la derecha.',
    'A long-range shot drifts wide before the break.': 'Un disparo lejano se va desviado antes del descanso.',
    'A low drive is saved by the goalkeeper.': 'El portero detiene un disparo raso.',
    'Alderwick equalise with a shot from the edge of the area.': 'Alderwick empata con un disparo desde el borde del área.',
    'A shot from the right of the area is blocked.': 'Un disparo desde la derecha del área es bloqueado.',
    'A shot from a counter-attack is saved low.': 'El portero detiene abajo un disparo de contraataque.',
    'A substitute’s shot from distance misses the target.': 'Un disparo lejano de un suplente no encuentra portería.',
    'Alderwick’s substitute scores a late winner from a cross.': 'El suplente de Alderwick marca de cabeza el gol decisivo tras un centro en los últimos minutos.',
    'A stoppage-time header is saved.': 'El portero detiene un cabezazo en el tiempo añadido.',
    'Shooter:': 'Tirador:',
    'Scorer:': 'Goleador:',
    supporting: 'a favor',
    challenging: 'en contra',
    context: 'contexto',
    calculation: 'cálculo',
    anchor: 'referencia',
    contextual: 'contextual',
    'calculation evidence': 'prueba de cálculo',
    'historical anchor': 'referencia histórica',
  },
  fr: {
    'The synthetic fixture records shots on target events.': 'Le match fictif contient des tirs cadrés enregistrés.',
    'The synthetic fixture records passing events.': 'Le match fictif contient des passes enregistrées.',
    'The synthetic fixture records possession losses events.': 'Le match fictif contient des pertes de balle enregistrées.',
    'Each record below is labelled as supporting, challenging, contextual, calculation evidence, or a historical anchor.': 'Chaque entrée est indiquée comme preuve à l’appui, contradictoire, contextuelle, liée au calcul ou comme repère historique.',
    'Low shot from the edge of the box, saved by the goalkeeper.': 'Frappe à ras de terre depuis le bord de la surface, arrêtée par le gardien.',
    'First-time effort from outside the area goes wide.': 'Reprise de l’extérieur de la surface hors cadre.',
    'Northbridge win a corner.': 'Northbridge obtient un corner.',
    'Header from a cross is held by the goalkeeper.': 'La tête sur un centre est captée par le gardien.',
    'A defender blocks a shot inside the area.': 'Un défenseur bloque une frappe dans la surface.',
    'Free-kick attempt clears the crossbar.': 'Le coup franc passe au-dessus de la barre.',
    'Northbridge score with a close-range shot.': 'Northbridge marque d’une frappe à bout portant.',
    'Eastport test the goalkeeper soon after the restart.': 'Eastport met à l’épreuve le gardien peu après la reprise.',
    'A counter-attacking effort goes wide.': 'Une tentative en contre passe à côté.',
    'Eastport level the score with a shot from the area.': 'Eastport égalise d’un tir depuis la surface.',
    'A driven effort is pushed away by the goalkeeper.': 'Le gardien repousse une frappe puissante.',
    'A defender gets in the way of a shot from the area.': 'Un défenseur bloque une frappe depuis la surface.',
    'A header from a cross is saved.': 'Le gardien arrête une tête sur un centre.',
    'Eastport take the lead with a shot from close range.': 'Eastport prend l’avantage d’une frappe à bout portant.',
    'Late shot is held by the goalkeeper.': 'Le gardien capte une frappe en fin de match.',
    'Northbridge shoot over in stoppage time.': 'Northbridge tire au-dessus pendant le temps additionnel.',
    'Long-range effort curls past the far post.': 'Une frappe lointaine enroulée passe à côté du poteau opposé.',
    'Turn and shot from the edge of the area is saved low.': 'Le gardien plonge pour arrêter une frappe après un contrôle à l’entrée de la surface.',
    'Eastport score with a first-time finish from a cut-back.': 'Eastport marque en une touche après un centre en retrait.',
    'A defender blocks a shot from the right of the area.': 'Un défenseur bloque une frappe venant de la droite de la surface.',
    'Volley from a corner clears the bar.': 'Une volée sur corner passe au-dessus de la barre.',
    'Close-range effort is turned away at the near post.': 'Le gardien repousse une frappe à bout portant au premier poteau.',
    'Northbridge test the goalkeeper again soon after the restart.': 'Northbridge met de nouveau à l’épreuve le gardien peu après la reprise.',
    'Northbridge level with a close-range finish.': 'Northbridge égalise d’une frappe à bout portant.',
    'Hurried shot from distance goes wide.': 'Une frappe précipitée de loin passe à côté.',
    'Shot is blocked on the six-yard line.': 'Une frappe est bloquée sur la ligne des six mètres.',
    'Low drive is saved at full stretch.': 'Le gardien détourne une frappe à ras de terre en plongeant de tout son long.',
    'Header from a free-kick drifts wide.': 'Une tête sur coup franc passe à côté.',
    'Shot on the turn is saved by the goalkeeper.': 'Le gardien arrête une frappe en pivot.',
    'Northbridge score in stoppage time with a placed finish.': 'Northbridge marque d’une frappe placée pendant le temps additionnel.',
    'Late effort from outside the area misses the target.': 'Une frappe tardive de l’extérieur de la surface manque le cadre.',
    'A defender gets across to block an early shot from the left.': 'Un défenseur intervient pour bloquer une première frappe venue de la gauche.',
    'A snap shot on the break flies over the bar.': 'Une frappe instantanée en contre passe au-dessus de la barre.',
    'A curling effort from the edge of the area is tipped away.': 'Le gardien détourne une frappe enroulée depuis l’entrée de la surface.',
    'A low shot from the right drifts wide of the post.': 'Une frappe à ras de terre venue de la droite passe à côté du poteau.',
    'A shot from the left of the area is blocked.': 'Une frappe venue de la gauche de la surface est bloquée.',
    'A close-range effort is pushed behind just before the break.': 'Une frappe à bout portant est détournée en corner juste avant la pause.',
    'A shot from a cut-back is saved low.': 'Le gardien arrête au sol une frappe après un centre en retrait.',
    'A shot from inside the area is blocked on the line.': 'Une frappe dans la surface est bloquée sur la ligne.',
    'A substitute’s first touch is a shot, saved at the near post.': 'La première touche de balle d’un remplaçant est une frappe arrêtée au premier poteau.',
    'A hurried effort from distance goes wide.': 'Une tentative précipitée de loin passe à côté.',
    'A shot from the left drifts past the far post.': 'Une frappe venue de la gauche passe à côté du poteau opposé.',
    'A stoppage-time header is saved on the line.': 'Une tête pendant le temps additionnel est arrêtée sur la ligne.',
    'An early shot from the left is saved at the near post.': 'Le gardien arrête au premier poteau une frappe précoce venue de la gauche.',
    'A shot on the turn goes over the bar.': 'Une frappe en pivot passe au-dessus de la barre.',
    'Redmere take the lead with a close-range finish.': 'Redmere prend l’avantage d’une frappe à bout portant.',
    'A defender blocks a shot from the right.': 'Un défenseur bloque une frappe venue de la droite.',
    'A long-range shot drifts wide before the break.': 'Une frappe lointaine passe à côté avant la pause.',
    'A low drive is saved by the goalkeeper.': 'Le gardien arrête une frappe à ras de terre.',
    'Alderwick equalise with a shot from the edge of the area.': 'Alderwick égalise d’un tir depuis le bord de la surface.',
    'A shot from the right of the area is blocked.': 'Une frappe venue de la droite de la surface est bloquée.',
    'A shot from a counter-attack is saved low.': 'Le gardien arrête au sol une frappe en contre-attaque.',
    'A substitute’s shot from distance misses the target.': 'La frappe lointaine d’un remplaçant manque le cadre.',
    'Alderwick’s substitute scores a late winner from a cross.': 'Le remplaçant d’Alderwick marque le but victorieux en fin de match sur un centre.',
    'A stoppage-time header is saved.': 'Le gardien arrête une tête pendant le temps additionnel.',
    'Shooter:': 'Tireur :',
    'Scorer:': 'Buteur :',
    supporting: 'à l’appui',
    challenging: 'contradictoire',
    context: 'contexte',
    calculation: 'calcul',
    anchor: 'repère',
    contextual: 'contextuel',
    'calculation evidence': 'preuve de calcul',
    'historical anchor': 'repère historique',
  },
  de: {
    'The synthetic fixture records shots on target events.': 'Das fiktive Spiel enthält erfasste Schüsse aufs Tor.',
    'The synthetic fixture records passing events.': 'Das fiktive Spiel enthält erfasste Passereignisse.',
    'The synthetic fixture records possession losses events.': 'Das fiktive Spiel enthält erfasste Ballverluste.',
    'Each record below is labelled as supporting, challenging, contextual, calculation evidence, or a historical anchor.': 'Jeder Eintrag ist als stützend, widersprechend, kontextuell, Berechnungsbeleg oder historischer Bezug gekennzeichnet.',
    'Low shot from the edge of the box, saved by the goalkeeper.': 'Flacher Schuss vom Strafraumrand, vom Torwart gehalten.',
    'First-time effort from outside the area goes wide.': 'Ein Direktversuch von außerhalb des Strafraums geht vorbei.',
    'Northbridge win a corner.': 'Northbridge holt eine Ecke heraus.',
    'Header from a cross is held by the goalkeeper.': 'Ein Kopfball nach einer Flanke wird vom Torwart gehalten.',
    'A defender blocks a shot inside the area.': 'Ein Verteidiger blockt einen Schuss im Strafraum.',
    'Free-kick attempt clears the crossbar.': 'Der Freistoß geht über die Latte.',
    'Northbridge score with a close-range shot.': 'Northbridge trifft mit einem Abschluss aus kurzer Distanz.',
    'Eastport test the goalkeeper soon after the restart.': 'Eastport prüft den Torwart kurz nach dem Wiederanpfiff.',
    'A counter-attacking effort goes wide.': 'Ein Abschluss nach einem Konter geht vorbei.',
    'Eastport level the score with a shot from the area.': 'Eastport gleicht mit einem Schuss aus dem Strafraum aus.',
    'A driven effort is pushed away by the goalkeeper.': 'Der Torwart wehrt einen harten Schuss ab.',
    'A defender gets in the way of a shot from the area.': 'Ein Verteidiger blockt einen Schuss aus dem Strafraum.',
    'A header from a cross is saved.': 'Der Torwart hält einen Kopfball nach einer Flanke.',
    'Eastport take the lead with a shot from close range.': 'Eastport geht mit einem Schuss aus kurzer Distanz in Führung.',
    'Late shot is held by the goalkeeper.': 'Der Torwart hält einen späten Schuss fest.',
    'Northbridge shoot over in stoppage time.': 'Northbridge schießt in der Nachspielzeit über das Tor.',
    'Long-range effort curls past the far post.': 'Ein Fernschuss mit Effet geht am langen Pfosten vorbei.',
    'Turn and shot from the edge of the area is saved low.': 'Der Torwart hält einen Drehschuss vom Strafraumrand flach.',
    'Eastport score with a first-time finish from a cut-back.': 'Eastport trifft direkt nach einer Hereingabe von der Grundlinie.',
    'A defender blocks a shot from the right of the area.': 'Ein Verteidiger blockt einen Schuss von rechts aus dem Strafraum.',
    'Volley from a corner clears the bar.': 'Ein Volleyschuss nach einer Ecke geht über die Latte.',
    'Close-range effort is turned away at the near post.': 'Der Torwart wehrt einen Abschluss aus kurzer Distanz am kurzen Pfosten ab.',
    'Northbridge test the goalkeeper again soon after the restart.': 'Northbridge prüft den Torwart kurz nach dem Wiederanpfiff erneut.',
    'Northbridge level with a close-range finish.': 'Northbridge gleicht mit einem Abschluss aus kurzer Distanz aus.',
    'Hurried shot from distance goes wide.': 'Ein hastiger Fernschuss geht vorbei.',
    'Shot is blocked on the six-yard line.': 'Ein Schuss wird auf der Fünfmeterraumlinie geblockt.',
    'Low drive is saved at full stretch.': 'Der Torwart hält einen flachen Schuss mit voller Streckung.',
    'Header from a free-kick drifts wide.': 'Ein Kopfball nach einem Freistoß geht vorbei.',
    'Shot on the turn is saved by the goalkeeper.': 'Der Torwart hält einen Drehschuss.',
    'Northbridge score in stoppage time with a placed finish.': 'Northbridge trifft in der Nachspielzeit mit einem platzierten Abschluss.',
    'Late effort from outside the area misses the target.': 'Ein später Schuss von außerhalb des Strafraums verfehlt das Tor.',
    'A defender gets across to block an early shot from the left.': 'Ein Verteidiger kommt herüber und blockt einen frühen Schuss von links.',
    'A snap shot on the break flies over the bar.': 'Ein schneller Schuss im Konter geht über die Latte.',
    'A curling effort from the edge of the area is tipped away.': 'Der Torwart lenkt einen Effetschuss vom Strafraumrand ab.',
    'A low shot from the right drifts wide of the post.': 'Ein flacher Schuss von rechts geht am Pfosten vorbei.',
    'A shot from the left of the area is blocked.': 'Ein Schuss von links im Strafraum wird geblockt.',
    'A close-range effort is pushed behind just before the break.': 'Ein Abschluss aus kurzer Distanz wird kurz vor der Pause zur Ecke abgewehrt.',
    'A shot from a cut-back is saved low.': 'Der Torwart hält einen Schuss nach einem Rückpass flach.',
    'A shot from inside the area is blocked on the line.': 'Ein Schuss im Strafraum wird auf der Linie geblockt.',
    'A substitute’s first touch is a shot, saved at the near post.': 'Der erste Ballkontakt eines Einwechselspielers ist ein Schuss, den der Torwart am kurzen Pfosten hält.',
    'A hurried effort from distance goes wide.': 'Ein hastiger Fernschuss geht vorbei.',
    'A shot from the left drifts past the far post.': 'Ein Schuss von links geht am langen Pfosten vorbei.',
    'A stoppage-time header is saved on the line.': 'Ein Kopfball in der Nachspielzeit wird auf der Linie gehalten.',
    'An early shot from the left is saved at the near post.': 'Der Torwart hält einen frühen Schuss von links am kurzen Pfosten.',
    'A shot on the turn goes over the bar.': 'Ein Drehschuss geht über die Latte.',
    'Redmere take the lead with a close-range finish.': 'Redmere geht mit einem Abschluss aus kurzer Distanz in Führung.',
    'A defender blocks a shot from the right.': 'Ein Verteidiger blockt einen Schuss von rechts.',
    'A long-range shot drifts wide before the break.': 'Ein Fernschuss geht vor der Pause am Tor vorbei.',
    'A low drive is saved by the goalkeeper.': 'Der Torwart hält einen flachen Schuss.',
    'Alderwick equalise with a shot from the edge of the area.': 'Alderwick gleicht mit einem Schuss vom Strafraumrand aus.',
    'A shot from the right of the area is blocked.': 'Ein Schuss von rechts aus dem Strafraum wird geblockt.',
    'A shot from a counter-attack is saved low.': 'Der Torwart hält einen flachen Schuss aus einem Konter.',
    'A substitute’s shot from distance misses the target.': 'Ein Fernschuss eines Einwechselspielers verfehlt das Tor.',
    'Alderwick’s substitute scores a late winner from a cross.': 'Alderwicks Einwechselspieler erzielt nach einer Flanke spät den Siegtreffer.',
    'A stoppage-time header is saved.': 'Der Torwart hält einen Kopfball in der Nachspielzeit.',
    'Shooter:': 'Schütze:',
    'Scorer:': 'Torschütze:',
    supporting: 'stützend',
    challenging: 'widersprechend',
    context: 'Kontext',
    calculation: 'Berechnung',
    anchor: 'Bezug',
    contextual: 'kontextuell',
    'calculation evidence': 'Berechnungsbeleg',
    'historical anchor': 'historischer Bezug',
  },
  ar: {
    'The synthetic fixture records shots on target events.': 'تتضمن المباراة الخيالية أحداثاً مسجلة للتسديدات على المرمى.',
    'The synthetic fixture records passing events.': 'تتضمن المباراة الخيالية أحداث تمرير مسجلة.',
    'The synthetic fixture records possession losses events.': 'تتضمن المباراة الخيالية أحداث فقدان استحواذ مسجلة.',
    'Each record below is labelled as supporting, challenging, contextual, calculation evidence, or a historical anchor.': 'يُصنّف كل سجل أدناه كدليل مؤيد أو معارض أو سياقي أو حسابي أو كمرجع تاريخي.',
    'Low shot from the edge of the box, saved by the goalkeeper.': 'تسديدة أرضية من حافة المنطقة يتصدى لها الحارس.',
    'First-time effort from outside the area goes wide.': 'تسديدة مباشرة من خارج المنطقة تذهب بعيداً عن المرمى.',
    'Northbridge win a corner.': 'يحصل Northbridge على ركلة ركنية.',
    'Header from a cross is held by the goalkeeper.': 'يمسك الحارس رأسية من عرضية.',
    'A defender blocks a shot inside the area.': 'يصد مدافع تسديدة داخل المنطقة.',
    'Free-kick attempt clears the crossbar.': 'تعلو الركلة الحرة العارضة.',
    'Northbridge score with a close-range shot.': 'سجل Northbridge بتسديدة من مسافة قريبة.',
    'Eastport test the goalkeeper soon after the restart.': 'اختبر Eastport الحارس بعد استئناف اللعب بوقت قصير.',
    'A counter-attacking effort goes wide.': 'تنحرف محاولة من هجمة مرتدة عن المرمى.',
    'Eastport level the score with a shot from the area.': 'عادل Eastport النتيجة بتسديدة من داخل المنطقة.',
    'A driven effort is pushed away by the goalkeeper.': 'يبعد الحارس تسديدة قوية.',
    'A defender gets in the way of a shot from the area.': 'يصد مدافع تسديدة من داخل المنطقة.',
    'A header from a cross is saved.': 'يتصدى الحارس لرأسية من عرضية.',
    'Eastport take the lead with a shot from close range.': 'تقدم Eastport بتسديدة من مسافة قريبة.',
    'Late shot is held by the goalkeeper.': 'يمسك الحارس تسديدة في الدقائق الأخيرة.',
    'Northbridge shoot over in stoppage time.': 'يسدد Northbridge فوق المرمى في الوقت بدل الضائع.',
    'Long-range effort curls past the far post.': 'تمر تسديدة بعيدة ملتفة بجوار القائم البعيد.',
    'Turn and shot from the edge of the area is saved low.': 'يتصدى الحارس أرضياً لتسديدة بعد استدارة عند حافة المنطقة.',
    'Eastport score with a first-time finish from a cut-back.': 'سجل Eastport مباشرة بعد تمريرة عكسية.',
    'A defender blocks a shot from the right of the area.': 'يصد مدافع تسديدة من يمين المنطقة.',
    'Volley from a corner clears the bar.': 'تعلو تسديدة طائرة من ركلة ركنية العارضة.',
    'Close-range effort is turned away at the near post.': 'يبعد الحارس محاولة قريبة عند القائم القريب.',
    'Northbridge test the goalkeeper again soon after the restart.': 'اختبر Northbridge الحارس مجدداً بعد استئناف اللعب بوقت قصير.',
    'Northbridge level with a close-range finish.': 'عادل Northbridge النتيجة بإنهاء من مسافة قريبة.',
    'Hurried shot from distance goes wide.': 'تذهب تسديدة متسرعة من بعيد خارج المرمى.',
    'Shot is blocked on the six-yard line.': 'تُصد تسديدة على خط منطقة الست ياردات.',
    'Low drive is saved at full stretch.': 'يتصدى الحارس لتسديدة أرضية بامتداد كامل.',
    'Header from a free-kick drifts wide.': 'تنحرف رأسية من ركلة حرة عن المرمى.',
    'Shot on the turn is saved by the goalkeeper.': 'يتصدى الحارس لتسديدة بعد استدارة.',
    'Northbridge score in stoppage time with a placed finish.': 'سجل Northbridge بتسديدة متقنة في الوقت بدل الضائع.',
    'Late effort from outside the area misses the target.': 'تخطئ محاولة متأخرة من خارج المنطقة المرمى.',
    'A defender gets across to block an early shot from the left.': 'يتدخل مدافع لصد تسديدة مبكرة من الجهة اليسرى.',
    'A snap shot on the break flies over the bar.': 'تعلو العارضة تسديدة سريعة من هجمة مرتدة.',
    'A curling effort from the edge of the area is tipped away.': 'يبعد الحارس تسديدة ملتفة من حافة المنطقة.',
    'A low shot from the right drifts wide of the post.': 'تنحرف تسديدة أرضية من اليمين بجوار القائم.',
    'A shot from the left of the area is blocked.': 'تُصد تسديدة من يسار المنطقة.',
    'A close-range effort is pushed behind just before the break.': 'يبعد الحارس محاولة قريبة إلى ركنية قبل الاستراحة بقليل.',
    'A shot from a cut-back is saved low.': 'يتصدى الحارس أرضياً لتسديدة بعد تمريرة عكسية.',
    'A shot from inside the area is blocked on the line.': 'تُصد تسديدة من داخل المنطقة على خط المرمى.',
    'A substitute’s first touch is a shot, saved at the near post.': 'كانت اللمسة الأولى للبديل تسديدة تصدى لها الحارس عند القائم القريب.',
    'A hurried effort from distance goes wide.': 'تذهب محاولة متسرعة من بعيد خارج المرمى.',
    'A shot from the left drifts past the far post.': 'تمر تسديدة من اليسار بجوار القائم البعيد.',
    'A stoppage-time header is saved on the line.': 'يتصدى الحارس لرأسية على خط المرمى في الوقت بدل الضائع.',
    'An early shot from the left is saved at the near post.': 'يتصدى الحارس عند القائم القريب لتسديدة مبكرة من اليسار.',
    'A shot on the turn goes over the bar.': 'تعلو العارضة تسديدة بعد استدارة.',
    'Redmere take the lead with a close-range finish.': 'تقدم Redmere بإنهاء من مسافة قريبة.',
    'A defender blocks a shot from the right.': 'يصد مدافع تسديدة من الجهة اليمنى.',
    'A long-range shot drifts wide before the break.': 'تنحرف تسديدة بعيدة عن المرمى قبل الاستراحة.',
    'A low drive is saved by the goalkeeper.': 'يتصدى الحارس لتسديدة أرضية.',
    'Alderwick equalise with a shot from the edge of the area.': 'عادل Alderwick النتيجة بتسديدة من حافة المنطقة.',
    'A shot from the right of the area is blocked.': 'تُصد تسديدة من يمين المنطقة.',
    'A shot from a counter-attack is saved low.': 'يتصدى الحارس أرضياً لتسديدة من هجمة مرتدة.',
    'A substitute’s shot from distance misses the target.': 'تخطئ تسديدة بعيدة من البديل المرمى.',
    'Alderwick’s substitute scores a late winner from a cross.': 'سجل بديل Alderwick هدف الفوز المتأخر من عرضية.',
    'A stoppage-time header is saved.': 'يتصدى الحارس لرأسية في الوقت بدل الضائع.',
    'Shooter:': 'مسدد الكرة:',
    'Scorer:': 'مسجل الهدف:',
    supporting: 'مؤيد',
    challenging: 'معارض',
    context: 'سياقي',
    calculation: 'حساب',
    anchor: 'مرجع',
    contextual: 'سياقي',
    'calculation evidence': 'دليل حسابي',
    'historical anchor': 'مرجع تاريخي',
  },
}

const localizedFootballOpinions: ReadonlyArray<{
  pattern: RegExp
  canonical: (...captures: string[]) => string
}> = [
  {
    pattern: /^Northbridge recorrió más distancia que Eastport[.!?؟]*$/iu,
    canonical: () => 'Northbridge covered more distance than Eastport.',
  },
  {
    pattern: /^Northbridge a parcouru plus de distance qu’Eastport[.!?؟]*$/iu,
    canonical: () => 'Northbridge covered more distance than Eastport.',
  },
  {
    pattern: /^Northbridge legte mehr Strecke zurück als Eastport[.!?؟]*$/iu,
    canonical: () => 'Northbridge covered more distance than Eastport.',
  },
  {
    pattern: /^قطع Northbridge مسافة أكبر من Eastport[.!?؟]*$/iu,
    canonical: () => 'Northbridge covered more distance than Eastport.',
  },
  {
    pattern: /^(?<team>.+?) no tuvo más tiros a puerta que (?<opponent>.+?)[.!?؟]*$/iu,
    canonical: (team, opponent) => `${team} did not have more shots on target than ${opponent}.`,
  },
  {
    pattern: /^(?<team>.+?) tuvo más tiros a puerta que (?<opponent>.+?)[.!?؟]*$/iu,
    canonical: (team, opponent) => `${team} had more shots on target than ${opponent}.`,
  },
  {
    pattern: /^(?<team>.+?) a eu plus de tirs cadrés que (?<opponent>.+?)[.!?؟]*$/iu,
    canonical: (team, opponent) => `${team} had more shots on target than ${opponent}.`,
  },
  {
    pattern: /^(?<team>.+?) hatte mehr Schüsse aufs Tor als (?<opponent>.+?)[.!?؟]*$/iu,
    canonical: (team, opponent) => `${team} had more shots on target than ${opponent}.`,
  },
  {
    pattern: /^(?<team>.+?) كان لديه تسديدات أكثر على المرمى من (?<opponent>.+?)[.!?؟]*$/iu,
    canonical: (team, opponent) => `${team} had more shots on target than ${opponent}.`,
  },
  {
    pattern: /^سجل (?<team>.+?) تسديدات أكثر على المرمى من (?<opponent>.+?)[.!?؟]*$/iu,
    canonical: (team, opponent) => `${team} had more shots on target than ${opponent}.`,
  },
  {
    pattern: /^(?<team>.+?) no tuvo más tiros a puerta que (?<opponent>.+?)[.!?؟]*$/iu,
    canonical: (team, opponent) => `${team} did not have more shots on target than ${opponent}.`,
  },
  {
    pattern: /^(?<team>.+?) n['’]a pas eu plus de tirs cadrés que (?<opponent>.+?)[.!?؟]*$/iu,
    canonical: (team, opponent) => `${team} did not have more shots on target than ${opponent}.`,
  },
  {
    pattern: /^(?<team>.+?) hatte nicht mehr Schüsse aufs Tor als (?<opponent>.+?)[.!?؟]*$/iu,
    canonical: (team, opponent) => `${team} did not have more shots on target than ${opponent}.`,
  },
  {
    pattern: /^لم يكن لدى (?<team>.+?) تسديدات على المرمى أكثر من (?<opponent>.+?)[.!?؟]*$/iu,
    canonical: (team, opponent) => `${team} did not have more shots on target than ${opponent}.`,
  },
  {
    pattern: /^لم يسجل (?<team>.+?) تسديدات على المرمى أكثر من (?<opponent>.+?)[.!?؟]*$/iu,
    canonical: (team, opponent) => `${team} did not have more shots on target than ${opponent}.`,
  },
  {
    pattern: /^¿?Cuántos pases completó Bruno\??$/iu,
    canonical: () => 'How many passes did Bruno complete?',
  },
  {
    pattern: /^Combien de passes Bruno a-t-il réussies\s*\??$/iu,
    canonical: () => 'How many passes did Bruno complete?',
  },
  {
    pattern: /^Wie viele Pässe hat Bruno vervollständigt\s*\??$/iu,
    canonical: () => 'How many passes did Bruno complete?',
  },
  {
    pattern: /^كم تمريرة أكمل (?<player>.+?)[؟?]*$/iu,
    canonical: (player) => {
      const shortAliases: Record<string, string> = {
        برونو: 'Bruno',
        ساكا: 'Saka',
        مارتن: 'Martin',
        مارتين: 'Martin',
      }
      return `How many passes did ${shortAliases[player.trim()] ?? player} complete?`
    },
  },
  {
    pattern: /^(?<team>.+?) no tuvo ningún tiro a puerta[.!?؟]*$/iu,
    canonical: (team) => `${team} had no shots on target.`,
  },
  {
    pattern: /^(?<team>.+?) n['’]a cadré aucun tir[.!?؟]*$/iu,
    canonical: (team) => `${team} had no shots on target.`,
  },
  {
    pattern: /^(?<team>.+?) hatte keinen Schuss aufs Tor[.!?؟]*$/iu,
    canonical: (team) => `${team} had no shots on target.`,
  },
  {
    pattern: /^لم يكن لدى (?<team>.+?) أي تسديدة على المرمى[.!?؟]*$/iu,
    canonical: (team) => `${team} had no shots on target.`,
  },
  {
    pattern: /^لم يسجل (?<team>.+?) أي تسديدة على المرمى[.!?؟]*$/iu,
    canonical: (team) => `${team} had no shots on target.`,
  },
  {
    pattern: /^Saka ha tenido un partido horrible[.!?؟]*$/iu,
    canonical: () => 'Saka has had a horrible game.',
  },
  {
    pattern: /^Saka a fait un match horrible[.!?؟]*$/iu,
    canonical: () => 'Saka has had a horrible game.',
  },
  {
    pattern: /^Saka hat ein schreckliches Spiel gemacht[.!?؟]*$/iu,
    canonical: () => 'Saka has had a horrible game.',
  },
  {
    pattern: /^قدم (?<player>.+?) مباراة سيئة للغاية[.!?؟]*$/iu,
    canonical: (player) => `${player} has had a horrible game.`,
  },
  {
    pattern: /^(?<team>.+?) aparcó el autobús[.!?؟]*$/iu,
    canonical: (team) => `${team} parked the bus.`,
  },
  {
    pattern: /^(?<team>.+?) a garé le bus[.!?؟]*$/iu,
    canonical: (team) => `${team} parked the bus.`,
  },
  {
    pattern: /^(?<team>.+?) parkte den Bus[.!?؟]*$/iu,
    canonical: (team) => `${team} parked the bus.`,
  },
  {
    pattern: /^ركن (?<team>.+?) الحافلة[.!?؟]*$/iu,
    canonical: (team) => `${team} parked the bus.`,
  },
]

export function translateText(text: string, language: AppLanguage): string {
  if (language === 'en') return text
  const leading = text.match(/^\s*/)?.[0] ?? ''
  const trailing = text.match(/\s*$/)?.[0] ?? ''
  const content = text.slice(leading.length, text.length - trailing.length)
  const translated =
    (language === 'ar' ? arabicSupplementalTranslations[content] : undefined) ??
    translations[language]?.[content] ??
    evidenceTranslations[language]?.[content] ??
    content
  return `${leading}${translated}${trailing}`
}

function arabicCountedMetricLabel(countText: string, metric: string): string | undefined {
  const forms: Record<string, { singular: string; dual: string; plural: string }> = {
    'shots on target': {
      singular: 'تسديدة على المرمى',
      dual: 'تسديدتان على المرمى',
      plural: 'تسديدات على المرمى',
    },
    shots: { singular: 'تسديدة', dual: 'تسديدتان', plural: 'تسديدات' },
    goals: { singular: 'هدف', dual: 'هدفان', plural: 'أهداف' },
    'passes completed': {
      singular: 'تمريرة مكتملة',
      dual: 'تمريرتان مكتملتان',
      plural: 'تمريرات مكتملة',
    },
    'pass completions': {
      singular: 'تمريرة مكتملة',
      dual: 'تمريرتان مكتملتان',
      plural: 'تمريرات مكتملة',
    },
    'pass completion': {
      singular: 'تمريرة مكتملة',
      dual: 'تمريرتان مكتملتان',
      plural: 'تمريرات مكتملة',
    },
    'passes attempted': {
      singular: 'محاولة تمرير',
      dual: 'محاولتا تمرير',
      plural: 'محاولات تمرير',
    },
    'pass attempts': {
      singular: 'محاولة تمرير',
      dual: 'محاولتا تمرير',
      plural: 'محاولات تمرير',
    },
    recoveries: { singular: 'استعادة', dual: 'استعادتان', plural: 'استعادات' },
    'recorded recoveries': {
      singular: 'استعادة مسجلة',
      dual: 'استعادتان مسجلتان',
      plural: 'استعادات مسجلة',
    },
    'pressure observations': {
      singular: 'ملاحظة ضغط',
      dual: 'ملاحظتا ضغط',
      plural: 'ملاحظات ضغط',
    },
    'selected pressure observations': {
      singular: 'ملاحظة ضغط محددة',
      dual: 'ملاحظتا ضغط محددتان',
      plural: 'ملاحظات ضغط محددة',
    },
    'elapsed minutes': {
      singular: 'دقيقة منقضية',
      dual: 'دقيقتان منقضيتان',
      plural: 'دقائق منقضية',
    },
    minutes: { singular: 'دقيقة', dual: 'دقيقتان', plural: 'دقائق' },
    'elapsed participation minutes (recorded window; added time included)': {
      singular: 'دقيقة مشاركة منقضية (ضمن النافذة المسجلة؛ تشمل الوقت بدل الضائع)',
      dual: 'دقيقتان مشاركة منقضيتان (ضمن النافذة المسجلة؛ تشمل الوقت بدل الضائع)',
      plural: 'دقائق مشاركة منقضية (ضمن النافذة المسجلة؛ تشمل الوقت بدل الضائع)',
    },
    'elapsed minutes of participation in recorded coverage (added time included)': {
      singular: 'دقيقة مشاركة منقضية ضمن التغطية المسجلة (يشمل الوقت بدل الضائع)',
      dual: 'دقيقتان مشاركة منقضيتان ضمن التغطية المسجلة (يشمل الوقت بدل الضائع)',
      plural: 'دقائق مشاركة منقضية ضمن التغطية المسجلة (يشمل الوقت بدل الضائع)',
    },
    turnovers: { singular: 'حالة فقدان', dual: 'حالتا فقدان', plural: 'حالات فقدان' },
    'recorded actions': { singular: 'حدث مسجل', dual: 'حدثان مسجلان', plural: 'أحداث مسجلة' },
  }
  const metricForms = forms[metric]
  if (!metricForms) return undefined

  const count = Number(countText.replaceAll(',', ''))
  if (!Number.isFinite(count)) return undefined
  if (count === 2) return metricForms.dual
  if (count === 0 || (count >= 3 && count <= 10)) return metricForms.plural
  return metricForms.singular
}

export function canonicalizeSupportedFootballOpinion(opinion: string): string {
  const trimmed = opinion.trim()
  for (const { pattern, canonical } of localizedFootballOpinions) {
    const match = pattern.exec(trimmed)
    if (!match) continue
    const captures = match.groups
      ? Object.values(match.groups)
      : match.slice(1)
    return canonical(...captures.filter((value): value is string => value !== undefined).map((value) => value.trim()))
  }
  return opinion
}

function translateComparisonNarrative(
  text: string,
  language: Exclude<AppLanguage, 'en'>,
): string | null {
  const quotedClaim = text.match(/^“(.+?)” — (.+)$/u)
  const comparisonText = quotedClaim?.[2] ?? text
  const claimPrefix = quotedClaim
    ? `“${translateNarrative(quotedClaim[1], language)}” — `
    : ''
  const changed = comparisonText.match(/^That's changed: at (.+) it (.+); at (.+) it (.+)\.$/u)
  if (changed) {
    const states: Record<string, {
      before: Record<Exclude<AppLanguage, 'en'>, string>
      after: Record<Exclude<AppLanguage, 'en'>, string>
    }> = {
      'held up': {
        before: { es: 'la afirmación se sostuvo', fr: 'la conclusion a tenu', de: 'die Aussage hielt stand', ar: 'صمد الادعاء' },
        after: { es: 'la afirmación se sostiene', fr: 'elle tient', de: 'die Aussage hält stand', ar: 'يصمد الادعاء' },
      },
      "didn't hold up": {
        before: { es: 'la afirmación no se sostuvo', fr: 'la conclusion n’a pas tenu', de: 'die Aussage hielt nicht stand', ar: 'لم يصمد الادعاء' },
        after: { es: 'la afirmación no se sostiene', fr: 'elle ne tient pas', de: 'die Aussage hält nicht stand', ar: 'لا يصمد الادعاء' },
      },
      'holds up': {
        before: { es: 'la afirmación se sostuvo', fr: 'la conclusion a tenu', de: 'die Aussage hielt stand', ar: 'صمد الادعاء' },
        after: { es: 'la afirmación se sostiene', fr: 'elle tient', de: 'die Aussage hält stand', ar: 'يصمد الادعاء' },
      },
      "doesn't hold up": {
        before: { es: 'la afirmación no se sostuvo', fr: 'la conclusion n’a pas tenu', de: 'die Aussage hielt nicht stand', ar: 'لم يصمد الادعاء' },
        after: { es: 'la afirmación no se sostiene', fr: 'elle ne tient pas', de: 'die Aussage hält nicht stand', ar: 'لا يصمد الادعاء' },
      },
      "couldn't be settled from the records": {
        before: { es: 'no pudo resolverse con los registros', fr: 'n’a pas pu être tranchée à partir des données', de: 'ließ sich anhand der Aufzeichnungen nicht klären', ar: 'تعذّر حسمه من السجلات' },
        after: { es: 'no puede resolverse con los registros', fr: 'ne peut pas être tranchée à partir des données', de: 'lässt sich anhand der Aufzeichnungen nicht klären', ar: 'لا يمكن حسمه من السجلات' },
      },
      'had figures only': {
        before: { es: 'solo ofreció cifras', fr: 'n’a fourni que des chiffres', de: 'es wurden nur Zahlen ausgegeben', ar: 'قُدمت أرقام فقط' },
        after: { es: 'solo ofrece cifras', fr: 'ne fournit que des chiffres', de: 'es werden nur Zahlen ausgegeben', ar: 'تُقدم أرقام فقط' },
      },
      'needed clarifying': {
        before: { es: 'necesitó una aclaración', fr: 'a nécessité une précision', de: 'musste präzisiert werden', ar: 'احتاج إلى توضيح' },
        after: { es: 'necesita una aclaración', fr: 'nécessite une précision', de: 'muss präzisiert werden', ar: 'يحتاج إلى توضيح' },
      },
      'had no recorded data': {
        before: { es: 'no tenía datos registrados', fr: 'ne disposait d’aucune donnée enregistrée', de: 'es waren keine Daten erfasst', ar: 'لم تكن هناك بيانات مسجلة' },
        after: { es: 'no tiene datos registrados', fr: 'ne dispose d’aucune donnée enregistrée', de: 'es sind keine Daten erfasst', ar: 'لا توجد بيانات مسجلة' },
      },
      "wasn't understood": {
        before: { es: 'no se entendió', fr: 'n’a pas été comprise', de: 'wurde nicht verstanden', ar: 'لم تُفهم الصياغة' },
        after: { es: 'no se entiende', fr: 'n’est pas comprise', de: 'wird nicht verstanden', ar: 'لا تُفهم الصياغة' },
      },
    }
    const before = states[changed[2]]?.before
    const after = states[changed[4]]?.after
    if (before && after) {
      return {
        es: `${claimPrefix}Cambió: en ${changed[1]}, ${before[language]}; en ${changed[3]}, ${after[language]}.`,
        fr: `${claimPrefix}Cela a changé : à ${changed[1]}, ${before[language]} ; à ${changed[3]}, ${after[language]}.`,
        de: `${claimPrefix}Das hat sich geändert: bei ${changed[1]} ${before[language]}; bei ${changed[3]} ${after[language]}.`,
        ar: `${claimPrefix}تغيّر الأمر: عند ${changed[1]} ${before[language]}؛ وعند ${changed[3]} ${after[language]}.`,
      }[language]
    }
  }

  const same = comparisonText.match(/^Same call at both times: it (.+)\.$/u)
  if (same) {
    const phrases: Record<string, Record<Exclude<AppLanguage, 'en'>, string>> = {
      'holds up': { es: 'la afirmación se mantiene', fr: 'la conclusion tient', de: 'die Aussage hält stand', ar: 'الادعاء يصمد' },
      "doesn't hold up": { es: 'la afirmación no se sostiene', fr: 'la conclusion ne tient pas', de: 'die Aussage hält nicht stand', ar: 'الادعاء لا يصمد' },
      "can't be settled from the records": { es: 'no puede resolverse con los registros', fr: 'ne peut pas être tranchée à partir des données', de: 'lässt sich anhand der Aufzeichnungen nicht klären', ar: 'لا يمكن حسمه من السجلات' },
      'has figures only': { es: 'solo ofrece cifras', fr: 'ne fournit que des chiffres', de: 'liefert nur Zahlen', ar: 'تعرض أرقاماً فقط' },
      'needs clarifying': { es: 'necesita una aclaración', fr: 'nécessite une précision', de: 'muss präzisiert werden', ar: 'يحتاج إلى توضيح' },
      'has no recorded data': { es: 'no tiene datos registrados', fr: 'ne dispose d’aucune donnée enregistrée', de: 'hat keine erfassten Daten', ar: 'لا تتوفر له بيانات مسجلة' },
      "isn't understood": { es: 'no se entiende', fr: 'n’est pas comprise', de: 'wird nicht verstanden', ar: 'لا تُفهم الصياغة' },
    }
    const phrase = phrases[same[1]]
    if (phrase) {
      return {
        es: `${claimPrefix}La misma conclusión en ambos momentos: ${phrase[language]}.`,
        fr: `${claimPrefix}Même conclusion aux deux moments : ${phrase[language]}.`,
        de: `${claimPrefix}Gleiches Ergebnis zu beiden Zeitpunkten: ${phrase[language]}.`,
        ar: `${claimPrefix}النتيجة نفسها في كلا التوقيتين: ${phrase[language]}.`,
      }[language]
    }
  }

  const figure = comparisonText.match(/^([^:]+): (.+)\.$/u)
  if (figure) {
    const labels: Record<string, Record<Exclude<AppLanguage, 'en'>, string>> = {
      'shots on target': { es: 'Tiros a puerta', fr: 'Tirs cadrés', de: 'Schüsse aufs Tor', ar: 'تسديدات على المرمى' },
      shots: { es: 'Tiros', fr: 'Tirs', de: 'Schüsse', ar: 'تسديدات' },
      goals: { es: 'Goles', fr: 'Buts', de: 'Tore', ar: 'أهداف' },
      'passes completed': { es: 'Pases completados', fr: 'Passes réussies', de: 'Angekommene Pässe', ar: 'تمريرات مكتملة' },
      possession: { es: 'Posesión', fr: 'Possession', de: 'Ballbesitz', ar: 'الاستحواذ' },
    }
    const localizedLabel = labels[figure[1].toLowerCase()]
    const rows = figure[2].split(', ').map((entry) =>
      entry.match(/^(.+?) (n\/a|[\d,.%]+)(?: → (n\/a|[\d,.%]+))?$/u),
    )
    if (localizedLabel && rows.every((row) => row !== null)) {
      const values = rows.map((row) => {
        if (!row) return ''
        return row[3] === undefined
          ? `${row[1]} ${row[2]}`
          : `${row[1]} ${row[2]} → ${row[3]}`
      })
      return `${localizedLabel[language]}: ${values.join(', ')}.`
    }
  }

  const cardLabels: Record<string, Record<Exclude<AppLanguage, 'en'>, string>> = {
    'Decisive figures': {
      es: 'Cifras decisivas',
      fr: 'Chiffres décisifs',
      de: 'Entscheidende Zahlen',
      ar: 'الأرقام الحاسمة',
    },
    'New recorded moments': {
      es: 'Nuevos momentos registrados',
      fr: 'Nouveaux moments enregistrés',
      de: 'Neue aufgezeichnete Momente',
      ar: 'لحظات مسجلة جديدة',
    },
    'No longer in the window': {
      es: 'Ya no está en la ventana',
      fr: 'N’est plus dans la fenêtre',
      de: 'Nicht mehr im Zeitfenster',
      ar: 'لم تعد ضمن النافذة',
    },
  }
  const cardLabel = cardLabels[text]
  if (cardLabel) return cardLabel[language]

  const assessmentRow = text.match(/^(\d{1,2}(?:\+\d+)?′) \((.+)\): (.+)$/u)
  if (assessmentRow) {
    return `${assessmentRow[1]} (${translateNarrative(assessmentRow[2], language)}): ${translateNarrative(assessmentRow[3], language)}`
  }

  const note = text.match(/^Note: (.+)$/u)
  if (note) {
    const labels = {
      es: 'Nota:',
      fr: 'Remarque :',
      de: 'Hinweis:',
      ar: 'ملاحظة:',
    }
    return `${labels[language]} ${translateNarrative(note[1], language)}`
  }

  const records = text.match(/^New in the records: (.+)$/u)
  if (records) {
    const intro = {
      es: 'Nuevos datos registrados:',
      fr: 'Nouveaux éléments enregistrés :',
      de: 'Neu in den Aufzeichnungen:',
      ar: 'جديد في السجلات:',
    }
    const listed = records[1].replace(/\.$/u, '')
    return `${intro[language]} ${listed.split('; ').map((line) => translateNarrative(line, language)).join('؛ ')}.`
  }

  const removed = text.match(/^No longer in the window: (.+)$/u)
  if (removed) {
    const intro = {
      es: 'Ya no está en la ventana:',
      fr: 'N’est plus dans la fenêtre :',
      de: 'Nicht mehr im Zeitfenster:',
      ar: 'لم تعد ضمن النافذة:',
    }
    const listed = removed[1].replace(/\.$/u, '')
    return `${intro[language]} ${listed.split('; ').map((line) => translateNarrative(line, language)).join('؛ ')}.`
  }

  const checkedAt = text.match(/^Checked at (.+), then again at (.+)$/u)
  if (checkedAt) {
    return {
      es: `Comprobado en ${checkedAt[1]} y de nuevo en ${checkedAt[2]}`,
      fr: `Vérifié à ${checkedAt[1]}, puis de nouveau à ${checkedAt[2]}`,
      de: `Geprüft bei ${checkedAt[1]}, dann erneut bei ${checkedAt[2]}`,
      ar: `تم التحقق عند ${checkedAt[1]} ثم مجدداً عند ${checkedAt[2]}`,
    }[language]
  }

  const earlierAnswer = text.match(/^Earlier answer · (.+) · (Match so far|Last 10 minutes)$/u)
  if (earlierAnswer) {
    const periodKey = earlierAnswer[2] === 'Match so far' ? 'Match so far' : 'Last 10 minutes'
    const periods = {
      'Match so far': { es: 'hasta ese momento', fr: 'jusqu’à ce moment', de: 'bis dahin', ar: 'حتى ذلك الوقت' },
      'Last 10 minutes': { es: 'últimos 10 minutos', fr: '10 dernières minutes', de: 'letzte 10 Minuten', ar: 'آخر 10 دقائق' },
    }
    const label = {
      es: 'Respuesta anterior',
      fr: 'Réponse précédente',
      de: 'Vorherige Antwort',
      ar: 'الإجابة السابقة',
    }
    return `${label[language]} · ${earlierAnswer[1]} · ${periods[periodKey][language]}`
  }

  const accounting: Record<string, Record<Exclude<AppLanguage, 'en'>, string>> = {
    "The listed moments match the change in the count. That's a tally, not a reason: the records can't say why it happened.": {
      es: 'Los momentos enumerados coinciden con el cambio del recuento. Es un recuento, no una causa: los registros no indican por qué ocurrió.',
      fr: 'Les moments indiqués correspondent à l’évolution du total. C’est un décompte, pas une explication : les données ne disent pas pourquoi cela s’est produit.',
      de: 'Die aufgeführten Momente entsprechen der Änderung der Anzahl. Das ist eine Zählung, keine Ursache: Aus den Aufzeichnungen geht nicht hervor, warum es dazu kam.',
      ar: 'تتوافق اللحظات المذكورة مع التغيّر في العدد. هذا إحصاء لا تفسير؛ فالسجلات لا توضح سبب حدوثه.',
    },
    "The records listed don't fully account for the change in these figures.": {
      es: 'Los registros enumerados no explican por completo el cambio de estas cifras.',
      fr: 'Les éléments indiqués n’expliquent pas entièrement l’évolution de ces chiffres.',
      de: 'Die aufgeführten Aufzeichnungen erklären die Änderung dieser Werte nicht vollständig.',
      ar: 'لا تفسر السجلات المذكورة التغيّر في هذه الأرقام بالكامل.',
    },
    "Some of the records behind these figures aren't fully recorded, so the ones listed may not be the whole story.": {
      es: 'Algunos registros que sustentan estas cifras están incompletos, por lo que la lista puede no mostrar todo.',
      fr: 'Certains éléments à l’origine de ces chiffres sont incomplets ; la liste ne montre donc peut-être pas tout.',
      de: 'Einige Datensätze zu diesen Werten sind unvollständig; die aufgeführten Einträge zeigen daher möglicherweise nicht alles.',
      ar: 'بعض السجلات التي تستند إليها هذه الأرقام غير مكتملة، لذا قد لا تعرض القائمة الصورة كاملة.',
    },
    "This is a rate or share, so the records listed don't add up to the change directly.": {
      es: 'Se trata de una tasa o proporción, por lo que los registros enumerados no suman directamente el cambio.',
      fr: 'Il s’agit d’un taux ou d’une part ; les éléments indiqués ne correspondent donc pas directement à son évolution.',
      de: 'Dies ist eine Quote oder ein Anteil; die aufgeführten Datensätze ergeben daher nicht unmittelbar die Änderung.',
      ar: 'هذا معدل أو نسبة، لذلك لا تجمع السجلات المذكورة التغيّر مباشرة.',
    },
  }
  const accountingText = accounting[text]
  if (accountingText) return accountingText[language]

  const rolling = text.match(/^Rolling windows: (.+) against (.+), so earlier moments can drop out\.$/u)
  if (rolling) {
    return {
      es: `Ventanas móviles: ${rolling[1]} frente a ${rolling[2]}, por lo que los momentos anteriores pueden quedar fuera.`,
      fr: `Fenêtres glissantes : ${rolling[1]} et ${rolling[2]} ; des moments antérieurs peuvent donc sortir de la fenêtre.`,
      de: `Rollierende Zeitfenster: ${rolling[1]} gegenüber ${rolling[2]}; frühere Momente können dadurch herausfallen.`,
      ar: `نوافذ متحركة: ${rolling[1]} مقابل ${rolling[2]}، لذا قد تخرج اللحظات الأسبق من النافذة.`,
    }[language]
  }

  return null
}

export function translateNarrative(text: string, language: AppLanguage): string {
  if (language === 'en') return text
  const exact = translateText(text, language)
  if (exact !== text) return exact

  const movingTo = text.match(/^Moving to (.+)…$/u)
  if (movingTo) {
    return {
      es: `Avanzando a ${movingTo[1]}…`,
      fr: `Passage à ${movingTo[1]}…`,
      de: `Weiter zu ${movingTo[1]}…`,
      ar: `جارٍ الانتقال إلى ${movingTo[1]}…`,
    }[language]
  }

  const comparison = translateComparisonNarrative(text, language)
  if (comparison !== null) return comparison

  const savedOpinionNotice = text.match(/^The latest reply is for the saved opinion above(, not the wording now in the box\. “Check this moment” submits the edited wording instead)?\.$/u)
  if (savedOpinionNotice) {
    const hasEditedDraft = savedOpinionNotice[1] !== undefined
    return {
      es: hasEditedDraft
        ? 'La respuesta más reciente corresponde a la opinión guardada arriba, no al texto que aparece ahora en el cuadro. «Comprobar este minuto» envía el texto editado.'
        : 'La respuesta más reciente corresponde a la opinión guardada arriba.',
      fr: hasEditedDraft
        ? 'La dernière réponse correspond à l’avis enregistré ci-dessus, pas au texte actuellement saisi. « Vérifier cette minute » envoie le texte modifié.'
        : 'La dernière réponse correspond à l’avis enregistré ci-dessus.',
      de: hasEditedDraft
        ? 'Die letzte Antwort bezieht sich auf die oben gespeicherte Meinung, nicht auf den aktuellen Text im Eingabefeld. „Diesen Moment prüfen“ sendet den bearbeiteten Text.'
        : 'Die letzte Antwort bezieht sich auf die oben gespeicherte Meinung.',
      ar: hasEditedDraft
        ? 'الإجابة الأخيرة تخص الرأي المحفوظ أعلاه، لا النص الموجود الآن في المربع. يرسل «تحقق من هذه اللحظة» النص المعدّل.'
        : 'الإجابة الأخيرة تخص الرأي المحفوظ أعلاه.',
    }[language]
  }

  const staleAnswer = text.match(/^The latest reply is for (.+) · (.+)\. The replay is now at (.+); that answer has not been recalculated\.$/u)
  if (staleAnswer) {
    const period = translateNarrative(staleAnswer[2], language)
    return {
      es: `La respuesta más reciente corresponde a ${staleAnswer[1]} · ${period}. La repetición está ahora en ${staleAnswer[3]}; esa respuesta no se ha recalculado.`,
      fr: `La dernière réponse correspond à ${staleAnswer[1]} · ${period}. La rediffusion est maintenant à ${staleAnswer[3]} ; cette réponse n’a pas été recalculée.`,
      de: `Die letzte Antwort gilt für ${staleAnswer[1]} · ${period}. Die Wiederholung steht jetzt bei ${staleAnswer[3]}; diese Antwort wurde nicht neu berechnet.`,
      ar: `الإجابة الأخيرة تخص ${staleAnswer[1]} · ${period}. أصبحت الإعادة عند ${staleAnswer[3]}؛ ولم يُعَد حساب تلك الإجابة.`,
    }[language]
  }

  const checkAgain = text.match(/^Check again at (.+)$/u)
  if (checkAgain) {
    return {
      es: `Volver a comprobar en ${checkAgain[1]}`,
      fr: `Vérifier de nouveau à ${checkAgain[1]}`,
      de: `Erneut prüfen bei ${checkAgain[1]}`,
      ar: `أعِد التحقق عند ${checkAgain[1]}`,
    }[language]
  }

  const recentPeriod = text.match(/^Last 10 minutes ending (.+)$/u)
  if (recentPeriod) return `آخر عشر دقائق حتى ${recentPeriod[1]}`

  const claimEvidenceCount = text.match(/^All (\d+) claim evidence references$/u)
  if (claimEvidenceCount) {
    const count = claimEvidenceCount[1]
    return `كل مراجع الأدلة الخاصة بالادعاء (${count})`
  }

  const claimNumber = text.match(/^Claim (\d+)$/u)
  if (claimNumber) return `الادعاء ${claimNumber[1]}`

  const playerMetricExplanation = text.match(
    /^Report (.+?) for (.+?) from selected synthetic records\.$/u,
  )
  if (playerMetricExplanation) {
    const metric = playerMetricExplanation[1]
    const player = playerMetricExplanation[2]
    const metricLabel = metric === 'pass completions'
      ? 'عدد التمريرات المكتملة'
      : metric === 'pass attempts'
        ? 'عدد محاولات التمرير'
        : metric === 'shots on target'
          ? 'عدد التسديدات على المرمى'
          : metric === 'shots'
            ? 'عدد التسديدات'
            : metric === 'goals'
              ? 'عدد الأهداف'
              : metric === 'recoveries'
                ? 'عدد الاستعادات'
                : metric === 'pressure observations'
                  ? 'عدد ملاحظات الضغط'
                  : metric
    return `يعرض ${metricLabel} المسجلة للاعب ${player} ضمن السجلات الاصطناعية للفترة المحددة.`
  }

  const sameWording = text.match(/^Same wording, same (match-so-far|last-10-minutes) option( — this checks the saved opinion, not your edit)?\.$/u)
  if (sameWording) {
    const period = sameWording[1] === 'match-so-far' ? 'Match so far' : 'Last 10 minutes'
    const periodLabel = translateNarrative(period, language)
    const editedDraft = sameWording[2] !== undefined
    return {
      es: `Mismo texto, con la opción «${periodLabel}»${editedDraft ? ' — se comprueba la opinión guardada, no tu edición' : ''}.`,
      fr: `Même formulation, avec l’option « ${periodLabel} »${editedDraft ? ' — l’avis enregistré est vérifié, pas votre modification' : ''}.`,
      de: `Gleicher Wortlaut, mit der Option „${periodLabel}“${editedDraft ? ' — geprüft wird die gespeicherte Meinung, nicht deine Änderung' : ''}.`,
      ar: `الصياغة نفسها، مع خيار «${periodLabel}»${editedDraft ? ' — يُتحقق من الرأي المحفوظ لا من تعديلك' : ''}.`,
    }[language]
  }

  const playerPassCompletions = text.match(/^(.+?): ([\d,.]+) pass completions\.$/u)
  if (playerPassCompletions) {
    return `${playerPassCompletions[1]}: ${translateNarrative(
      `${playerPassCompletions[2]} pass completions`,
      language,
    )}.`
  }

  const countedMetric = text.match(/^([\d,.]+)(%)?\s+(shots on target|shots|goals|passes completed|pass completions|pass completion|passes attempted|pass attempts|recoveries|recorded recoveries|pressure observations|selected pressure observations|possession|elapsed participation minutes(?: \(recorded window; added time included\))?|elapsed minutes|minutes|turnovers|recorded actions)(.*)$/u)
  if (countedMetric) {
    if (language === 'ar') {
      const arabicLabel = arabicCountedMetricLabel(countedMetric[1], countedMetric[3])
      if (arabicLabel) {
        return `${countedMetric[1]}${countedMetric[2] ?? ''} ${arabicLabel}${countedMetric[4]}`
      }
    }
    const metrics: Record<string, Record<Exclude<AppLanguage, 'en'>, string>> = {
      'shots on target': { es: 'tiros a puerta', fr: 'tirs cadrés', de: 'Schüsse aufs Tor', ar: 'تسديدات على المرمى' },
      shots: { es: 'tiros', fr: 'tirs', de: 'Schüsse', ar: 'تسديدات' },
      goals: { es: 'goles', fr: 'buts', de: 'Tore', ar: 'أهداف' },
      'passes completed': { es: 'pases completados', fr: 'passes réussies', de: 'vollständige Pässe', ar: 'تمريرات مكتملة' },
      'pass completions': { es: 'pases completados', fr: 'passes réussies', de: 'vollständige Pässe', ar: 'تمريرات مكتملة' },
      'pass completion': { es: 'pases completados', fr: 'passes réussies', de: 'Passerfolge', ar: 'تمريرات مكتملة' },
      'passes attempted': { es: 'pases intentados', fr: 'passes tentées', de: 'Passversuche', ar: 'محاولات تمرير' },
      'pass attempts': { es: 'intentos de pase', fr: 'tentatives de passe', de: 'Passversuche', ar: 'محاولات تمرير' },
      recoveries: { es: 'recuperaciones', fr: 'récupérations', de: 'Rückeroberungen', ar: 'استعادات' },
      'recorded recoveries': { es: 'recuperaciones registradas', fr: 'récupérations enregistrées', de: 'erfasste Rückeroberungen', ar: 'استعادات مسجلة' },
      'pressure observations': { es: 'observaciones de presión', fr: 'observations de pressing', de: 'Pressing-Beobachtungen', ar: 'ملاحظات الضغط' },
      'selected pressure observations': { es: 'observaciones de presión seleccionadas', fr: 'observations de pressing sélectionnées', de: 'ausgewählte Pressing-Beobachtungen', ar: 'ملاحظات الضغط المحددة' },
      possession: { es: 'posesión', fr: 'possession', de: 'Ballbesitz', ar: 'الاستحواذ' },
      'elapsed participation minutes (recorded window; added time included)': { es: 'minutos transcurridos de participación (ventana registrada; incluye el tiempo añadido)', fr: 'minutes écoulées de participation (fenêtre enregistrée ; temps additionnel inclus)', de: 'verstrichene Teilnahmeminuten (erfasster Zeitraum; Nachspielzeit eingeschlossen)', ar: 'دقائق مشاركة منقضية (ضمن النافذة المسجلة؛ تشمل الوقت بدل الضائع)' },
      'elapsed minutes': { es: 'minutos transcurridos', fr: 'minutes écoulées', de: 'verstrichene Minuten', ar: 'دقائق منقضية' },
      minutes: { es: 'minutos', fr: 'minutes', de: 'Minuten', ar: 'دقائق' },
      turnovers: { es: 'pérdidas', fr: 'pertes de balle', de: 'Ballverluste', ar: 'فقدان الكرة' },
      'recorded actions': { es: 'acciones registradas', fr: 'actions enregistrées', de: 'erfasste Aktionen', ar: 'أحداث مسجلة' },
    }
    const metric = metrics[countedMetric[3]]
    if (!metric) return text
    return `${countedMetric[1]}${countedMetric[2] ?? ''} ${metric[language]}${countedMetric[4]}`
  }

  const passRecord = text.match(/^(Completed|Incomplete|Linked complete|Linked incomplete) pass by (.+?),? intended for (.+?)\.?$/u)
  if (passRecord) {
    const [verb, passer, receiver] = passRecord.slice(1)
    const linked = verb.startsWith('Linked ')
    const complete = verb === 'Completed' || verb === 'Linked complete'
    return {
      es: `${linked ? 'Pase vinculado' : 'Pase'} ${complete ? 'completado' : 'incompleto'} de ${passer}, dirigido a ${receiver}.`,
      fr: `${linked ? 'Passe liée' : 'Passe'} ${complete ? 'réussie' : 'incomplète'} de ${passer}, destinée à ${receiver}.`,
      de: `${linked ? 'Verknüpfter Pass' : 'Pass'} ${complete ? 'angekommen' : 'unvollständig'} von ${passer} zu ${receiver}.`,
      ar: `${linked ? 'التمريرة المرتبطة' : 'تمريرة'} ${complete ? 'مكتملة' : 'غير مكتملة'} من ${passer} إلى ${receiver}.`,
    }[language]
  }

  const turnover = text.match(/^Recorded (?:(annotated build-up) )?incomplete-pass turnover by (.+?) in the (defensive|middle|final)-third\.?$/u)
  if (turnover) {
    const buildup = turnover[1] !== undefined
    const area = turnover[3] === 'defensive'
      ? { es: 'tercio defensivo', fr: 'tiers défensif', de: 'Abwehrdrittel', ar: 'الثلث الدفاعي' }
      : turnover[3] === 'middle'
        ? { es: 'tercio medio', fr: 'tiers médian', de: 'Mitteldrittel', ar: 'الثلث الأوسط' }
        : { es: 'tercio ofensivo', fr: 'tiers offensif', de: 'Angriffsdrittel', ar: 'الثلث الهجومي' }
    return {
      es: `Pérdida registrada${buildup ? ' en la muestra anotada de salida' : ''} tras un pase incompleto de ${turnover[2]} en el ${area.es}.`,
      fr: `Perte de balle enregistrée${buildup ? ' dans l’échantillon annoté de relance' : ''} après une passe incomplète de ${turnover[2]} dans le ${area.fr}.`,
      de: `Erfasster Ballverlust${buildup ? ' in der annotierten Aufbau-Stichprobe' : ''} nach einem unvollständigen Pass von ${turnover[2]} im ${area.de}.`,
      ar: `فقدان مسجل للكرة${buildup ? ' ضمن عينة البناء المعلّمة' : ''} بعد تمريرة غير مكتملة من ${turnover[2]} في ${area.ar}.`,
    }[language]
  }

  const pressure = text.match(/^Selected (challenge|pressured pass) observation by (.+?); pressure coverage is partial( \(context only\))?\.?$/u)
  if (pressure) {
    const contextOnly = pressure[3] !== undefined
    const event = pressure[1] === 'challenge'
    return {
      es: `Observación seleccionada de ${event ? 'desafío' : 'pase bajo presión'} por ${pressure[2]}; la cobertura de presión es parcial${contextOnly ? ' (solo contexto)' : ''}.`,
      fr: `Observation sélectionnée de ${event ? 'duel' : 'passe sous pression'} par ${pressure[2]} ; la couverture du pressing est partielle${contextOnly ? ' (contexte uniquement)' : ''}.`,
      de: `Ausgewählte Beobachtung zu ${event ? 'einem Zweikampf' : 'einem Pass unter Druck'} von ${pressure[2]}; die Pressing-Abdeckung ist teilweise${contextOnly ? ' (nur Kontext)' : ''}.`,
      ar: `ملاحظة مختارة عن ${event ? 'مواجهة' : 'تمريرة تحت الضغط'} بواسطة ${pressure[2]}؛ تغطية الضغط جزئية${contextOnly ? ' (للسياق فقط)' : ''}.`,
    }[language]
  }

  const evidenceRole = text.match(/^(.+?) · (supporting|challenging|context|calculation|anchor)$/u)
  if (evidenceRole) {
    return `${evidenceRole[1]} · ${translateText(evidenceRole[2], language)}`
  }

  const evidenceCount = text.match(/^All (\d+) claim evidence references$/u)
  if (evidenceCount) {
    const labels = {
      es: 'referencias de evidencia de la afirmación',
      fr: 'références aux preuves de l’affirmation',
      de: 'Belegverweise für die Behauptung',
      ar: 'مراجع أدلة الادعاء',
    }
    return `${evidenceCount[1]} ${labels[language]}`
  }

  const limitation = text.match(/^Limitation: (.+)$/u)
  if (limitation) return `${translateText('Limitation:', language)} ${translateNarrative(limitation[1], language)}`
  const limitations = text.match(/^Limitations: (.+)$/u)
  if (limitations) return `${translateText('Limitations:', language)} ${translateNarrative(limitations[1], language)}`

  const teamEvent = text.match(/^(.+?): (.+)$/u)
  if (teamEvent) {
    const actor = teamEvent[2].match(/^(.+?) (Shooter|Scorer): (.+?)(\.)?$/u)
    const description = actor?.[1] ?? teamEvent[2]
    const translatedDescription = translateText(description, language)
    if (translatedDescription !== description) {
      const translatedActor = actor
        ? ` ${translateText(`${actor[2]}:`, language)} ${actor[3]}${actor[4] ?? ''}`
        : ''
      return `${teamEvent[1]}: ${translatedDescription}${translatedActor}`
    }
    const translatedEvent = translateNarrative(teamEvent[2], language)
    if (translatedEvent !== teamEvent[2]) return `${teamEvent[1]}: ${translatedEvent}`
  }

  const eventActor = text.match(/^(.+?) (Shooter|Scorer): (.+?)(\.)?$/u)
  if (eventActor) {
    return `${translateNarrative(eventActor[1], language)} ${translateText(`${eventActor[2]}:`, language)} ${eventActor[3]}${eventActor[4] ?? ''}`
  }

  const at = text.match(/^At (.+)$/u)
  if (at) {
    return {
      es: `En ${at[1]}`,
      fr: `À ${at[1]}`,
      de: `Bei ${at[1]}`,
      ar: `عند ${at[1]}`,
    }[language]
  }

  const fictionalTeams = text.match(/^(.+) and (.+) are fictional teams using real-player names\. Every performance and result is invented\.$/u)
  if (fictionalTeams) {
    const [home, away] = fictionalTeams.slice(1)
    return {
      es: `${home} y ${away} son equipos ficticios con nombres de jugadores reales; todas las actuaciones y resultados son inventados.`,
      fr: `${home} et ${away} sont des équipes fictives avec des noms de joueurs réels ; toutes les performances et tous les résultats sont inventés.`,
      de: `${home} und ${away} sind fiktive Teams mit echten Spielernamen; alle Leistungen und Ergebnisse sind erfunden.`,
      ar: `${home} و${away} فريقان خياليان بأسماء لاعبين حقيقية؛ جميع الأداء والنتائج مختلقة.`,
    }[language]
  }
  const receiptAt = text.match(/^Evidence receipt at (.+)$/u)
  if (receiptAt) return `${translateText('Evidence receipt at', language)} ${receiptAt[1]}`

  const fixtureVersion = text.match(/^(Original match|Return match|Westhaven fixture|Redmere fixture) v([\d.]+)$/u)
  if (fixtureVersion) return `${translateText(fixtureVersion[1], language)} v${fixtureVersion[2]}`

  const messageLabel = text.match(/^(You|Groupchat Analyst) · (.+)$/u)
  if (messageLabel) {
    const speaker = messageLabel[1] === 'You' ? translateText('You', language) : messageLabel[1]
    return `${speaker} · ${translateNarrative(messageLabel[2], language)}`
  }

  const checkedComparison = text.match(/^(.+?) vs (.+?) · (shots on target|shots|goals|passes completed|possession) · (.+)$/u)
  if (checkedComparison) {
    const metric = {
      'shots on target': { es: 'tiros a puerta', fr: 'tirs cadrés', de: 'Schüsse aufs Tor', ar: 'تسديدات على المرمى' },
      shots: { es: 'tiros', fr: 'tirs', de: 'Schüsse', ar: 'تسديدات' },
      goals: { es: 'goles', fr: 'buts', de: 'Tore', ar: 'أهداف' },
      'passes completed': { es: 'pases completados', fr: 'passes réussies', de: 'angekommene Pässe', ar: 'تمريرات مكتملة' },
      possession: { es: 'posesión', fr: 'possession', de: 'Ballbesitz', ar: 'الاستحواذ' },
    }[checkedComparison[3]]
    if (metric) {
      const versus = {
        es: 'contra',
        fr: 'contre',
        de: 'gegen',
        ar: 'ضد',
      }[language]
      return `${checkedComparison[1]} ${versus} ${checkedComparison[2]} · ${metric[language]} · ${translateNarrative(checkedComparison[4], language)}`
    }
  }

  const checkedSummary = text.match(
    /^(.+?) · (.+?) · ((?:Match so far|Last 10 minutes|First half|Second half|Recorded ).+)$/u,
  )
  if (checkedSummary) {
    const what = checkedSummary[2]
      .split(', ')
      .map((metric) => translateNarrative(metric, language))
      .join(language === 'ar' ? '، ' : ', ')
    return `${translateNarrative(checkedSummary[1], language)} · ${what} · ${translateNarrative(checkedSummary[3], language)}`
  }

  const extended = text.match(/^Extended card · (\d+) claims?$/u)
  if (extended) {
    return {
      es: `Tarjeta ampliada · ${extended[1]} ${extended[1] === '1' ? 'afirmación' : 'afirmaciones'}`,
      fr: `Carte détaillée · ${extended[1]} ${extended[1] === '1' ? 'affirmation' : 'affirmations'}`,
      de: `Erweiterte Karte · ${extended[1]} ${extended[1] === '1' ? 'Behauptung' : 'Behauptungen'}`,
      ar: `بطاقة موسعة · ${extended[1]} ${extended[1] === '1' ? 'ادعاء' : 'ادعاءات'}`,
    }[language]
  }

  const remainingMoments = text.match(/^(\d+) more recorded moments? (?:is|are) in the full record\.$/u)
  if (remainingMoments) {
    const count = Number(remainingMoments[1])
    return {
      es: `Hay ${remainingMoments[1]} ${count === 1 ? 'momento registrado más' : 'momentos registrados más'} en el registro completo.`,
      fr: `Le relevé complet contient ${remainingMoments[1]} ${count === 1 ? 'autre moment enregistré' : 'autres moments enregistrés'}.`,
      de: `Im vollständigen Datensatz sind ${remainingMoments[1]} weitere ${count === 1 ? 'Moment' : 'Momente'} erfasst.`,
      ar: `يوجد ${remainingMoments[1]} ${count === 1 ? 'لحظة واحدة إضافية' : count === 2 ? 'لحظتان إضافيتان' : count >= 3 && count <= 10 ? 'لحظات إضافية' : 'لحظة إضافية'} في السجل الكامل.`,
    }[language]
  }

  const verdictHeading = text.match(/^Verdict: (.+)$/u)
  if (verdictHeading) return `${translateText('Verdict:', language)} ${translateNarrative(verdictHeading[1], language)}`
  const numberedClaim = text.match(/^Claim (\d+): (.+)$/u)
  if (numberedClaim) {
    const labels = { es: 'Afirmación', fr: 'Affirmation', de: 'Behauptung', ar: 'الادعاء' }
    return `${labels[language]} ${numberedClaim[1]}: ${translateNarrative(numberedClaim[2], language)}`
  }

  if (text.startsWith('Synthetic data ·')) {
    return text.split(' · ').map((part) => translateNarrative(part, language)).join(' · ')
  }

  const placeholder = text.match(/^Type an opinion, e\.g\. How many shots did (.+) have\?$/u)
  if (placeholder) {
    return {
      es: `Escribe una opinión, por ejemplo: ¿Cuántos tiros tuvo ${placeholder[1]}?`,
      fr: `Saisissez un avis, par exemple : combien de tirs ${placeholder[1]} a-t-il tentés ?`,
      de: `Gib eine Meinung ein, z. B.: Wie viele Schüsse hatte ${placeholder[1]}?`,
      ar: `اكتب رأياً، مثلاً: كم تسديدة لدى ${placeholder[1]}؟`,
    }[language]
  }

  const playerRole = text.match(/^(.+?) · (starter|substitute)$/u)
  if (playerRole) {
    const roles = {
      starter: { es: 'titular', fr: 'titulaire', de: 'Startelf', ar: 'أساسي' },
      substitute: { es: 'suplente', fr: 'remplaçant', de: 'Ersatzspieler', ar: 'بديل' },
    }
    if (playerRole[2] === 'starter' || playerRole[2] === 'substitute') {
      return `${playerRole[1]} · ${roles[playerRole[2]][language]}`
    }
  }

  const momentLabel = text.match(/^(\d+(?:\+\d+)?′) · (.+)$/u)
  if (momentLabel) {
    const labels: Record<string, Record<Exclude<AppLanguage, 'en'>, string>> = {
      'Northbridge goal': { es: 'gol de Northbridge', fr: 'but de Northbridge', de: 'Tor von Northbridge', ar: 'هدف Northbridge' },
      'Eastport goal': { es: 'gol de Eastport', fr: 'but d’Eastport', de: 'Tor von Eastport', ar: 'هدف Eastport' },
      'before equaliser': { es: 'antes del empate', fr: 'avant l’égalisation', de: 'vor dem Ausgleich', ar: 'قبل التعادل' },
      equaliser: { es: 'empate', fr: 'égalisation', de: 'Ausgleich', ar: 'التعادل' },
      'Eastport lead': { es: 'ventaja de Eastport', fr: 'avantage d’Eastport', de: 'Führung von Eastport', ar: 'تقدم Eastport' },
      'Northbridge equalise': { es: 'empate de Northbridge', fr: 'égalisation de Northbridge', de: 'Ausgleich durch Northbridge', ar: 'تعادل Northbridge' },
      'late Northbridge spell': { es: 'tramo final de Northbridge', fr: 'temps fort tardif de Northbridge', de: 'späte Druckphase von Northbridge', ar: 'فترة Northbridge المتأخرة' },
      'full-time': { es: 'final', fr: 'fin du match', de: 'Abpfiff', ar: 'نهاية المباراة' },
      'half-time': { es: 'descanso', fr: 'mi-temps', de: 'Halbzeit', ar: 'نهاية الشوط الأول' },
      'Westhaven substitution': { es: 'cambio de Westhaven', fr: 'remplacement de Westhaven', de: 'Auswechslung bei Westhaven', ar: 'تبديل Westhaven' },
      'late pressure': { es: 'presión final', fr: 'pression tardive', de: 'später Druck', ar: 'ضغط متأخر' },
      'Redmere goal': { es: 'gol de Redmere', fr: 'but de Redmere', de: 'Tor von Redmere', ar: 'هدف Redmere' },
      'Alderwick equalise': { es: 'empate de Alderwick', fr: 'égalisation d’Alderwick', de: 'Ausgleich durch Alderwick', ar: 'تعادل Alderwick' },
      'Alderwick substitution': { es: 'cambio de Alderwick', fr: 'remplacement d’Alderwick', de: 'Auswechslung bei Alderwick', ar: 'تبديل Alderwick' },
      'Alderwick winner': { es: 'gol de la victoria de Alderwick', fr: 'but victorieux d’Alderwick', de: 'Siegtreffer von Alderwick', ar: 'هدف الفوز لـAlderwick' },
    }
    const translatedLabel = labels[momentLabel[2]]?.[language] ?? translateNarrative(momentLabel[2], language)
    return `${momentLabel[1]} · ${translatedLabel}`
  }

  const lastRecorded = text.match(/^Latest recorded moment · (.+)$/u)
  if (lastRecorded) return `${translateText('Latest recorded moment', language)} · ${lastRecorded[1]}`
  const eventCount = text.match(/^(\d+) through (.+)$/u)
  if (eventCount) {
    return {
      es: `${eventCount[1]} hasta ${eventCount[2]}`,
      fr: `${eventCount[1]} jusqu’à ${eventCount[2]}`,
      de: `${eventCount[1]} bis ${eventCount[2]}`,
      ar: `${eventCount[1]} حتى ${eventCount[2]}`,
    }[language]
  }
  const recordedCount = text.match(/^(\d+) recorded$/u)
  if (recordedCount) {
    return {
      es: `${recordedCount[1]} registrados`,
      fr: `${recordedCount[1]} enregistrés`,
      de: `${recordedCount[1]} erfasst`,
      ar: `${recordedCount[1]} أحداث مسجلة`,
    }[language]
  }

  const localizedClaim = localizedExample(text, language)
  if (localizedClaim !== text) return localizedClaim

  const bruno = text.match(/^Which Bruno do you mean: (.+) or (.+)\?$/u)
  if (bruno) {
    const prompts = {
      es: `¿A qué Bruno te refieres: ${bruno[1]} o ${bruno[2]}?`,
      fr: `De quel Bruno parlez-vous : ${bruno[1]} ou ${bruno[2]} ?`,
      de: `Welchen Bruno meinst du: ${bruno[1]} oder ${bruno[2]}?`,
      ar: `أي برونو تقصد: ${bruno[1]} أم ${bruno[2]}؟`,
    }
    return prompts[language]
  }

  const tied = text.match(/^(Yes|No) — (.+?) and (.+?) are level on (\d+) (shots on target|shots|goals|passes completed) each\.$/u)
  if (tied) {
    const metricLabels: Record<string, Record<Exclude<AppLanguage, 'en'>, string>> = {
      'shots on target': { es: 'tiros a puerta', fr: 'tirs cadrés', de: 'Schüsse aufs Tor', ar: 'تسديدة على المرمى' },
      shots: { es: 'tiros', fr: 'tirs', de: 'Schüsse', ar: 'تسديدات' },
      goals: { es: 'goles', fr: 'buts', de: 'Tore', ar: 'أهداف' },
      'passes completed': { es: 'pases completados', fr: 'passes réussies', de: 'angekommene Pässe', ar: 'تمريرات مكتملة' },
    }
    const metric = metricLabels[tied[5]]
    if (!metric) return text
    const lead = tied[1] === 'Yes'
      ? { es: 'Sí', fr: 'Oui', de: 'Ja', ar: 'نعم' }
      : { es: 'No', fr: 'Non', de: 'Nein', ar: 'لا' }
    return {
      es: `${lead[language]} — ${tied[2]} y ${tied[3]} empataron con ${tied[4]} ${metric[language]} cada uno.`,
      fr: `${lead[language]} — ${tied[2]} et ${tied[3]} sont à égalité avec ${tied[4]} ${metric[language]} chacun.`,
      de: `${lead[language]} — ${tied[2]} und ${tied[3]} liegen mit jeweils ${tied[4]} ${metric[language]} gleichauf.`,
      ar: `${lead[language]} — لدى ${tied[2]} و${tied[3]} العدد نفسه: ${tied[4]} ${metric[language]} لكل منهما.`,
    }[language]
  }

  const leadMetric = text.match(/^(Yes|No) — (.+?) have (\d+) (shots on target|shots|goals|passes completed) to (.+?)'s (\d+)\.$/u)
  if (leadMetric) {
    const metric = {
      'shots on target': { es: 'tiros a puerta', fr: 'tirs cadrés', de: 'Schüsse aufs Tor', ar: 'تسديدات على المرمى' },
      shots: { es: 'tiros', fr: 'tirs', de: 'Schüsse', ar: 'تسديدات' },
      goals: { es: 'goles', fr: 'buts', de: 'Tore', ar: 'أهداف' },
      'passes completed': { es: 'pases completados', fr: 'passes réussies', de: 'angekommene Pässe', ar: 'تمريرات مكتملة' },
    }[leadMetric[4]]
    if (!metric) return text
    const lead = leadMetric[1] === 'Yes'
      ? { es: 'Sí', fr: 'Oui', de: 'Ja', ar: 'نعم' }
      : { es: 'No', fr: 'Non', de: 'Nein', ar: 'لا' }
    return {
      es: `${lead[language]} — ${leadMetric[2]} registró ${leadMetric[3]} ${metric[language]} frente a ${leadMetric[5]} de ${leadMetric[6]}.`,
      fr: `${lead[language]} — ${leadMetric[2]} a enregistré ${leadMetric[3]} ${metric[language]}, contre ${leadMetric[6]} pour ${leadMetric[5]}.`,
      de: `${lead[language]} — ${leadMetric[2]} verzeichnete ${leadMetric[3]} ${metric[language]}, ${leadMetric[5]} kam auf ${leadMetric[6]}.`,
      ar: `${lead[language]} — سجّل ${leadMetric[2]} ${leadMetric[3]} ${metric[language]} مقابل ${leadMetric[6]} لدى ${leadMetric[5]}.`,
    }[language]
  }

  const zeroCount = text.match(/^Yes — (.+?) have no recorded shots on target \((\d+) of (\d+) recorded shots\)\. This counts recorded shot events over (.+); it says nothing about chance quality\.$/u)
  if (zeroCount) {
    return {
      es: `Sí — ${zeroCount[1]} no registró tiros a puerta (${zeroCount[2]} de ${zeroCount[3]} tiros registrados). Esto cuenta los tiros registrados durante ${translateNarrative(zeroCount[4], language)}; no indica la calidad de las ocasiones.`,
      fr: `Oui — ${zeroCount[1]} n’a enregistré aucun tir cadré (${zeroCount[2]} tir cadré sur ${zeroCount[3]} tirs enregistrés). Ce décompte porte sur les tirs enregistrés pendant ${translateNarrative(zeroCount[4], language)} ; il ne renseigne pas sur la qualité des occasions.`,
      de: `Ja — für ${zeroCount[1]} ist kein Schuss aufs Tor verzeichnet (${zeroCount[2]} von ${zeroCount[3]} erfassten Schüssen). Gezählt werden erfasste Schüsse im Zeitraum ${translateNarrative(zeroCount[4], language)}; die Chancenqualität sagt das nicht aus.`,
      ar: `نعم — لم تُسجل لـ ${zeroCount[1]} أي تسديدة على المرمى (${zeroCount[2]} من أصل ${zeroCount[3]} تسديدات مسجلة). هذا تعداد للتسديدات المسجلة خلال ${translateNarrative(zeroCount[4], language)}، ولا يبين جودة الفرص.`,
    }[language]
  }

  const saka = text.match(/^Bukayo Saka had (\d+) shots on target, completed (\d+) of (\d+) passes, was on the pitch for (\d+) elapsed minutes in the selected recorded window (.+) \(on-pitch interval (.+); added time included, half-time excluded\)\. Recorded passes, shots, goals, recoveries and selected pressure observations do not add up to a performance rating, and no benchmark for “good” or “bad” is recorded\. For a specific count, ask “How many passes did Bukayo Saka complete\?” or “How many shots did Bukayo Saka have\?”$/u)
  if (saka) {
    return {
      es: `Bukayo Saka registró ${saka[1]} tiros a puerta y completó ${saka[2]} de ${saka[3]} pases. Participó ${saka[4]} minutos transcurridos dentro de la ventana registrada ${saka[5]} (intervalo en el campo ${saka[6]}; incluye el tiempo añadido y excluye el descanso). Los pases, tiros, goles, recuperaciones y observaciones de presión seleccionadas no constituyen una valoración del rendimiento, y no hay un criterio registrado de lo que es “bueno” o “malo”. Para un recuento concreto, pregunta cuántos pases o tiros completó Saka.`,
      fr: `Bukayo Saka a cadré ${saka[1]} tirs et réussi ${saka[2]} passes sur ${saka[3]}. Sa participation représente ${saka[4]} minutes écoulées dans la fenêtre enregistrée ${saka[5]} (intervalle sur le terrain ${saka[6]} ; temps additionnel inclus, mi-temps exclue). Les passes, tirs, buts, récupérations et observations de pressing sélectionnées ne constituent pas une note de performance ; aucun critère de « bon » ou « mauvais » n’est enregistré. Pour un décompte précis, demandez ses passes ou ses tirs.`,
      de: `Bukayo Saka hatte ${saka[1]} Schüsse aufs Tor und spielte ${saka[2]} von ${saka[3]} Pässen erfolgreich. Seine Teilnahme umfasst ${saka[4]} verstrichene Minuten im erfassten Zeitraum ${saka[5]} (Einsatzintervall ${saka[6]}; Nachspielzeit eingeschlossen, Halbzeitpause ausgeschlossen). Erfasste Pässe, Schüsse, Tore, Rückeroberungen und ausgewählte Pressing-Beobachtungen ergeben keine Leistungsnote; ein Maßstab für „gut“ oder „schlecht“ ist nicht erfasst. Für eine konkrete Anzahl kannst du nach Pässen oder Schüssen fragen.`,
      ar: `سجّل Bukayo Saka ${saka[1]} تسديدات على المرمى وأكمل ${saka[2]} من ${saka[3]} تمريرات. بلغت مشاركته ${saka[4]} دقيقة منقضية ضمن النافذة المسجلة ${saka[5]} (فترة وجوده في الملعب ${saka[6]}؛ يشمل الوقت بدل الضائع ويستثني الاستراحة). لا تكوّن التمريرات والتسديدات والأهداف والاستعادات وملاحظات الضغط المحددة تقييماً للأداء، ولا يوجد معيار مسجل لـ«الجيد» أو «السيئ». للسؤال عن عدد محدد، اسأل عن تمريراته أو تسديداته.`,
    }[language]
  }

  const period = text.match(/^Selected period: (.+)\. This is a fictional match using real-player names; all performances and results are fictional\.$/u)
  if (period) {
    const disclaimer = {
      es: 'Partido ficticio con nombres de jugadores reales; todas las actuaciones y resultados son ficticios.',
      fr: 'Match fictif avec des noms de joueurs réels ; toutes les performances et tous les résultats sont fictifs.',
      de: 'Fiktives Spiel mit realen Spielernamen; alle Leistungen und Ergebnisse sind erfunden.',
      ar: 'مباراة خيالية بأسماء لاعبين حقيقية؛ جميع الأداء والنتائج خيالية.',
    }
    return `${translateNarrative(period[1], language)}. ${disclaimer[language]}`
  }

  const stat = text.match(/^(.+?): ([\d,.]+) (shots on target|shots|goals|passes completed|passes attempted|recoveries|pressure observations)(.*)$/u)
  if (stat) {
    if (language === 'ar') {
      const arabicLabel = arabicCountedMetricLabel(stat[2], stat[3])
      if (arabicLabel) return `${stat[1]}: ${stat[2]} ${arabicLabel}${stat[4]}`
    }
    const metricLabels: Record<string, Record<Exclude<AppLanguage, 'en'>, string>> = {
      'shots on target': { es: 'tiros a puerta', fr: 'tirs cadrés', de: 'Schüsse aufs Tor', ar: 'تسديدات على المرمى' },
      shots: { es: 'tiros', fr: 'tirs', de: 'Schüsse', ar: 'تسديدات' },
      goals: { es: 'goles', fr: 'buts', de: 'Tore', ar: 'أهداف' },
      'passes completed': { es: 'pases completados', fr: 'passes réussies', de: 'angekommene Pässe', ar: 'تمريرات مكتملة' },
      'passes attempted': { es: 'pases intentados', fr: 'passes tentées', de: 'Passversuche', ar: 'محاولات تمرير' },
      recoveries: { es: 'recuperaciones', fr: 'récupérations', de: 'Rückeroberungen', ar: 'استعادات' },
      'pressure observations': { es: 'observaciones de presión', fr: 'observations de pressing', de: 'Pressing-Beobachtungen', ar: 'ملاحظات الضغط' },
    }
    const metric = metricLabels[stat[3]]
    if (!metric) return text
    return `${stat[1]}: ${stat[2]} ${metric[language]}${stat[4]}`
  }

  const matchSoFar = text.match(/^Match so far through (.+)$/u)
  if (matchSoFar) {
    return {
      es: `Hasta ${matchSoFar[1]} del partido`,
      fr: `Jusqu’à ${matchSoFar[1]} du match`,
      de: `Bisheriges Spiel bis ${matchSoFar[1]}`,
      ar: `من بداية المباراة حتى ${matchSoFar[1]}`,
    }[language]
  }
  const recent = text.match(/^Last 10 minutes through (.+)$/u)
  if (recent) {
    return {
      es: `Últimos 10 minutos hasta ${recent[1]}`,
      fr: `10 dernières minutes jusqu’à ${recent[1]}`,
      de: `Letzte 10 Minuten bis ${recent[1]}`,
      ar: `آخر 10 دقائق حتى ${recent[1]}`,
    }[language]
  }

  return text
}

export function localizedExample(text: string, language: AppLanguage): string {
  if (language === 'en') return text
  const arabicExamples: Record<string, string> = {
    'Eastport had more possession than Northbridge but Northbridge had more shots':
      'استحوذ إيستبورت على الكرة أكثر من نورثبريدج، لكن سدد نورثبريدج أكثر.',
    'Northbridge had more possession than Eastport':
      'استحوذ نورثبريدج على الكرة أكثر من إيستبورت.',
    'Saka’s passing has been poor': 'كان تمرير ساكا ضعيفاً.',
    'Northbridge are sloppy on the ball': 'كان نورثبريدج مهملاً في الاستحواذ على الكرة.',
    'Westhaven FC had more possession than Kingswell City':
      'استحوذ وستهافن على الكرة أكثر من كينغزويل سيتي.',
    'Haaland’s passing has been poor': 'كان تمرير هالاند ضعيفاً.',
    'Westhaven FC had no shots on target before the goal':
      'لم يسجل وستهافن أي تسديدة على المرمى قبل الهدف.',
    'Abraham has scored': 'سجّل أبراهام هدفاً.',
    'Every Alderwick United shot was on target': 'كانت كل تسديدات ألدرويك يونايتد على المرمى.',
    'Redmere FC had no shots on target before the goal':
      'لم يسجل ريدمير أي تسديدة على المرمى قبل الهدف.',
    'Redmere FC had more shots than Alderwick United':
      'سدد ريدمير أكثر من ألدرويك يونايتد.',
    'Jackson has been poor': 'كان أداء جاكسون سيئاً.',
    'How many passes did Pedro complete?': 'كم تمريرة أكمل بيدرو؟',
  }
  if (language === 'ar' && arabicExamples[text]) return arabicExamples[text]
  if (text === 'Eastport had more shots on target than Northbridge.') {
    return {
      es: 'Eastport tuvo más tiros a puerta que Northbridge.',
      fr: 'Eastport a eu plus de tirs cadrés que Northbridge.',
      de: 'Eastport hatte mehr Schüsse aufs Tor als Northbridge.',
      ar: 'سجل إيستبورت تسديدات أكثر على المرمى من نورثبريدج.',
    }[language]
  }
  if (text === 'Eastport did not have more shots on target than Northbridge.') {
    return {
      es: 'Eastport no tuvo más tiros a puerta que Northbridge.',
      fr: 'Eastport n’a pas eu plus de tirs cadrés que Northbridge.',
      de: 'Eastport hatte nicht mehr Schüsse aufs Tor als Northbridge.',
      ar: 'لم يسجل إيستبورت تسديدات على المرمى أكثر من نورثبريدج.',
    }[language]
  }
  if (text === 'Kingswell City had no shots on target.') {
    return {
      es: 'Kingswell City no tuvo ningún tiro a puerta.',
      fr: 'Kingswell City n’a cadré aucun tir.',
      de: 'Kingswell City hatte keinen Schuss aufs Tor.',
      ar: 'لم يسجل كينغزويل سيتي أي تسديدة على المرمى.',
    }[language]
  }
  if (text === 'How many passes did Bruno complete?') {
    return {
      es: '¿Cuántos pases completó Bruno?',
      fr: 'Combien de passes Bruno a-t-il réussies ?',
      de: 'Wie viele Pässe hat Bruno vervollständigt?',
      ar: 'كم تمريرة أكمل برونو؟',
    }[language]
  }
  if (text === 'Saka has had a horrible game' || text === 'Saka has had a horrible game.') {
    return {
      es: 'Saka ha tenido un partido horrible.',
      fr: 'Saka a fait un match horrible.',
      de: 'Saka hat ein schreckliches Spiel gemacht.',
      ar: 'قدم ساكا مباراة سيئة للغاية.',
    }[language]
  }
  if (text === 'Northbridge covered more distance than Eastport') {
    return {
      es: 'Northbridge recorrió más distancia que Eastport',
      fr: 'Northbridge a parcouru plus de distance qu’Eastport',
      de: 'Northbridge legte mehr Strecke zurück als Eastport',
      ar: 'قطع نورثبريدج مسافة أكبر من إيستبورت',
    }[language]
  }
  if (text === 'Northbridge parked the bus' || text === 'Northbridge parked the bus.') {
    return {
      es: 'Northbridge aparcó el autobús.',
      fr: 'Northbridge a garé le bus.',
      de: 'Northbridge parkte den Bus.',
      ar: 'ركن نورثبريدج الحافلة.',
    }[language]
  }
  return text
}
