import type {
  ArchiveRequest,
  ChmodRequest,
  CopyRequest,
  DeleteRequest,
  ExtractRequest,
} from '../../../shared/types/files.js'
import { runOrThrow } from './exec.js'
import { baseName, shellQuote } from './paths.js'
import { m } from '../../i18n.js'

/**
 * Operations SFTP cannot express, run over the exec channel.
 *
 * Every interpolated path goes through shellQuote — a filename is remote data,
 * and POSIX permits shell metacharacters in filenames.
 */

export async function copy(request: CopyRequest): Promise<void> {
  if (request.sources.length === 0) return
  // Server-side copy: downloading and re-uploading would push the bytes across
  // the network twice for something the server can do locally.
  const sources = request.sources.map(shellQuote).join(' ')
  await runOrThrow(
    request.profileId,
    `cp -a -- ${sources} ${shellQuote(request.destinationDir)}`,
    'Kopyalanamadı',
  )
}

export async function remove(request: DeleteRequest): Promise<void> {
  if (request.paths.length === 0) return
  const paths = request.paths.map(shellQuote).join(' ')
  // `--` stops a filename that begins with a dash being read as a flag.
  await runOrThrow(request.profileId, `rm -rf -- ${paths}`, 'Silinemedi')
}

export async function chmodRecursive(request: ChmodRequest): Promise<void> {
  const mode = request.mode.toString(8).padStart(4, '0')
  await runOrThrow(
    request.profileId,
    `chmod -R ${mode} -- ${shellQuote(request.path)}`,
    'İzinler değiştirilemedi',
  )
}

export async function compress(request: ArchiveRequest): Promise<void> {
  if (request.sources.length === 0) throw new Error(m('Sıkıştırılacak öğe seçilmedi.'))

  // tar -C <parent> <names> keeps the archive free of absolute paths, so
  // extracting it elsewhere doesn't recreate /home/user/... inside the target.
  const parent = request.sources[0]?.replace(/\/[^/]+\/?$/, '') || '/'
  const names = request.sources.map((p) => shellQuote(baseName(p))).join(' ')
  const archive = shellQuote(request.archivePath)

  const flags = request.archivePath.endsWith('.tar') ? '-cf' : '-czf'
  await runOrThrow(
    request.profileId,
    `tar ${flags} ${archive} -C ${shellQuote(parent)} -- ${names}`,
    'Sıkıştırılamadı',
  )
}

export async function extract(request: ExtractRequest): Promise<void> {
  const archive = shellQuote(request.archivePath)
  const target = shellQuote(request.destinationDir)
  const lower = request.archivePath.toLowerCase()

  let command: string
  if (lower.endsWith('.zip')) {
    command = `unzip -o ${archive} -d ${target}`
  } else if (/\.(tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz|txz|tar)$/.test(lower)) {
    // -a picks the decompressor from the extension.
    command = `tar -xaf ${archive} -C ${target}`
  } else {
    throw new Error(m('Desteklenmeyen arşiv biçimi. .zip, .tar, .tar.gz, .tar.bz2, .tar.xz açılabilir.'))
  }

  await runOrThrow(request.profileId, command, 'Arşiv açılamadı')
}
