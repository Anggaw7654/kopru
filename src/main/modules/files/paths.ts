/**
 * Single-quote a value for safe interpolation into a POSIX shell command.
 *
 * Filenames on a server are attacker-controlled as far as this app is
 * concerned — shell metacharacters are legal in POSIX filenames. Every path
 * that reaches `exec` goes through here.
 */
export function shellQuote(value: string): string {
  return `'${value.replaceAll(`'`, `'\\''`)}'`
}

/** POSIX-only join; the server is Linux regardless of what the Mac uses. */
export function joinPath(dir: string, name: string): string {
  if (dir === '/') return `/${name}`
  return `${dir.replace(/\/+$/, '')}/${name}`
}

export function parentPath(path: string): string {
  if (path === '/') return '/'
  const trimmed = path.replace(/\/+$/, '')
  const index = trimmed.lastIndexOf('/')
  if (index <= 0) return '/'
  return trimmed.slice(0, index)
}

export function baseName(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  return trimmed.slice(trimmed.lastIndexOf('/') + 1) || '/'
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript',
  tsx: 'typescript', jsx: 'javascript', json: 'json', py: 'python', rb: 'ruby',
  go: 'go', rs: 'rust', java: 'java', php: 'php', sh: 'shell', bash: 'shell',
  zsh: 'shell', yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', cfg: 'ini',
  conf: 'ini', md: 'markdown', html: 'html', htm: 'html', css: 'css',
  scss: 'scss', sql: 'sql', xml: 'xml', dockerfile: 'dockerfile', env: 'shell',
}

const BARE_NAME_LANGUAGE: Record<string, string> = {
  Dockerfile: 'dockerfile', Makefile: 'makefile', '.env': 'shell',
  '.gitignore': 'plaintext', 'nginx.conf': 'ini',
}

export function languageFor(path: string): string {
  const name = baseName(path)
  const bare = BARE_NAME_LANGUAGE[name]
  if (bare) return bare
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return 'plaintext'
  return LANGUAGE_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? 'plaintext'
}

const LOG_EXTENSIONS = new Set(['log', 'out', 'err'])

export function isLogFile(path: string): boolean {
  const name = baseName(path).toLowerCase()
  const dot = name.lastIndexOf('.')
  if (dot > 0 && LOG_EXTENSIONS.has(name.slice(dot + 1))) return true
  return /\.log\.\d+$/.test(name)
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
}

export function imageMimeFor(path: string): string | undefined {
  const name = baseName(path)
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return undefined
  return IMAGE_EXTENSIONS[name.slice(dot + 1).toLowerCase()]
}
