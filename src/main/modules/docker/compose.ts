import type { ComposeActionRequest, ComposeProject } from '../../../shared/types/docker.js'
import { run } from '../files/exec.js'
import { shellQuote } from '../files/paths.js'
import { requireDocker } from './detect.js'
import { m } from '../../i18n.js'

async function composeBinary(profileId: string): Promise<string> {
  const { composeCommand } = await requireDocker(profileId)
  if (composeCommand === null) {
    throw new Error(m('Bu sunucuda Docker Compose kurulu değil.'))
  }
  return composeCommand
}

export async function projects(profileId: string): Promise<ComposeProject[]> {
  const binary = await composeBinary(profileId)
  const result = await run(profileId, `${binary} ls --all --format json 2>/dev/null`)
  if (result.code !== 0) return []

  try {
    const parsed: unknown = JSON.parse(result.stdout.trim() || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((row: unknown) => {
      const record = row as Record<string, unknown>
      const configFiles = typeof record['ConfigFiles'] === 'string' ? record['ConfigFiles'] : ''
      return {
        name: typeof record['Name'] === 'string' ? record['Name'] : '',
        status: typeof record['Status'] === 'string' ? record['Status'] : '',
        configFiles: configFiles.split(',').map((f) => f.trim()).filter((f) => f !== ''),
      }
    })
  } catch {
    return []
  }
}

export async function action(request: ComposeActionRequest): Promise<void> {
  const binary = await composeBinary(request.profileId)
  const project = shellQuote(request.project)

  // `-p <project>` addresses the project by name, so this works without knowing
  // or being in the compose file's directory.
  const suffix =
    request.action === 'up' ? 'up -d' : request.action === 'down' ? 'down' : 'restart'

  const result = await run(request.profileId, `${binary} -p ${project} ${suffix} 2>&1`)
  if (result.code !== 0) {
    throw new Error(`Compose işlemi başarısız: ${result.stdout.trim() || 'bilinmeyen hata'}`)
  }
}

/**
 * "Apply change": down then up, so a modified compose file is actually re-read.
 * `up -d` alone recreates only containers whose definition Docker notices has
 * changed, which misses edits to volumes and networks.
 */
export async function apply(profileId: string, project: string): Promise<void> {
  await action({ profileId, project, action: 'down' })
  await action({ profileId, project, action: 'up' })
}
