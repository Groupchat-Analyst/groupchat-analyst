import type { AppLanguage } from './localization.ts'
import { formatNumber } from './factualPresentation.ts'

/** Typed evidence-description templates keyed by record kind; names and times arrive localized. */
type Parts = { time: string; team: string; player?: string; detail?: string }

const TEMPLATES: Record<AppLanguage, {
  turnover: (p: Required<Pick<Parts, 'time' | 'team' | 'player'>> & { pass: string }) => string
  possession: (p: { time: string; team: string; minutes: string; status: 'controlled' | 'contested' | 'out-of-play' }) => string
  otherEvent: (p: { time: string; team: string }) => string
  legacy: (p: { time: string; team: string; source: string }) => string
}> = {
  en: {
    turnover: (p) => `Recorded turnover · ${p.time} · ${p.team} · ${p.player} · incomplete pass ${p.pass}`,
    possession: (p) => `${p.status === 'controlled' ? 'Controlled possession' : p.status === 'contested' ? 'Contested play' : 'Ball out of play'} · ${p.time} · ${p.team} · ${p.minutes}`,
    otherEvent: (p) => `Other recorded match event · ${p.time} · ${p.team} · see original source wording`,
    legacy: (p) => `Evidence record · ${p.time} · ${p.team} · original source wording: ${p.source}`,
  },
  es: {
    turnover: (p) => `Pérdida registrada · ${p.time} · ${p.team} · ${p.player} · pase fallido ${p.pass}`,
    possession: (p) => `${p.status === 'controlled' ? 'Posesión controlada' : p.status === 'contested' ? 'Juego disputado' : 'Balón fuera de juego'} · ${p.time} · ${p.team} · ${p.minutes}`,
    otherEvent: (p) => `Otro evento registrado del partido · ${p.time} · ${p.team} · consulta el texto original`,
    legacy: (p) => `Registro de evidencia · ${p.time} · ${p.team} · texto original: ${p.source}`,
  },
  fr: {
    turnover: (p) => `Perte de balle enregistrée · ${p.time} · ${p.team} · ${p.player} · passe manquée ${p.pass}`,
    possession: (p) => `${p.status === 'controlled' ? 'Possession contrôlée' : p.status === 'contested' ? 'Jeu disputé' : 'Ballon hors jeu'} · ${p.time} · ${p.team} · ${p.minutes}`,
    otherEvent: (p) => `Autre événement de match enregistré · ${p.time} · ${p.team} · voir le texte source d’origine`,
    legacy: (p) => `Élément de preuve · ${p.time} · ${p.team} · texte source d’origine : ${p.source}`,
  },
  de: {
    turnover: (p) => `Erfasster Ballverlust · ${p.time} · ${p.team} · ${p.player} · missglückter Pass ${p.pass}`,
    possession: (p) => `${p.status === 'controlled' ? 'Kontrollierter Ballbesitz' : p.status === 'contested' ? 'Umkämpftes Spiel' : 'Ball im Aus'} · ${p.time} · ${p.team} · ${p.minutes}`,
    otherEvent: (p) => `Sonstiges erfasstes Spielereignis · ${p.time} · ${p.team} · siehe ursprünglicher Quelltext`,
    legacy: (p) => `Belegeintrag · ${p.time} · ${p.team} · ursprünglicher Quelltext: ${p.source}`,
  },
  ar: {
    turnover: (p) => `خسارة كرة مسجّلة · ${p.time} · ${p.team} · ${p.player} · تمريرة غير ناجحة ${p.pass}`,
    possession: (p) => `${p.status === 'controlled' ? 'استحواذ مسيطر عليه' : p.status === 'contested' ? 'لعب متنازع عليه' : 'الكرة خارج اللعب'} · ${p.time} · ${p.team} · ${p.minutes}`,
    otherEvent: (p) => `حدث آخر مسجّل في المباراة · ${p.time} · ${p.team} · انظر النص الأصلي للمصدر`,
    legacy: (p) => `سجل دليل · ${p.time} · ${p.team} · النص الأصلي للمصدر: ${p.source}`,
  },
}

const minutesText = (value: number, language: AppLanguage): string => {
  const n = formatNumber(value, language)
  switch (language) {
    case 'es': return `${n} ${value === 1 ? 'minuto registrado' : 'minutos registrados'}`
    case 'fr': return `${n} ${value <= 1 ? 'minute enregistrée' : 'minutes enregistrées'}`
    case 'de': return `${n} ${value === 1 ? 'erfasste Minute' : 'erfasste Minuten'}`
    case 'ar': return value === 1 ? 'دقيقة مسجّلة واحدة' : value === 2 ? 'دقيقتان مسجّلتان' : `${n} ${value >= 3 && value <= 10 ? 'دقائق مسجّلة' : 'دقيقة مسجّلة'}`
    default: return `${n} recorded ${value === 1 ? 'minute' : 'minutes'}`
  }
}

export function formatTurnoverEvidence(
  p: { time: string; team: string; player: string; passId: string },
  language: AppLanguage,
): string {
  return TEMPLATES[language].turnover({ ...p, pass: p.passId })
}

export function formatPossessionEvidence(
  p: { time: string; team: string; minutes: number; status: 'controlled' | 'contested' | 'out-of-play' },
  language: AppLanguage,
): string {
  return TEMPLATES[language].possession({ ...p, minutes: minutesText(p.minutes, language) })
}

export function formatOtherEventEvidence(
  p: { time: string; team: string },
  language: AppLanguage,
): string {
  return TEMPLATES[language].otherEvent(p)
}

export function formatLegacyEvidence(
  p: { time: string; team: string; source: string },
  language: AppLanguage,
): string {
  return TEMPLATES[language].legacy(p)
}
