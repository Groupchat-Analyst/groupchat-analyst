import {
  BASELINE_DATASET_ID,
  DATASET_CATALOG,
  REDMERE_DATASET_ID_PUBLIC,
  RETURN_DATASET_ID_PUBLIC,
  WESTHAVEN_DATASET_ID_PUBLIC,
} from './datasetCatalog.ts'
import type { AppLanguage } from './localization.ts'
import type { MatchTeam } from './matchClock.ts'

type PlayerName = { id: string; canonical: string; arabic: string; team: MatchTeam }

function roster(
  north: ReadonlyArray<readonly [string, string]>,
  east: ReadonlyArray<readonly [string, string]>,
): PlayerName[] {
  return [
    ...north.map(([canonical, arabic], index) => ({
      id: `north-player-${String(index + 1).padStart(2, '0')}`,
      canonical,
      arabic,
      team: 'Northbridge' as const,
    })),
    ...east.map(([canonical, arabic], index) => ({
      id: `east-player-${String(index + 1).padStart(2, '0')}`,
      canonical,
      arabic,
      team: 'Eastport' as const,
    })),
  ]
}

const BASELINE_ROSTER = roster(
  [
    ['David Raya', 'دافيد رايا'], ['Jurriën Timber', 'يورين تيمبر'], ['William Saliba', 'ويليام ساليبا'],
    ['Gabriel Magalhães', 'غابرييل ماغالهايس'], ['Riccardo Calafiori', 'ريكاردو كالافيوري'],
    ['Declan Rice', 'ديكلان رايس'], ['Martín Zubimendi', 'مارتين زوبيميندي'],
    ['Martin Ødegaard', 'مارتن أوديغارد'], ['Bukayo Saka', 'بوكايو ساكا'],
    ['Eberechi Eze', 'إيبيريتشي إيزي'], ['Viktor Gyökeres', 'فيكتور يوكيريس'],
    ['Ben White', 'بن وايت'], ['Kepa Arrizabalaga', 'كيبا أريزابالاغا'],
    ['Cristhian Mosquera', 'كريستيان موسكيرا'], ['Piero Hincapié', 'بييرو هينكابي'],
    ['Myles Lewis-Skelly', 'مايلز لويس-سكيللي'], ['Mikel Merino', 'ميكيل ميرينو'],
    ['Bruno Guimarães', 'برونو غيماريش'], ['Noni Madueke', 'نوني مادويكي'], ['Kai Havertz', 'كاي هافيرتز'],
  ],
  [
    ['Senne Lammens', 'سينه لامنس'], ['Diogo Dalot', 'ديوغو دالوت'], ['Matthijs de Ligt', 'ماتياس دي ليخت'],
    ['Lisandro Martínez', 'ليساندرو مارتينيز'], ['Luke Shaw', 'لوك شو'], ['Carlos Baleba', 'كارلوس باليبا'],
    ['Kobbie Mainoo', 'كوبي ماينو'], ['Bruno Fernandes', 'برونو فرنانديز'], ['Amad', 'أماد'],
    ['Matheus Cunha', 'ماتيوس كونيا'], ['Benjamin Šeško', 'بنيامين شيشكو'], ['Leny Yoro', 'ليني يورو'],
    ['Karl Darlow', 'كارل دارلو'], ['Harry Maguire', 'هاري ماغواير'], ['Noussair Mazraoui', 'نصير مزراوي'],
    ['Patrick Dorgu', 'باتريك دورغو'], ['Manuel Ugarte', 'مانويل أوغارتي'], ['Mason Mount', 'ماسون ماونت'],
    ['Bryan Mbeumo', 'برايان مبيومو'], ['Joshua Zirkzee', 'جوشوا زيركزي'],
  ],
)

