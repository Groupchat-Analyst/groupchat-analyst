import type { CardBlock } from './presentation.ts'

export type PreparedImage = { key: string; file: File }

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>
  canShare?: (data?: ShareData) => boolean
}

export type ShareOutcome = {
  status: 'shared' | 'cancelled' | 'unsupported' | 'not-ready' | 'failed'
  message: string
}

/** Identifies the exact card content, so a prepared image is never reused for a different card. */
export function imageKey(kind: string, blocks: CardBlock[]): string {
  return `${kind}\n${blocks.map((block) => `${block.kind}:${block.text}`).join('\n')}`
}

export function supportsFileShare(nav: ShareNavigator | undefined, probe: File): boolean {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false
  try {
    return nav.canShare({ files: [probe] })
  } catch {
    return false
  }
}

export function preparedFor(prepared: PreparedImage | null, key: string): File | null {
  return prepared && prepared.key === key ? prepared.file : null
}

/**
 * Must be called directly from a click handler. It reaches `share()` before any await,
 * so the already-prepared image keeps the browser's user activation.
 * It never makes an analysis request and never claims a message was delivered.
 */
export async function shareReceipts(
  nav: ShareNavigator | undefined,
  prepared: PreparedImage | null,
  key: string,
  title: string,
): Promise<ShareOutcome> {
  const file = preparedFor(prepared, key)
  if (!nav || typeof nav.share !== 'function') {
    return { status: 'unsupported', message: 'Sharing files is not available in this browser. Copy the card text or download the image instead.' }
  }
  if (!file) {
    return { status: 'not-ready', message: 'The card image is still being prepared. Try again in a moment, or download it.' }
  }
  try {
    await nav.share({ files: [file], title })
    return { status: 'shared', message: 'Handed to the share sheet.' }
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'AbortError') {
      return { status: 'cancelled', message: '' }
    }
    return { status: 'failed', message: 'The share sheet could not open. Copy the card text or download the image instead.' }
  }
}
