/**
 * Secret redaction for anything leaving the app as context.
 *
 * This runs on text the user is about to hand to an outside service. It is
 * deliberately over-eager: a redacted line the user actually needed costs them
 * one manual paste, while a leaked key costs them the server. Every hit is
 * counted and labelled so the UI can show what was removed rather than
 * silently editing the user's data.
 */

export interface Redaction {
  kind: string
  count: number
}

export interface RedactResult {
  text: string
  redactions: Redaction[]
  /** Total hits; 0 means the text went through untouched. */
  total: number
}

const MASK = '«KÖPRÜ: gizlendi»'

interface Rule {
  kind: string
  pattern: RegExp
  replace: (match: string, ...groups: string[]) => string
}

const RULES: Rule[] = [
  {
    // Whole PEM block, not just the header — the key material is the payload.
    kind: 'özel anahtar',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replace: () => `-----BEGIN PRIVATE KEY-----\n${MASK}\n-----END PRIVATE KEY-----`,
  },
  {
    // KEY=value / KEY: value where the name reads like a credential. Captures
    // the assignment so the variable name survives — knowing DB_PASSWORD exists
    // is useful context; its value is not.
    kind: 'kimlik bilgisi ataması',
    pattern:
      /^([ \t]*(?:export[ \t]+)?[A-Za-z0-9_.-]*(?:PASS|PWD|SECRET|TOKEN|APIKEY|API_KEY|PRIVATE|CREDENTIAL|AUTH)[A-Za-z0-9_.-]*)([ \t]*[:=][ \t]*)(.+)$/gim,
    replace: (_match, name: string, sep: string) => `${name}${sep}${MASK}`,
  },
  {
    kind: 'bağlantı dizesindeki parola',
    pattern: /\b([a-z][a-z0-9+.-]*:\/\/)([^\s:/@]+):([^\s@]+)@/gi,
    replace: (_match, scheme: string, user: string) => `${scheme}${user}:${MASK}@`,
  },
  {
    kind: 'yetkilendirme başlığı',
    pattern: /\b(Authorization\s*:\s*(?:Bearer|Basic|Token)\s+)\S+/gi,
    replace: (_match, prefix: string) => `${prefix}${MASK}`,
  },
  {
    kind: 'AWS anahtarı',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replace: () => MASK,
  },
  {
    kind: 'Anthropic/OpenAI anahtarı',
    pattern: /\bsk-[A-Za-z0-9_-]{20,}/g,
    replace: () => MASK,
  },
  {
    // psql/mysql style flags where the value follows on the same line.
    kind: 'komut satırı parolası',
    pattern: /(--password[= ]|-p(?=\S)|PGPASSWORD=)(\S+)/g,
    replace: (_match, flag: string) => `${flag}${MASK}`,
  },
]

/** Files whose entire contents are secret regardless of shape. */
const SECRET_FILE = /(^|\/)(\.env(\.[\w-]+)?|id_[a-z0-9]+|\.pgpass|\.netrc|credentials|\.htpasswd)$/i

export function isSecretFile(path: string): boolean {
  return SECRET_FILE.test(path)
}

export function redact(text: string, sourcePath?: string): RedactResult {
  // A .env is secret by definition; matching individual lines would leak the
  // ones that do not happen to be named PASSWORD.
  if (sourcePath !== undefined && isSecretFile(sourcePath)) {
    const lines = text.split('\n').filter((line) => line.trim() !== '').length
    return {
      text: `${MASK}\n(bu dosyanın tamamı gizli kabul edildi — ${String(lines)} satır gönderilmedi)`,
      redactions: [{ kind: 'gizli dosya', count: 1 }],
      total: 1,
    }
  }

  let output = text
  const redactions: Redaction[] = []

  for (const rule of RULES) {
    let count = 0
    output = output.replace(rule.pattern, (...args: unknown[]) => {
      count += 1
      const match = args[0] as string
      const groups = args.slice(1, -2) as string[]
      return rule.replace(match, ...groups)
    })
    if (count > 0) redactions.push({ kind: rule.kind, count })
  }

  return {
    text: output,
    redactions,
    total: redactions.reduce((sum, entry) => sum + entry.count, 0),
  }
}
