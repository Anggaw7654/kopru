import type {
  ContainerActionRequest, PrunePreview, PruneResult, PruneTarget,
} from '../../../shared/types/docker.js'
import { run } from '../files/exec.js'
import { shellQuote } from '../files/paths.js'
import { requireDocker } from './detect.js'
import { diskUsage } from './inspect.js'

const ACTION_LABEL: Record<ContainerActionRequest['action'], string> = {
  start: 'başlatılamadı',
  stop: 'durdurulamadı',
  restart: 'yeniden başlatılamadı',
}

export async function containerAction(request: ContainerActionRequest): Promise<void> {
  await requireDocker(request.profileId)
  const result = await run(
    request.profileId,
    `docker ${request.action} ${shellQuote(request.id)} 2>&1`,
  )
  if (result.code !== 0) {
    throw new Error(
      `Konteyner ${ACTION_LABEL[request.action]}: ${result.stdout.trim() || 'bilinmeyen hata'}`,
    )
  }
}

const DF_TYPE: Record<PruneTarget, string> = {
  image: 'Images',
  container: 'Containers',
  volume: 'Local Volumes',
  network: 'Networks',
  buildcache: 'Build Cache',
}

const PRUNE_COMMAND: Record<PruneTarget, string> = {
  image: 'docker image prune -f',
  container: 'docker container prune -f',
  volume: 'docker volume prune -f',
  network: 'docker network prune -f',
  buildcache: 'docker builder prune -f',
}

/** Lists what a prune would remove, so the confirmation can be specific. */
const LIST_COMMAND: Partial<Record<PruneTarget, string>> = {
  // Dangling images only — that is what `image prune` without -a removes.
  image: "docker images -f dangling=true --format '{{.Repository}}:{{.Tag}} ({{.ID}})'",
  // Volumes hold data. Naming them is the difference between an informed
  // confirmation and a click-through that destroys a database.
  volume: "docker volume ls -qf dangling=true",
  network: "docker network ls --filter type=custom --format '{{.Name}}'",
  container: "docker ps -a -f status=exited -f status=created --format '{{.Names}}'",
}

export async function prunePreview(profileId: string, target: PruneTarget): Promise<PrunePreview> {
  await requireDocker(profileId)

  const usage = await diskUsage(profileId)
  const entry = usage.find((row) => row.type === DF_TYPE[target])

  let items: string[] = []
  const listCommand = LIST_COMMAND[target]
  if (listCommand) {
    const result = await run(profileId, listCommand)
    items = result.stdout.split('\n').map((line) => line.trim()).filter((line) => line !== '')
  }

  return {
    target,
    reclaimableBytes: entry?.reclaimableBytes ?? 0,
    items,
  }
}

export async function prune(profileId: string, target: PruneTarget): Promise<PruneResult> {
  await requireDocker(profileId)
  const result = await run(profileId, `${PRUNE_COMMAND[target]} 2>&1`)
  if (result.code !== 0) {
    throw new Error(`Temizlik başarısız: ${result.stdout.trim() || 'bilinmeyen hata'}`)
  }

  // "Total reclaimed space: 4.2GB"
  const match = /Total reclaimed space:\s*([\d.]+)\s*([KMGT]?i?B)/i.exec(result.stdout)
  let reclaimedBytes = 0
  if (match) {
    const scale: Record<string, number> = {
      B: 1, KB: 1000, MB: 1000 ** 2, GB: 1000 ** 3, TB: 1000 ** 4,
      KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3, TIB: 1024 ** 4,
    }
    reclaimedBytes = Number(match[1]) * (scale[(match[2] ?? 'B').toUpperCase()] ?? 1)
  }
  return { target, reclaimedBytes }
}
