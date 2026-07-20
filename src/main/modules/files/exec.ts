import { require_ as requireConnection } from '../../ssh/manager.js'

export interface CommandResult {
  code: number
  stdout: string
  stderr: string
}

/** Cap collected output so a runaway command can't exhaust main-process memory. */
const MAX_OUTPUT_BYTES = 1_000_000

/**
 * Run a command on the exec channel and collect its output.
 *
 * `stdin` is written and the stream closed immediately — this is how the sudo
 * password reaches `sudo -S` without ever touching the filesystem or argv
 * (argv is world-readable via /proc).
 */
export function run(profileId: string, command: string, stdin?: string): Promise<CommandResult> {
  const connection = requireConnection(profileId)
  return new Promise((resolve, reject) => {
    connection.exec(command).then((channel) => {
      let stdout = ''
      let stderr = ''
      let code = 0

      channel.on('data', (chunk: Buffer) => {
        if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk.toString('utf8')
      })
      channel.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk.toString('utf8')
      })
      channel.on('exit', (exitCode: number | null) => {
        code = exitCode ?? -1
      })
      channel.on('close', () => {
        resolve({ code, stdout, stderr })
      })
      channel.on('error', (error: Error) => {
        reject(new Error(`Komut çalıştırılamadı: ${error.message}`))
      })

      if (stdin !== undefined) channel.write(stdin)
      channel.end()
    }, reject)
  })
}

/** Run and throw a Turkish error when the command fails. */
export async function runOrThrow(
  profileId: string,
  command: string,
  context: string,
): Promise<string> {
  const result = await run(profileId, command)
  if (result.code !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `çıkış kodu ${String(result.code)}`
    throw new Error(`${context}: ${detail}`)
  }
  return result.stdout
}
