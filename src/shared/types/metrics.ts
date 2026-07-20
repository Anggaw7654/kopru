export interface Thresholds {
  /** Percent full at which the disk alert fires. */
  diskPercent: number
  memPercent: number
  /** Load average per CPU core; 1.0 means "fully saturated". */
  loadPerCore: number
}

export interface MonitorConfig {
  intervalMs: number
  /** systemd units the user chose to watch. */
  services: string[]
  nginxLogPath?: string
  nginxWindowMinutes: number
  postgres: boolean
  thresholds: Thresholds
}

export const DEFAULT_MONITOR: MonitorConfig = {
  intervalMs: 5000,
  services: [],
  nginxWindowMinutes: 5,
  postgres: false,
  thresholds: { diskPercent: 90, memPercent: 90, loadPerCore: 1.0 },
}

export interface MemoryMetric {
  totalBytes: number
  usedBytes: number
  /** Excludes buffers/cache — this is what "memory pressure" actually means. */
  availableBytes: number
  swapTotalBytes: number
  swapUsedBytes: number
}

export interface CpuMetric {
  /**
   * Percent busy across all cores, 0-100. Null on the first sample: /proc/stat
   * is cumulative, so a percentage needs two readings to exist at all.
   */
  percent: number | null
  cores: number
  load1: number
  load5: number
  load15: number
}

export interface DiskMetric {
  mount: string
  totalBytes: number
  usedBytes: number
  availableBytes: number
}

export interface ServiceStatus {
  unit: string
  /** systemctl is-active output: active, inactive, failed, activating, unknown… */
  state: string
  active: boolean
}

export interface SessionMetric {
  user: string
  tty: string
  from: string
  since: string
}

export interface NginxMetric {
  uniqueIps: number
  windowMinutes: number
  /**
   * True when the scanned tail did not reach back to the start of the window,
   * so the real count is higher. The UI says "en az N" rather than lying.
   */
  partial: boolean
}

export interface PostgresMetric {
  connections: number
  /** Queries running longer than 5s right now. */
  slowQueries: number
}

export interface MetricSnapshot {
  profileId: string
  /** Unix epoch milliseconds. */
  timestamp: number
  cpu: CpuMetric
  memory: MemoryMetric
  disks: DiskMetric[]
  services: ServiceStatus[]
  sessions: SessionMetric[]
  nginx?: NginxMetric
  postgres?: PostgresMetric
  /** Set when a collection round failed; the UI shows "veri bekleniyor". */
  error?: string
}

export interface MonitorHistory {
  profileId: string
  snapshots: MetricSnapshot[]
}

export interface RestartServiceRequest {
  profileId: string
  unit: string
}