const WESTHAVEN_ROSTER = roster(
  [
    ['Emiliano Martinez', 'إيميليانو مارتينيز'], ['Reece James', 'ريس جيمس'], ['Wesley Fofana', 'ويسلي فوفانا'],
    ['Levi Colwill', 'ليفي كولويل'], ['Jorrel Hato', 'يوريل هاتو'], ['Moises Caicedo', 'مويسيس كايسيدو'],
    ['Romeo Lavia', 'روميو لافيا'], ['Cole Palmer', 'كول بالمر'], ['Pedro Neto', 'بيدرو نيتو'],
    ['Jamie Gittens', 'جيمي غيتنز'], ['Joao Pedro', 'جواو بيدرو'], ['Mike Penders', 'مايك بندرز'],
    ['Malo Gusto', 'مالو غوستو'], ['Maxence Lacroix', 'ماكسينس لاكروا'], ['Jordan Henderson', 'جوردان هندرسون'],
    ['Valentin Barco', 'فالنتين باركو'], ['Morgan Rogers', 'مورغان روجرز'], ['Danny Welbeck', 'داني ويلبيك'],
    ['Emmanuel Emegha', 'إيمانويل إيميغا'], ['Geovany Quenda', 'جيوفاني كويندا'],
  ],
  [
    ['Gianluigi Donnarumma', 'جيانلويجي دوناروما'], ['Matheus Nunes', 'ماتيوس نونيز'], ['Rúben Dias', 'روبن دياز'],
    ['Marc Guéhi', 'مارك غيهي'], ['Joško Gvardiol', 'يوشكو غفارديول'], ['Enzo Fernández', 'إنزو فرنانديز'],
    ['Mateo Kovačić', 'ماتيو كوفاتشيتش'], ['Rayan Cherki', 'ريان شرقي'], ['Phil Foden', 'فيل فودين'],
    ['Jérémy Doku', 'جيريمي دوكو'], ['Erling Haaland', 'إيرلينغ هالاند'], ['Marcus Bettinelli', 'ماركوس بيتينيلي'],
    ['Rico Lewis', 'ريكو لويس'],     ['Abdukodir Khusanov', 'عبدوكودير خوسانوف'], ['Rayan Aït-Nouri', 'ريان آيت نوري'],
    ["Nico O'Reilly", 'نيكو أرايلي'], ['Elliot Anderson', 'إليوت أندرسون'], ['Antoine Semenyo', 'أنطوان سيمينيو'],
    ['Iliman Ndiaye', 'إليمان ندياي'], ['Allan', 'ألان'],
  ],
)

const REDMERE_ROSTER = roster(
  [
    ['Alisson Becker', 'أليسون بيكر'], ['Conor Bradley', 'كونور برادلي'], ['Virgil van Dijk', 'فيرجيل فان دايك'],
    ['Giovanni Leoni', 'جيوفاني ليوني'], ['Milos Kerkez', 'ميلوش كيركيز'], ['Ryan Gravenberch', 'ريان خرافنبرخ'],
    ['Alexis Mac Allister', 'أليكسيس ماك أليستر'], ['Florian Wirtz', 'فلوريان فيرتز'], ['Cody Gakpo', 'كودي خاكبو'],
    ['Dominik Szoboszlai', 'دومينيك سوبوسلاي'], ['Alexander Isak', 'ألكسندر إيزاك'],
    ['Giorgi Mamardashvili', 'جيورجي مامارداشفيلي'], ['Joe Gomez', 'جو غوميز'], ['Jeremie Frimpong', 'جيريمي فريمبونغ'],
    ['Wataru Endo', 'واتارو إندو'], ['Federico Chiesa', 'فيديريكو كييزا'], ['Hugo Ekitike', 'هوغو إيكيتيكي'],
    ['Bradley Barcola', 'برادلي باركولا'], ['Rio Ngumoha', 'ريو نغوموها'], ['Jayden Danns', 'جايدن دانز'],
  ],
  [
    ['Marco Bizot', 'ماركو بيزوت'], ['Matty Cash', 'ماتي كاش'], ['Pau Torres', 'باو توريس'],
    ['Tyrone Mings', 'تايرون مينغز'], ['Ian Maatsen', 'إيان ماتسن'], ['Boubacar Kamara', 'بوبكر كامارا'],
    ['John McGinn', 'جون ماكغين'], ['Emiliano Buendía', 'إيميليانو بوينديا'], ['Alejandro Garnacho', 'أليخاندرو غارناتشو'],
    ['Ross Barkley', 'روس باركلي'], ['Nicolas Jackson', 'نيكولاس جاكسون'], ['Zion Suzuki', 'زيون سوزوكي'],
    ['Victor Lindelöf', 'فيكتور ليندلوف'], ['Matteo Ruggeri', 'ماتيو روجيري'], ['Amadou Onana', 'أمادو أونانا'],
    ['Leon Goretzka', 'ليون غوريتسكا'], ['João Gomes', 'جواو غوميز'], ['Ibrahim Mbaye', 'إبراهيم مباي'],
    ['Tammy Abraham', 'تامي أبراهام'], ['Brian Madjo', 'برايان مادجو'],
  ],
)

const ROSTERS: Record<string, PlayerName[]> = {
  [BASELINE_DATASET_ID]: BASELINE_ROSTER,
  [RETURN_DATASET_ID_PUBLIC]: BASELINE_ROSTER,
  [WESTHAVEN_DATASET_ID_PUBLIC]: WESTHAVEN_ROSTER,
  [REDMERE_DATASET_ID_PUBLIC]: REDMERE_ROSTER,
}

const ARABIC_TEAMS: Record<string, { home: string; away: string; homeAliases: string[]; awayAliases: string[] }> = {
  [BASELINE_DATASET_ID]: { home: 'نورثبريدج', away: 'إيستبورت', homeAliases: [], awayAliases: [] },
  [RETURN_DATASET_ID_PUBLIC]: { home: 'نورثبريدج', away: 'إيستبورت', homeAliases: [], awayAliases: [] },
  [WESTHAVEN_DATASET_ID_PUBLIC]: {
    home: 'وستهافن', away: 'كينغزويل سيتي', homeAliases: ['ويستهافن'], awayAliases: ['كينغزويل'],
  },
  [REDMERE_DATASET_ID_PUBLIC]: {
    home: 'ريدمير', away: 'ألدرويك يونايتد', homeAliases: ['ريد مير'], awayAliases: ['ألدرويك'],
  },
}

