import type { DockerAvailability } from '../../../shared/types/docker.js'
import { run } from '../files/exec.js'
import { m } from '../../i18n.js'

/**
 * Availability is cached per profile: the probe is three commands, and the
 * answer only changes when someone installs Docker or fixes group membership
 * — neither of which happens mid-session without a reconnect.
 */
const cache = new Map<string, DockerAvailability>()

export function forget(profileId: string): void {
  cache.delete(profileId)
}

function classify(stdout: string, stderr: string, code: number): DockerAvailability | null {
  const text = `${stdout}\n${stderr}`.toLowerCase()

  if (code === 127 || text.includes('command not found') || text.includes('not found')) {
    return { ok: false, reason: 'not-installed', message: m('Bu sunucuda Docker kurulu değil.') }
  }
  if (text.includes('permission denied')) {
    return {
      ok: false,
      reason: 'no-permission',
      message:
        'Docker’a erişim yetkiniz yok. Sunucuda şu komut gerekiyor:\n' +
        'sudo usermod -aG docker $USER\n' +
        'Sonra oturumu kapatıp açın.',
    }
  }
  if (text.includes('cannot connect to the docker daemon') || text.includes('is the docker daemon running')) {
    return { ok: false, reason: 'daemon-down', message: m('Docker servisi çalışmıyor.') }
  }
  return null
}

export async function detect(profileId: string): Promise<DockerAvailability> {
  const cached = cache.get(profileId)
  if (cached) return cached

  const probe = await run(profileId, 'docker version --format "{{.Server.Version}}" 2>&1')
  const failure = classify(probe.stdout, probe.stderr, probe.code)
  if (failure) {
    cache.set(profileId, failure)
    return failure
  }
  if (probe.code !== 0) {
    const result: DockerAvailability = {
      ok: false,
      reason: 'daemon-down',
      message: `Docker’a ulaşılamadı: ${probe.stdout.trim() || 'bilinmeyen hata'}`,
    }
    cache.set(profileId, result)
    return result
  }

  // v2 is a docker subcommand; v1 is a separate binary. Neither is guaranteed.
  const v2 = await run(profileId, 'docker compose version >/dev/null 2>&1 && echo yes')
  let composeCommand: 'docker compose' | 'docker-compose' | null = null
  if (v2.stdout.trim() === 'yes') {
    composeCommand = 'docker compose'
  } else {
    const v1 = await run(profileId, 'docker-compose version >/dev/null 2>&1 && echo yes')
    if (v1.stdout.trim() === 'yes') composeCommand = 'docker-compose'
  }

  const result: DockerAvailability = { ok: true, composeCommand }
  cache.set(profileId, result)
  return result
}

/** Throws a Turkish message when Docker is unusable, so callers can stay terse. */
export async function requireDocker(profileId: string): Promise<Extract<DockerAvailability, { ok: true }>> {
  const availability = await detect(profileId)
  if (!availability.ok) throw new Error(availability.message)
  return availability
}
