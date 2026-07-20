import type { MetricSnapshot, MonitorConfig } from '../../../shared/types/metrics.js'
import type { Profile } from '../../../shared/types/profile.js'
import { broadcast } from '../../ssh/manager.js'
import { run } from '../files/exec.js'
import { shellQuote } from '../files/paths.js'
import { buildCommand } from './command.js'
import {
  parseCpuSample, parseDisks, parseLoad, parseMemory, parseNginx,
  parsePostgres, parseServices, parseSessions, splitBlocks,
} from './parse.js'
import type { CpuSample } from './parse.js'
import { parseSummary } from '../docker/inspect.js'
import * as alerts from './alerts.js'

/** 15 minutes at the default 5s interval. */
const HISTORY_LIMIT = 180

interface Collector {
  profile: Profile
  timer: NodeJS.Timeout | null
  previousCpu: CpuSample | null
  history: MetricSnapshot[]
  /** Guards against overlap when a round outlives its interval. */
  inFlight: boolean
}

const collectors = new Map<string, Collector>()

export function history(profileId: string): MetricSnapshot[] {
  return collectors.get(profileId)?.history ?? []
}

async function collectOnce(collector: Collector): Promise<void> {
  // A slow server must not queue rounds behind each other; skip instead.
  if (collector.inFlight) return
  collector.inFlight = true

  const { profile } = collector
  const config: MonitorConfig = profile.monitor
  const now = Date.now()

  try {
    const result = await run(profile.id, buildCommand(config))
    const blocks = splitBlocks(result.stdout)

    const cpuLines = blocks.CPU ?? []
    const sample = parseCpuSample(cpuLines[0])
    const [load1, load5, load15] = parseLoad(cpuLines[1])
    const cores = Number(cpuLines[2] ?? 0) || 0

    let percent: number | null = null
    if (sample && collector.previousCpu) {
      const totalDelta = sample.total - collector.previousCpu.total
      const idleDelta = sample.idle - collector.previousCpu.idle
      // A counter reset (reboot) shows as a negative delta; report null rather
      // than a nonsense percentage.
      if (totalDelta > 0 && idleDelta >= 0) {
        percent = Math.min(100, Math.max(0, ((totalDelta - idleDelta) / totalDelta) * 100))
      }
    }
    if (sample) collector.previousCpu = sample

    const snapshot: MetricSnapshot = {
      profileId: profile.id,
      timestamp: now,
      cpu: { percent, cores, load1, load5, load15 },
      memory: parseMemory(blocks.MEM ?? []),
      disks: parseDisks(blocks.DISK ?? []),
      services: parseServices(blocks.SVC ?? []),
      sessions: parseSessions(blocks.WHO ?? []),
    }

    if (config.nginxLogPath && blocks.NGINX) {
      snapshot.nginx = parseNginx(blocks.NGINX, config.nginxWindowMinutes, now)
    }
    if (blocks.DOCKER) {
      snapshot.docker = parseSummary(blocks.DOCKER)
    }
    if (config.postgres && blocks.PG) {
      const pg = parsePostgres(blocks.PG)
      if (pg) snapshot.postgres = pg
    }

    push(collector, snapshot)
    alerts.check(snapshot, config.thresholds, profile.name)
  } catch (error) {
    // A failed round is data too: the panel says "veri bekleniyor" instead of
    // freezing on the last good sample and looking live when it is not.
    push(collector, {
      profileId: profile.id,
      timestamp: now,
      cpu: { percent: null, cores: 0, load1: 0, load5: 0, load15: 0 },
      memory: { totalBytes: 0, usedBytes: 0, availableBytes: 0, swapTotalBytes: 0, swapUsedBytes: 0 },
      disks: [], services: [], sessions: [],
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    collector.inFlight = false
  }
}

function push(collector: Collector, snapshot: MetricSnapshot): void {
  collector.history.push(snapshot)
  if (collector.history.length > HISTORY_LIMIT) collector.history.shift()
  broadcast('monitor:sample', snapshot)
}

/**
 * Collection runs for as long as the profile is connected, whether or not the
 * monitor panel is open — threshold alerts are worthless if they only fire
 * while the user is already looking at the numbers.
 */
export function start(profile: Profile): void {
  stop(profile.id)

  const collector: Collector = {
    profile,
    timer: null,
    previousCpu: null,
    history: collectors.get(profile.id)?.history ?? [],
    inFlight: false,
  }
  collectors.set(profile.id, collector)

  void collectOnce(collector)
  collector.timer = setInterval(() => {
    void collectOnce(collector)
  }, Math.max(2000, profile.monitor.intervalMs))
}

export function stop(profileId: string): void {
  const collector = collectors.get(profileId)
  if (!collector) return
  if (collector.timer) clearInterval(collector.timer)
  collector.timer = null
  // History survives a disconnect so the chart still shows what happened before
  // the drop; the CPU baseline does not, because the counters may have reset.
  collector.previousCpu = null
  alerts.reset(profileId)
}

export function forget(profileId: string): void {
  stop(profileId)
  collectors.delete(profileId)
}

export async function restartService(profileId: string, unit: string): Promise<void> {
  const result = await run(profileId, `systemctl restart ${shellQuote(unit)} 2>&1`)
  if (result.code !== 0) {
    const detail = result.stdout.trim() || result.stderr.trim()
    throw new Error(
      /password|not authorized|access denied/i.test(detail)
        ? `${unit} yeniden başlatılamadı: yetki yok. Sunucuda sudo kuralı gerekiyor.`
        : `${unit} yeniden başlatılamadı: ${detail || 'bilinmeyen hata'}`,
    )
  }
}

export async function listUnits(profileId: string): Promise<string[]> {
  const result = await run(
    profileId,
    "systemctl list-units --type=service --all --no-legend --no-pager --plain 2>/dev/null | awk '{print $1}'",
  )
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.service'))
    .map((line) => line.replace(/\.service$/, ''))
    .sort((a, b) => a.localeCompare(b))
}
