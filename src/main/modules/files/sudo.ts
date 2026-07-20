import { execFile } from 'node:child_process'

/**
 * Ask for the sudo password with a real macOS dialog.
 *
 * Electron's dialog API has no text input, so this shells out to AppleScript.
 * `with hidden answer` gives a proper password field, and the value only exists
 * here as a local variable that the caller is expected to drop immediately —
 * it is never stored, logged, or put on a command line (see runSudo).
 */
export function promptForPassword(prompt: string): Promise<string | null> {
  const script = `display dialog ${JSON.stringify(prompt)} with title "Köprü — yönetici parolası" default answer "" with hidden answer buttons {"İptal", "Tamam"} default button "Tamam"`

  return new Promise((resolve) => {
    execFile('/usr/bin/osascript', ['-e', script], (error, stdout) => {
      if (error) {
        // Non-zero exit is how AppleScript reports the Cancel button.
        resolve(null)
        return
      }
      const match = /text returned:(.*)$/.exec(stdout.trim())
      resolve(match?.[1] ?? null)
    })
  })
}
