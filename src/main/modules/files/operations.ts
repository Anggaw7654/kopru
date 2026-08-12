import type { FileEntryWithStats, SFTPWrapper, Stats } from 'ssh2'
import type {
  ChmodRequest,
  DirEntry,
  EntryKind,
  ListRequest,
  ListResult,
  PathRequest,
  RenameRequest,
} from '../../../shared/types/files.js'
import { channel } from './sftp.js'
import { joinPath } from './paths.js'
import { m } from '../../i18n.js'

/** POSIX file-type bits, masked out of st_mode. */
const S_IFMT = 0o170000
const S_IFDIR = 0o040000
const S_IFLNK = 0o120000
const S_IFREG = 0o100000

function kindOf(mode: number): EntryKind {
  switch (mode & S_IFMT) {
    case S_IFDIR:
      return 'directory'
    case S_IFLNK:
      return 'symlink'
    case S_IFREG:
      return 'file'
    default:
      return 'other'
  }
}

function toEntry(dir: string, name: string, stats: Stats): DirEntry {
  const mode = stats.mode
  return {
    name,
    path: joinPath(dir, name),
    kind: kindOf(mode),
    size: stats.size,
    // SFTP reports seconds; the rest of the app works in milliseconds.
    modified: stats.mtime * 1000,
    mode: mode & 0o7777,
    owner: stats.uid,
    group: stats.gid,
  }
}

/** SFTP status codes; ssh2 puts the numeric protocol code on `code`. */
const SSH_FX_NO_SUCH_FILE = 2
const SSH_FX_PERMISSION_DENIED = 3
const SSH_FX_FAILURE = 4

function describe(error: Error & { code?: number | string }, path: string): Error {
  const code = error.code
  if (code === SSH_FX_NO_SUCH_FILE || error.message.includes('No such file')) {
    return new Error(`Bulunamadı: ${path}`)
  }
  if (code === SSH_FX_PERMISSION_DENIED || error.message.includes('Permission denied')) {
    return new Error(`İzin yok: ${path}`)
  }
  if (code === SSH_FX_FAILURE && error.message.includes('Failure')) {
    return new Error(`İşlem başarısız: ${path} (dolu bir klasör veya kilitli bir dosya olabilir)`)
  }
  return new Error(`${path}: ${error.message}`)
}

function readdir(sftp: SFTPWrapper, path: string): Promise<FileEntryWithStats[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(path, (err, list) => {
      if (err) reject(describe(err, path))
      else resolve(list)
    })
  })
}

export function stat(sftp: SFTPWrapper, path: string): Promise<Stats> {
  return new Promise((resolve, reject) => {
    sftp.stat(path, (err, stats) => {
      if (err) reject(describe(err, path))
      else resolve(stats)
    })
  })
}

export async function list(request: ListRequest): Promise<ListResult> {
  const sftp = await channel(request.profileId)
  const raw = await readdir(sftp, request.path)

  const entries: DirEntry[] = []
  for (const item of raw) {
    if (!request.showHidden && item.filename.startsWith('.')) continue
    const entry = toEntry(request.path, item.filename, item.attrs)

    // readdir uses lstat semantics, so a symlink reports as a link with the
    // link's own size. Resolve it so the UI can show "folder" for a symlinked
    // folder, which is what the user means by it.
    if (entry.kind === 'symlink') {
      try {
        const target = await stat(sftp, entry.path)
        entry.kind = kindOf(target.mode)
        entry.size = target.size
      } catch {
        // Broken link: leave it as 'symlink' rather than hiding it.
      }
    }
    entries.push(entry)
  }

  entries.sort((a, b) => {
    if (a.kind === 'directory' && b.kind !== 'directory') return -1
    if (a.kind !== 'directory' && b.kind === 'directory') return 1
    return a.name.localeCompare(b.name, 'tr')
  })

  return { path: request.path, entries }
}

export async function home(profileId: string): Promise<string> {
  const sftp = await channel(profileId)
  return new Promise((resolve, reject) => {
    sftp.realpath('.', (err, path) => {
      if (err) reject(new Error(`Ana dizin belirlenemedi: ${err.message}`))
      else resolve(path)
    })
  })
}

export async function mkdir(request: PathRequest): Promise<void> {
  const sftp = await channel(request.profileId)
  await new Promise<void>((resolve, reject) => {
    sftp.mkdir(request.path, (err) => {
      if (err) reject(describe(err, request.path))
      else resolve()
    })
  })
}

export async function rename(request: RenameRequest): Promise<void> {
  const sftp = await channel(request.profileId)

  // SFTP rename fails if the target exists; check first so the user gets a
  // clear message instead of a bare "Failure".
  const exists = await stat(sftp, request.to).then(
    () => true,
    () => false,
  )
  if (exists) throw new Error(`Bu adda bir öğe zaten var: ${request.to}`)

  await new Promise<void>((resolve, reject) => {
    sftp.rename(request.from, request.to, (err) => {
      if (err) reject(describe(err, request.from))
      else resolve()
    })
  })
}

export async function chmod(request: ChmodRequest): Promise<void> {
  if (request.recursive) {
    // Handled by shell-ops; SFTP has no recursive chmod.
    throw new Error(m('Özyinelemeli izin değişikliği kabuk üzerinden yapılır.'))
  }
  const sftp = await channel(request.profileId)
  await new Promise<void>((resolve, reject) => {
    sftp.chmod(request.path, request.mode, (err) => {
      if (err) reject(describe(err, request.path))
      else resolve()
    })
  })
}