function replaceNames(text: string, names: ReadonlyArray<readonly [string, string]>): string {
  return [...names]
    .filter(([canonical]) => canonical.length > 0)
    .sort(([first], [second]) => second.length - first.length)
    .reduce((value, [canonical, display]) => {
      const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const characterClass = /\p{Script=Arabic}/u.test(canonical)
        ? '[\\p{Script=Arabic}\\p{N}]'
        : '[\\p{Script=Latin}\\p{N}]'
      return value.replace(
        new RegExp(`(?<!${characterClass})${escaped}(?!${characterClass})`, 'giu'),
        display,
      )
    }, text)
}

export function localizedPlayerName(
  datasetId: string,
  playerId: string,
  canonicalName: string,
  language: AppLanguage,
): string {
  if (language !== 'ar') return canonicalName
  return ROSTERS[datasetId]?.find(({ id, canonical }) =>
    id === playerId && canonical === canonicalName,
  )?.arabic ?? canonicalName
}

export function localizedTeamMonogram(
  datasetId: string,
  team: string,
  language: AppLanguage,
): string | undefined {
  if (language !== 'ar') return undefined
  const entry = DATASET_CATALOG.find(({ id }) => id === datasetId)
  const teams = ARABIC_TEAMS[datasetId]
  if (!entry || !teams) return undefined
  if (team === entry.teams[0] || team === 'Northbridge') return teams.home.slice(0, 1)
  if (team === entry.teams[1] || team === 'Eastport') return teams.away.slice(0, 1)
  return undefined
}

export function localizeMatchText(
  text: string,
  datasetId: string,
  language: AppLanguage,
): string {
  if (language !== 'ar') return text
  const teams = ARABIC_TEAMS[datasetId]
  const entry = DATASET_CATALOG.find(({ id }) => id === datasetId)
  const names: Array<readonly [string, string]> = [
    ...(ROSTERS[datasetId] ?? []).map(({ canonical, arabic }) => [canonical, arabic] as const),
  ]
  if (teams && entry) {
    names.push(
      ['Northbridge', teams.home],
      ['Eastport', teams.away],
      [entry.teams[0], teams.home],
      [entry.teams[1], teams.away],
      ...entry.teamAliases[0].map((alias) => [alias, teams.home] as const),
      ...entry.teamAliases[1].map((alias) => [alias, teams.away] as const),
    )
  }
  const localized = replaceNames(text, names)
  const connector = text.match(/^(\s*)v(\s*)$/iu)
  return connector
    ? `${connector[1]}ضد${connector[2]}`
    : localized.replace(/(?<=\s)v(?=\s)/giu, 'ضد')
}

export function canonicalizeArabicMatchAliases(text: string, datasetId: string): string {
  const teams = ARABIC_TEAMS[datasetId]
  const entry = DATASET_CATALOG.find(({ id }) => id === datasetId)
  const names: Array<readonly [string, string]> = (ROSTERS[datasetId] ?? [])
    .map(({ canonical, arabic }) => [arabic, canonical] as const)
  const playerNameAliases: Array<readonly [string, string]> = []
  for (const { canonical } of ROSTERS[datasetId] ?? []) {
    if (canonical === 'Bruno Fernandes') playerNameAliases.push(['برونو فيرنانديز', canonical])
    if (canonical === 'Bruno Guimarães') playerNameAliases.push(['برونو غيمارايش', canonical])
  }
  names.push(...playerNameAliases)
  if (teams && entry) {
    names.push(
      [teams.home, entry.teams[0]],
      [teams.away, entry.teams[1]],
      ...teams.homeAliases.map((alias) => [alias, entry.teams[0]] as const),
      ...teams.awayAliases.map((alias) => [alias, entry.teams[1]] as const),
    )
  }
  let canonical = replaceNames(text, names)
  const componentAliases = new Map<string, Set<string>>()
  for (const { canonical: playerName, arabic } of ROSTERS[datasetId] ?? []) {
    const canonicalParts = playerName.split(/\s+/u)
    const arabicParts = arabic.split(/\s+/u)
    if (canonicalParts.length !== arabicParts.length) continue
    for (const [index, arabicPart] of arabicParts.entries()) {
      const aliases = componentAliases.get(arabicPart) ?? new Set<string>()
      aliases.add(canonicalParts[index])
      componentAliases.set(arabicPart, aliases)
    }
  }
  const normalize = (value: string) =>
    value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const componentAliasesToCanonical = [...componentAliases.entries()]
    .map(([arabic, parts]) => [arabic, [...parts]] as const)
    .filter(([, parts]) => new Set(parts.map(normalize)).size === 1)
    .map(([arabic, parts]) => [arabic, parts[0]] as const)
  canonical = replaceNames(canonical, componentAliasesToCanonical)
  return canonical
}
