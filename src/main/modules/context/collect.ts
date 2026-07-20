import type { SystemSummary } from '../../../shared/types/context.js'
import type { Profile } from '../../../shared/types/profile.js'
import { redact } from '../../../shared/redact.js'
import { run } from '../files/exec.js'
import { history } from '../monitor/collector.js'

/**
 * A short, factual picture of the server for the top of a pasted context block.
 *
 * Deliberately excludes: hostname credentials, the SSH key path, the database
 * user and password, and anything from `.env`. Someone reading this block should
 * learn what the server is doing, not how to log into it.
 */
export async function summarise(profile: Profile): Promise<SystemSummary> {
  const summary: SystemSummary = {
    profileName: profile.name,
    // Host is included because "which server is this" is the first question any
    // reader has; the port, username and key path are not.
    host: profile.host,
    osRelease: '—',
    uptime: '—',
  }

  const probe = await run(
    profile.id,
    '. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"; uptime -p 2>/dev/null || uptime',
  ).catch(() => null)

  if (probe) {
    const lines = probe.stdout.split('\n').filter((line) => line.trim() !== '')
    summary.osRelease = lines[0]?.trim() ?? '—'
    summary.uptime = lines[1]?.trim() ?? '—'
  }

  const latest = history(profile.id).at(-1)
  if (latest && latest.error === undefined) {
    const memoryUsed = latest.memory.totalBytes - latest.memory.availableBytes
    const memoryPercent =
      latest.memory.totalBytes > 0 ? (memoryUsed / latest.memory.totalBytes) * 100 : 0
    const disks = latest.disks
      .map((disk) => {
        const percent = disk.totalBytes > 0 ? (disk.usedBytes / disk.totalBytes) * 100 : 0
        return `${disk.mount} %${percent.toFixed(0)}`
      })
      .join(', ')

    summary.metrics = [
      `CPU: ${latest.cpu.percent === null ? 'ölçülmedi' : `%${latest.cpu.percent.toFixed(0)}`}`,
      `yük: ${latest.cpu.load1.toFixed(2)} (${String(latest.cpu.cores)} çekirdek)`,
      `bellek: %${memoryPercent.toFixed(0)} kullanımda`,
      `disk: ${disks || '—'}`,
      `SSH oturumu: ${String(latest.sessions.length)}`,
    ].join(' · ')

    if (latest.docker?.installed === true) {
      summary.docker =
        `${String(latest.docker.running)}/${String(latest.docker.total)} konteyner çalışıyor` +
        (latest.docker.unhealthy > 0
          ? `, ${String(latest.docker.unhealthy)} tanesi sağlıksız`
          : '')
    }

    if (latest.postgres) {
      summary.postgres =
        `${String(latest.postgres.connections)} bağlantı` +
        (latest.postgres.slowQueries > 0
          ? `, ${String(latest.postgres.slowQueries)} yavaş sorgu`
          : '')
    }
  }

  // Cheap insurance: a PRETTY_NAME or uptime line should never carry a secret,
  // but this text is leaving the machine, so it goes through the same filter as
  // everything else.
  summary.osRelease = redact(summary.osRelease).text
  summary.uptime = redact(summary.uptime).text
  return summary
}
