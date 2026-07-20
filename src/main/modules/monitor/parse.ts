import type {
  DiskMetric,
  MemoryMetric,
  NginxMetric,
  PostgresMetric,
  ServiceStatus,
  SessionMetric,
} from '../../../shared/types/metrics.js'
import { DELIM } from './command.js'

export interface RawBlocks {
  CPU?: string[]
  MEM?: string[]
  DISK?: string[]
  WHO?: string[]
  SVC?: string[]
  NGINX?: string[]
  PG?: string[]
  DOCKER?: string[]
}

export function splitBlocks(output: string): RawBlocks {
  const blocks: RawBlocks = {}
  let current: keyof RawBlocks | null = null

  for (const line of output.split('\n')) {
    if (line.startsWith(DELIM)) {
      const name = line.slice(DELIM.length).trim()
      if (name === 'END') break
      current = name as keyof RawBlocks
      blocks[current] = []
      continue
    }
    if (current === null) continue
    if (line.trim() === '') continue
    blocks[current]?.push(line)
  }
  return blocks
}

/** Sum of all /proc/stat cpu fields, and the idle+iowait portion of it. */
export interface CpuSample {
  total: number
  idle: number
}

export function parseCpuSample(line: string | undefined): CpuSample | null {
  if (!line?.startsWith('cpu ')) return null
  const fields = line.trim().split(/\s+/).slice(1).map(Number)
  if (fields.some(Number.isNaN) || fields.length < 5) return null
  const total = fields.reduce((sum, value) => sum + value, 0)
  // Fields 3 and 4 are idle and iowait; both are "not doing work".
  const idle = (fields[3] ?? 0) + (fields[4] ?? 0)
  return { total, idle }
}

export function parseLoad(line: string | undefined): [number, number, number] {
  const parts = line?.trim().split(/\s+/) ?? []
  return [Number(parts[0] ?? 0), Number(parts[1] ?? 0), Number(parts[2] ?? 0)]
}

export function parseMemory(lines: string[]): MemoryMetric {
  const empty: MemoryMetric = {
    totalBytes: 0, usedBytes: 0, availableBytes: 0, swapTotalBytes: 0, swapUsedBytes: 0,
  }

  for (const line of lines) {
    const fields = line.trim().split(/\s+/)
    const label = fields[0]?.replace(':', '').toLowerCase()

    if (label === 'mem') {
      empty.totalBytes = Number(fields[1] ?? 0)
      empty.usedBytes = Number(fields[2] ?? 0)
      // `available` (7th column) is the honest number — `free` excludes
      // reclaimable page cache, which the kernel will hand back on demand.
      empty.availableBytes = Number(fields[6] ?? fields[3] ?? 0)
    } else if (label === 'swap') {
      empty.swapTotalBytes = Number(fields[1] ?? 0)
      empty.swapUsedBytes = Number(fields[2] ?? 0)
    }
  }
  return empty
}

export function parseDisks(lines: string[]): DiskMetric[] {
  const disks: DiskMetric[] = []
  for (const line of lines) {
    if (/^\s*(Mounted|Filesystem)/i.test(line)) continue
    const fields = line.trim().split(/\s+/)
    if (fields.length < 4) continue
    const [mount, total, used, available] = fields
    if (mount === undefined) continue
    const totalBytes = Number(total)
    if (!Number.isFinite(totalBytes) || totalBytes === 0) continue
    disks.push({
      mount,
      totalBytes,
      usedBytes: Number(used ?? 0),
      availableBytes: Number(available ?? 0),
    })
  }
  return disks
}

export function parseServices(lines: string[]): ServiceStatus[] {
  return lines.map((line) => {
    const [unit = '', state = 'unknown'] = line.trim().split(/\s+/)
    return { unit, state, active: state === 'active' }
  })
}

export function parseSessions(lines: string[]): SessionMetric[] {
  const sessions: SessionMetric[] = []
  for (const line of lines) {
    const fields = line.trim().split(/\s+/)
    if (fields.length < 3) continue
    // `who` puts an optional "(host)" last; everything between tty and it is the date.
    const last = fields[fields.length - 1] ?? ''
    const from = last.startsWith('(') ? last.slice(1, -1) : 'yerel'
    sessions.push({
      user: fields[0] ?? '',
      tty: fields[1] ?? '',
      from,
      since: fields.slice(2, last.startsWith('(') ? -1 : undefined).join(' '),
    })
  }
  return sessions
}

/** Common log format: `IP - - [10/Oct/2024:13:55:36 +0300] "GET ..."` */
const LOG_LINE = /^(\S+) \S+ \S+ \[([^\]]+)\]/
const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

function parseLogTime(stamp: string): number | null {
  const match = /^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})/.exec(stamp)
  if (!match) return null
  const month = MONTHS[match[2] ?? '']
  if (month === undefined) return null
  return Date.UTC(
    Number(match[3]), month, Number(match[1]),
    Number(match[4]), Number(match[5]), Number(match[6]),
  )
}

export function parseNginx(lines: string[], windowMinutes: number, now: number): NginxMetric {
  const cutoff = now - windowMinutes * 60_000
  const ips = new Set<string>()
  let sawOlderThanCutoff = false

  for (const line of lines) {
    const match = LOG_LINE.exec(line)
    if (!match) continue
    const time = parseLogTime(match[2] ?? '')
    // Timestamps carry an offset we ignore; compare with a generous slack so a
    // non-UTC server does not silently report zero.
    if (time !== null && time < cutoff - 12 * 3600_000) {
      sawOlderThanCutoff = true
      continue
    }
    if (time !== null && time < cutoff) {
      sawOlderThanCutoff = true
      continue
    }
    if (match[1] !== undefined) ips.add(match[1])
  }

  return {
    uniqueIps: ips.size,
    windowMinutes,
    // If the oldest line we read is still inside the window, the 20k-line tail
    // did not reach far enough back and the true count is higher.
    partial: !sawOlderThanCutoff && lines.length >= 20_000,
  }
}

export function parsePostgres(lines: string[]): PostgresMetric | undefined {
  const [connections, slow] = lines
  if (connections === undefined || connections.trim() === 'NA') return undefined
  return {
    connections: Number(connections.trim()) || 0,
    slowQueries: slow === undefined || slow.trim() === 'NA' ? 0 : Number(slow.trim()) || 0,
  }
}
