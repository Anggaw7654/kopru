import type {
  Container, ContainerHealth, ContainerStats, DiskUsageEntry,
  DockerSummary, PortMapping,
} from '../../../shared/types/docker.js'
import { run } from '../files/exec.js'
import { requireDocker } from './detect.js'

/** `docker ... --format '{{json .}}'` emits one JSON object per line. */
function parseJsonLines(stdout: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || !trimmed.startsWith('{')) continue
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (typeof parsed === 'object' && parsed !== null) rows.push(parsed as Record<string, unknown>)
    } catch {
      // A malformed line must not lose the rest of the list.
    }
  }
  return rows
}

function str(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

function healthOf(status: string): ContainerHealth {
  if (status.includes('(unhealthy)')) return 'unhealthy'
  if (status.includes('(healthy)')) return 'healthy'
  if (status.includes('(health: starting)')) return 'starting'
  return 'none'
}

/** "0.0.0.0:8080->80/tcp, :::8080->80/tcp" */
function parsePorts(raw: string): PortMapping[] {
  const ports: PortMapping[] = []
  const seen = new Set<string>()

  for (const part of raw.split(',')) {
    const text = part.trim()
    if (text === '') continue

    const mapped = /^(?:(.+):(\d+)->)?(\d+)\/(\w+)$/.exec(text)
    if (!mapped) continue

    const containerPort = Number(mapped[3])
    const protocol = mapped[4] ?? 'tcp'
    // Docker lists IPv4 and IPv6 bindings separately; the user sees one port.
    const key = `${mapped[2] ?? ''}:${String(containerPort)}/${protocol}`
    if (seen.has(key)) continue
    seen.add(key)

    const mapping: PortMapping = { containerPort, protocol }
    if (mapped[1] !== undefined) mapping.hostIp = mapped[1]
    if (mapped[2] !== undefined) mapping.hostPort = Number(mapped[2])
    ports.push(mapping)
  }
  return ports
}

export async function containers(profileId: string): Promise<Container[]> {
  await requireDocker(profileId)
  const result = await run(profileId, "docker ps -a --format '{{json .}}'")
  if (result.code !== 0) {
    throw new Error(`Konteyner listesi alınamadı: ${result.stderr.trim() || 'bilinmeyen hata'}`)
  }

  return parseJsonLines(result.stdout).map((row) => {
    const status = str(row, 'Status')
    const project = str(row, 'Labels')
      .split(',')
      .find((label) => label.startsWith('com.docker.compose.project='))
      ?.split('=')[1]

    const container: Container = {
      id: str(row, 'ID'),
      name: str(row, 'Names'),
      image: str(row, 'Image'),
      status,
      running: str(row, 'State') === 'running' || status.startsWith('Up'),
      health: healthOf(status),
      ports: parsePorts(str(row, 'Ports')),
      createdAt: str(row, 'CreatedAt'),
    }
    if (project !== undefined && project !== '') container.project = project
    return container
  })
}

/** Human sizes from docker stats: "1.234GiB", "512MiB", "0B". */
function parseSize(value: string): number {
  const match = /^([\d.]+)\s*([KMGT]?i?B)?$/i.exec(value.trim())
  if (!match) return 0
  const amount = Number(match[1])
  const unit = (match[2] ?? 'B').toUpperCase()
  const scale: Record<string, number> = {
    B: 1,
    KB: 1000, MB: 1000 ** 2, GB: 1000 ** 3, TB: 1000 ** 4,
    KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3, TIB: 1024 ** 4,
  }
  return amount * (scale[unit] ?? 1)
}

function parsePair(value: string): [number, number] {
  const [left, right] = value.split('/')
  return [parseSize(left ?? '0'), parseSize(right ?? '0')]
}

/**
 * Expensive: `docker stats --no-stream` samples twice internally and takes
 * 1-2 seconds. Only called while the panel is open (ADR 0011).
 */
export async function stats(profileId: string): Promise<ContainerStats[]> {
  await requireDocker(profileId)
  const result = await run(profileId, "docker stats --no-stream --format '{{json .}}'")
  if (result.code !== 0) return []

  return parseJsonLines(result.stdout).map((row) => {
    const [memoryUsedBytes, memoryLimitBytes] = parsePair(str(row, 'MemUsage'))
    const [netInputBytes, netOutputBytes] = parsePair(str(row, 'NetIO'))
    return {
      id: str(row, 'ID'),
      cpuPercent: Number(str(row, 'CPUPerc').replace('%', '')) || 0,
      memoryUsedBytes,
      memoryLimitBytes,
      netInputBytes,
      netOutputBytes,
    }
  })
}

export async function diskUsage(profileId: string): Promise<DiskUsageEntry[]> {
  await requireDocker(profileId)
  const result = await run(profileId, "docker system df --format '{{json .}}'")
  if (result.code !== 0) return []

  return parseJsonLines(result.stdout).map((row) => ({
    type: str(row, 'Type'),
    total: Number(str(row, 'TotalCount')) || 0,
    active: Number(str(row, 'Active')) || 0,
    sizeBytes: parseSize(str(row, 'Size')),
    // "4.2GB (85%)" — take the size, drop the percentage.
    reclaimableBytes: parseSize(str(row, 'Reclaimable').split(' ')[0] ?? '0'),
  }))
}

/**
 * The cheap counts that ride along with the metric chain. Parses the output of
 * `docker ps -a --format '{{.State}}|{{.Status}}'`, which costs ~30 ms — unlike
 * `docker stats`, this is safe to run every tick.
 */
export function parseSummary(lines: string[]): DockerSummary {
  if (lines.length === 1 && lines[0]?.startsWith('KOPRU_NO_DOCKER')) {
    return { installed: false, running: 0, total: 0, unhealthy: 0 }
  }
  let running = 0
  let unhealthy = 0
  let total = 0
  for (const line of lines) {
    if (line.trim() === '') continue
    total += 1
    const [state = '', status = ''] = line.split('|')
    if (state === 'running') running += 1
    if (status.includes('(unhealthy)')) unhealthy += 1
  }
  return { installed: true, running, total, unhealthy }
}
