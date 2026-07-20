export type DockerAvailability =
  | { ok: true; composeCommand: 'docker compose' | 'docker-compose' | null }
  | { ok: false; reason: 'not-installed' | 'no-permission' | 'daemon-down'; message: string }

export type ContainerHealth = 'healthy' | 'unhealthy' | 'starting' | 'none'

export interface PortMapping {
  hostIp?: string
  hostPort?: number
  containerPort: number
  protocol: string
}

export interface Container {
  id: string
  name: string
  image: string
  /** Raw `docker ps` status line, e.g. "Up 3 days (healthy)". */
  status: string
  running: boolean
  health: ContainerHealth
  ports: PortMapping[]
  createdAt: string
  /** Compose project this belongs to, when labelled. */
  project?: string
}

export interface ContainerStats {
  id: string
  cpuPercent: number
  memoryUsedBytes: number
  memoryLimitBytes: number
  netInputBytes: number
  netOutputBytes: number
}

/** Cheap counts folded into the metric chain; no `docker stats` involved. */
export interface DockerSummary {
  installed: boolean
  running: number
  total: number
  unhealthy: number
}

export interface ComposeProject {
  name: string
  status: string
  /** Absolute path of the compose file, from `docker compose ls`. */
  configFiles: string[]
}

export interface DiskUsageEntry {
  type: string
  total: number
  active: number
  sizeBytes: number
  reclaimableBytes: number
}

export type PruneTarget = 'image' | 'volume' | 'network' | 'container' | 'buildcache'

export interface PrunePreview {
  target: PruneTarget
  reclaimableBytes: number
  /** Names of the items that would go — volumes especially, since they hold data. */
  items: string[]
}

export interface PruneResult {
  target: PruneTarget
  reclaimedBytes: number
}

export interface ContainerActionRequest {
  profileId: string
  id: string
  action: 'start' | 'stop' | 'restart'
}

export interface LogRequest {
  profileId: string
  containerId: string
  tail: number
}

export interface LogChunk {
  containerId: string
  chunk: string
}

export interface ComposeActionRequest {
  profileId: string
  project: string
  action: 'up' | 'down' | 'restart'
}
