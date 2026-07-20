export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit] ?? 'B'}`
}

/** Project standard: GG.AA.YYYY SS:DD:SS */
export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** Render 0o754 as "rwxr-xr--". */
export function formatMode(mode: number): string {
  const bits = 'rwxrwxrwx'
  let out = ''
  for (let i = 0; i < 9; i += 1) {
    out += (mode & (1 << (8 - i))) === 0 ? '-' : (bits[i] ?? '-')
  }
  return out
}
