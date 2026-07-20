import { Notification } from 'electron'
import type { MetricSnapshot, Thresholds } from '../../../shared/types/metrics.js'

/**
 * Threshold alerting with hysteresis.
 *
 * A disk sitting at 91% would otherwise fire a notification every 5 seconds and
 * make the app unusable. An alert fires once on crossing, and only re-arms when
 * the value drops REARM_MARGIN below the threshold — so a value oscillating
 * around 90.0 does not flap. A cooldown caps repeats even if it does.
 */
const REARM_MARGIN = 5
const COOLDOWN_MS = 15 * 60_000

interface AlertState {
  firing: boolean
  lastFiredAt: number
}

const states = new Map<string, AlertState>()

function evaluate(key: string, value: number, threshold: number, title: string, body: string): void {
  const state = states.get(key) ?? { firing: false, lastFiredAt: 0 }
  const now = Date.now()

  if (value >= threshold) {
    const cooledDown = now - state.lastFiredAt > COOLDOWN_MS
    if (!state.firing || cooledDown) {
      new Notification({ title, body }).show()
      states.set(key, { firing: true, lastFiredAt: now })
      return
    }
    states.set(key, { ...state, firing: true })
    return
  }

  // Re-arm only once the value is clearly back under the line.
  if (state.firing && value < threshold - REARM_MARGIN) {
    states.set(key, { firing: false, lastFiredAt: state.lastFiredAt })
  }
}

export function check(
  snapshot: MetricSnapshot,
  thresholds: Thresholds,
  profileName: string,
): void {
  for (const disk of snapshot.disks) {
    if (disk.totalBytes === 0) continue
    const percent = (disk.usedBytes / disk.totalBytes) * 100
    evaluate(
      `${snapshot.profileId}:disk:${disk.mount}`,
      percent,
      thresholds.diskPercent,
      `${profileName} — disk doluyor`,
      `${disk.mount} %${percent.toFixed(0)} dolu.`,
    )
  }

  const memory = snapshot.memory
  if (memory.totalBytes > 0) {
    // Measured against `available`, not `used`: page cache counts as used but
    // the kernel gives it back on demand, so `used` alerts on healthy servers.
    const percent = ((memory.totalBytes - memory.availableBytes) / memory.totalBytes) * 100
    evaluate(
      `${snapshot.profileId}:mem`,
      percent,
      thresholds.memPercent,
      `${profileName} — bellek doluyor`,
      `Kullanılabilir bellek %${(100 - percent).toFixed(0)} seviyesinde.`,
    )
  }

  const cores = snapshot.cpu.cores
  if (cores > 0) {
    const perCore = snapshot.cpu.load1 / cores
    evaluate(
      `${snapshot.profileId}:load`,
      perCore,
      thresholds.loadPerCore,
      `${profileName} — yük yüksek`,
      `1 dakikalık yük ${snapshot.cpu.load1.toFixed(2)} (${String(cores)} çekirdek).`,
    )
  }
}

export function reset(profileId: string): void {
  for (const key of [...states.keys()]) {
    if (key.startsWith(`${profileId}:`)) states.delete(key)
  }
}
