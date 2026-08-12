import type { BackupRequest } from '../../../shared/types/postgres.js'
import type { PostgresConfig } from '../../../shared/types/postgres.js'
import { run } from '../files/exec.js'
import { shellQuote } from '../files/paths.js'
import * as transfers from '../files/transfers.js'
import { m } from '../../i18n.js'

/**
 * pg_dump runs on the server, then the finished file is pulled down through the
 * existing SFTP transfer queue — the user sees one progress bar and can cancel
 * it like any other download.
 *
 * Custom format (-Fc) because it is compressed and restorable selectively.
 * There is no restore path in v1, by decision: an accidental restore is far
 * more destructive than a missing feature.
 */
export async function backup(
  request: BackupRequest,
  config: PostgresConfig,
  destinationDir: string,
): Promise<{ remotePath: string }> {
  const stamp = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const name =
    `${request.database}-${String(stamp.getFullYear())}${pad(stamp.getMonth() + 1)}` +
    `${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.dump`
  const remotePath = `/tmp/${name}`

  // The password goes in via PGPASSWORD on the command's own environment rather
  // than argv, which is world-readable through /proc.
  const command =
    `pg_dump -Fc -h ${shellQuote(config.host)} -p ${String(config.port)} ` +
    `-U ${shellQuote(config.user)} -d ${shellQuote(request.database)} ` +
    `-f ${shellQuote(remotePath)} 2>&1`

  const result = await run(request.profileId, command)
  if (result.code !== 0) {
    const detail = result.stdout.trim() || result.stderr.trim()
    if (/command not found/i.test(detail)) {
      throw new Error(m('Sunucuda pg_dump kurulu değil (postgresql-client paketi gerekiyor).'))
    }
    if (/authentication failed|no pg_hba/i.test(detail)) {
      throw new Error(
        'pg_dump kimlik doğrulaması başarısız. Sunucuda bu kullanıcı için ' +
          '.pgpass ya da peer kimlik doğrulaması gerekiyor.',
      )
    }
    throw new Error(`Yedek alınamadı: ${detail || 'bilinmeyen hata'}`)
  }

  await transfers.download(request.profileId, [remotePath], destinationDir)
  return { remotePath }
}
