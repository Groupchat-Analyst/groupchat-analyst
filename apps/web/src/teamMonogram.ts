/** Initials of the first two words, e.g. "Westhaven FC" → "WF"; single names give their first letter. */
export function teamMonogram(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0]?.[0] ?? '?').toUpperCase()
}
