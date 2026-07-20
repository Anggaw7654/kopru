import type { ContextItem, SystemSummary } from '@shared/types/context.js'

const KIND_LABEL: Record<ContextItem['kind'], string> = {
  file: 'Dosya',
  log: 'Log',
  sql: 'SQL',
  terminal: 'Terminal çıktısı',
  system: 'Sunucu durumu',
  note: 'Not',
}

/**
 * Renders the basket as markdown. The header states plainly that secrets were
 * stripped — whoever reads this should not assume the absence of a password
 * means there wasn't one.
 */
export function formatForClipboard(
  items: ContextItem[],
  summary: SystemSummary | null,
  question: string,
): string {
  const parts: string[] = []

  if (question.trim() !== '') {
    parts.push(question.trim(), '')
  }

  if (summary) {
    parts.push('## Sunucu')
    parts.push(`- Profil: ${summary.profileName} (${summary.host})`)
    parts.push(`- Sistem: ${summary.osRelease}`)
    parts.push(`- Çalışma süresi: ${summary.uptime}`)
    if (summary.metrics !== undefined) parts.push(`- Ölçümler: ${summary.metrics}`)
    if (summary.docker !== undefined) parts.push(`- Docker: ${summary.docker}`)
    if (summary.postgres !== undefined) parts.push(`- PostgreSQL: ${summary.postgres}`)
    parts.push('')
  }

  for (const item of items) {
    parts.push(`## ${KIND_LABEL[item.kind]}: ${item.label}`)
    if (item.redactions.length > 0) {
      const detail = item.redactions
        .map((entry) => `${entry.kind} ×${String(entry.count)}`)
        .join(', ')
      parts.push(`> Gizli bilgi çıkarıldı: ${detail}`)
    }
    parts.push('```' + (item.language ?? ''))
    parts.push(item.content)
    parts.push('```')
    parts.push('')
  }

  const totalRedactions = items.reduce(
    (sum, item) => sum + item.redactions.reduce((n, entry) => n + entry.count, 0),
    0,
  )
  if (totalRedactions > 0) {
    parts.push(
      '---',
      `_Bu metinden ${String(totalRedactions)} yerde parola, anahtar veya token ` +
        'çıkarıldı. Bir değerin görünmemesi, orada bir değer olmadığı anlamına gelmez._',
    )
  }

  return parts.join('\n')
}
