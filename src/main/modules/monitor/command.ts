import type { MonitorConfig } from '../../../shared/types/metrics.js'
import { shellQuote } from '../files/paths.js'

export const DELIM = '<<<KOPRU:'

/**
 * One command chain per round, not one exec per metric.
 *
 * Each exec is a new SSH channel — open, run, close. Six of those every five
 * seconds is six channel setups per tick per server, and it saturates
 * `MaxSessions` on a busy box. The chain costs one channel and ~5 KB of output.
 *
 * Every block is `|| true`-guarded: a server without `who` or with no swap must
 * still return the other blocks rather than failing the whole round.
 */
export function buildCommand(config: MonitorConfig): string {
  const parts: string[] = [
    `echo "${DELIM}CPU"`,
    'head -n1 /proc/stat',
    'cat /proc/loadavg',
    'nproc',

    `echo "${DELIM}MEM"`,
    'free -b',

    `echo "${DELIM}DISK"`,
    // Local filesystems only: tmpfs and network mounts are noise in a disk-full alert.
    "df -B1 --output=target,size,used,avail -x tmpfs -x devtmpfs -x squashfs -x overlay 2>/dev/null || true",

    `echo "${DELIM}WHO"`,
    'who 2>/dev/null || true',
  ]

  if (config.services.length > 0) {
    parts.push(`echo "${DELIM}SVC"`)
    for (const unit of config.services) {
      // Unit names come from the user's settings; quote them anyway.
      const quoted = shellQuote(unit)
      parts.push(`printf '%s ' ${quoted}; systemctl is-active ${quoted} 2>/dev/null || echo unknown`)
    }
  }

  if (config.nginxLogPath) {
    parts.push(`echo "${DELIM}NGINX"`)
    const log = shellQuote(config.nginxLogPath)
    // Bounded tail: a full scan of a multi-gigabyte access log every 5s would
    // cost more than everything else combined. 20k lines is the budget; the
    // parser reports `partial` when that window did not span the whole period.
    parts.push(`tail -n 20000 ${log} 2>/dev/null || true`)
  }

  if (config.postgres) {
    parts.push(`echo "${DELIM}PG"`)
    parts.push(
      "psql -At -c \"select count(*) from pg_stat_activity\" 2>/dev/null || echo NA",
    )
    parts.push(
      "psql -At -c \"select count(*) from pg_stat_activity where state='active' and now()-query_start > interval '5 seconds'\" 2>/dev/null || echo NA",
    )
  }

  // Cheap (~30 ms) container census for the monitor summary card. `docker
  // stats` is deliberately NOT here: it samples twice internally and takes
  // 1-2 s, which would stall every round (ADR 0011).
  parts.push(`echo "${DELIM}DOCKER"`)
  parts.push(
    "docker ps -a --format '{{.State}}|{{.Status}}' 2>/dev/null || echo KOPRU_NO_DOCKER",
  )

  parts.push(`echo "${DELIM}END"`)
  return parts.join('; ')
}
