import { shareCardBlocks, type CardBlock, type CardBlockKind, type ShareCardModel } from './presentation.ts'

export const CARD_WIDTH = 1080
const PADDING = 64
const TEXT_WIDTH = CARD_WIDTH - PADDING * 2

type Style = {
  size: number
  weight: number
  fill: string
  gap: number
  indent?: number
  upper?: boolean
  spacing?: number
}

// Every size stays at 24px or above so the exported image is legible when shrunk to a phone screen.
const STYLES: Record<CardBlockKind, Style> = {
  brand: { size: 24, weight: 700, fill: '#d4ff63', gap: 18, upper: true, spacing: 3 },
  notice: { size: 24, weight: 700, fill: '#f2c879', gap: 14 },
  take: { size: 42, weight: 700, fill: '#f2f5ee', gap: 14 },
  scope: { size: 26, weight: 500, fill: '#d4ff63', gap: 22 },
  answer: { size: 32, weight: 400, fill: '#f2f5ee', gap: 26 },
  heading: { size: 30, weight: 700, fill: '#f2f5ee', gap: 12 },
  label: { size: 24, weight: 700, fill: '#acb6aa', gap: 8, upper: true, spacing: 2 },
  bullet: { size: 26, weight: 400, fill: '#f2f5ee', gap: 8, indent: 30 },
  note: { size: 24, weight: 400, fill: '#d9c9a3', gap: 10 },
  footer: { size: 24, weight: 500, fill: '#acb6aa', gap: 0 },
}

// Conservative average glyph width so wrapped lines never run past the card edge.
const GLYPH = 0.56

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function wrapText(value: string, limit: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const pieces = word.length <= limit ? [word] : word.match(new RegExp(`.{1,${limit}}`, 'g')) ?? [word]
    for (const piece of pieces) {
      if (line && `${line} ${piece}`.length > limit) {
        lines.push(line)
        line = piece
      } else {
        line = line ? `${line} ${piece}` : piece
      }
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

type PlacedLine = { text: string; x: number; y: number; style: Style }

function layout(blocks: CardBlock[]): { lines: PlacedLine[]; height: number } {
  const lines: PlacedLine[] = []
  let y = PADDING + 12
  for (const { kind, text } of blocks) {
    const style = STYLES[kind]
    const indent = style.indent ?? 0
    const limit = Math.floor((TEXT_WIDTH - indent) / (style.size * GLYPH))
    const content = style.upper ? text.toUpperCase() : text
    const lineHeight = Math.round(style.size * 1.4)
    wrapText(content, limit).forEach((line, index) => {
      y += index === 0 ? lineHeight - 6 : lineHeight
      lines.push({ text: line, x: PADDING + indent, y, style })
    })
    y += style.gap + 6
  }
  return { lines, height: Math.max(420, y + PADDING - 24) }
}

export type ShareCardImage = { svg: string; width: number; height: number }

export function createShareCardImage(model: ShareCardModel): ShareCardImage {
  const { lines, height } = layout(shareCardBlocks(model))
  const body = lines
    .map(({ text, x, y, style }) => {
      const spacing = style.spacing ? ` letter-spacing="${style.spacing}"` : ''
      return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${style.size}" font-weight="${style.weight}" fill="${style.fill}"${spacing}>${xmlEscape(text)}</text>`
    })
    .join('\n')
  const bullets = lines
    .filter(({ style }) => style.indent)
    .map(({ y, style }, index, all) => {
      const previous = all[index - 1]
      if (previous && y - previous.y < Math.round(style.size * 1.4) + 1) return ''
      return `<circle cx="${PADDING + 8}" cy="${y - style.size * 0.32}" r="4" fill="#d4ff63"/>`
    })
    .join('\n')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${height}" viewBox="0 0 ${CARD_WIDTH} ${height}">
<rect width="${CARD_WIDTH}" height="${height}" fill="#0c110f"/>
<rect x="16" y="16" width="${CARD_WIDTH - 32}" height="${height - 32}" rx="28" fill="#171e19" stroke="#39453a" stroke-width="2"/>
${bullets}
${body}
</svg>`
  return { svg, width: CARD_WIDTH, height }
}

/** Rasterises the SVG so the download opens everywhere, including chat apps that reject SVG. */
export function svgToPngBlob(image: ShareCardImage, scale = 1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([image.svg], { type: 'image/svg+xml;charset=utf-8' }))
    const element = new Image()
    element.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.width * scale
      canvas.height = image.height * scale
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas is unavailable.'))
        return
      }
      context.scale(scale, scale)
      context.drawImage(element, 0, 0, image.width, image.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image export failed.'))), 'image/png')
    }
    element.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image export failed.'))
    }
    element.src = url
  })
}
