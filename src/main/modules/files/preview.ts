import type { SFTPWrapper } from 'ssh2'
import type { PathRequest, PreviewResult } from '../../../shared/types/files.js'
import { channel } from './sftp.js'
import { stat } from './operations.js'
import { imageMimeFor, isLogFile, languageFor } from './paths.js'

/** Text preview cap: enough for any config file, small enough to stay instant. */
const TEXT_LIMIT_BYTES = 512 * 1024
/** Log tail window. Read from the end, then trimmed to LOG_LINE_LIMIT lines. */
const LOG_TAIL_BYTES = 256 * 1024
const LOG_LINE_LIMIT = 500
/** Images beyond this are not worth base64-ing into the renderer. */
const IMAGE_LIMIT_BYTES = 8 * 1024 * 1024
const S_IFDIR = 0o040000

function readRange(
  sftp: SFTPWrapper,
  path: string,
  offset: number,
  length: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    sftp.open(path, 'r', (openErr, handle) => {
      if (openErr) {
        reject(new Error(`Açılamadı: ${path}`))
        return
      }
      const buffer = Buffer.alloc(length)
      sftp.read(handle, buffer, 0, length, offset, (readErr, bytesRead) => {
        sftp.close(handle, () => {
          /* best effort */
        })
        if (readErr) reject(new Error(`Okunamadı: ${path}`))
        else resolve(buffer.subarray(0, bytesRead))
      })
    })
  })
}

/** Heuristic: a NUL byte in the first block means this isn't text. */
function looksBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, 8192).includes(0)
}

export async function preview(request: PathRequest): Promise<PreviewResult> {
  const sftp = await channel(request.profileId)
  const stats = await stat(sftp, request.path)

  if ((stats.mode & 0o170000) === S_IFDIR) {
    const count = await new Promise<number>((resolve) => {
      sftp.readdir(request.path, (err, list) => {
        resolve(err ? 0 : list.length)
      })
    })
    return { kind: 'directory', entryCount: count }
  }

  const size = stats.size
  const mime = imageMimeFor(request.path)
  if (mime) {
    if (size > IMAGE_LIMIT_BYTES) return { kind: 'too-large', size }
    const data = await readRange(sftp, request.path, 0, size)
    return { kind: 'image', dataUrl: `data:${mime};base64,${data.toString('base64')}`, size }
  }

  if (isLogFile(request.path)) {
    // Read the tail, not the file: an nginx access.log is routinely gigabytes,
    // and the user asked for the last 500 lines.
    const start = Math.max(0, size - LOG_TAIL_BYTES)
    const data = await readRange(sftp, request.path, start, Math.min(size, LOG_TAIL_BYTES))
    let text = data.toString('utf8')
    // A mid-character or mid-line start is near-certain; drop the first partial line.
    if (start > 0) text = text.slice(text.indexOf('\n') + 1)

    const lines = text.split('\n')
    const trimmed = lines.length > LOG_LINE_LIMIT ? lines.slice(-LOG_LINE_LIMIT) : lines
    return {
      kind: 'log',
      content: trimmed.join('\n'),
      lineCount: trimmed.length,
      fromEnd: true,
      // True when the window itself was the limit, not the line count — the UI
      // says "son 256 KB" instead of claiming it showed 500 lines.
      truncatedBytes: start > 0 && lines.length <= LOG_LINE_LIMIT,
    }
  }

  if (size > TEXT_LIMIT_BYTES) {
    const head = await readRange(sftp, request.path, 0, 8192)
    if (looksBinary(head)) return { kind: 'binary', size }
    return { kind: 'too-large', size }
  }

  const data = await readRange(sftp, request.path, 0, size)
  if (looksBinary(data)) return { kind: 'binary', size }

  return {
    kind: 'text',
    content: data.toString('utf8'),
    language: languageFor(request.path),
    truncated: false,
  }
}
