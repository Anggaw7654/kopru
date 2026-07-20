# ADR 0014 — Packaging and what is deliberately unsigned

**Status:** accepted

`npm run dist` produces a universal-ish dmg (arm64 + x64) via electron-builder.

**Hardened runtime is on, notarisation is not configured.** Notarising needs an
Apple Developer ID ($99/yr) and an app-specific password in CI. Without it the
dmg installs and runs on the machine that built it, but Gatekeeper will warn on
any other Mac. That is the honest state: the build is not "broken", it is
unsigned, and the difference matters to whoever is handed the file.

To sign later, set `CSC_LINK` / `CSC_KEY_PASSWORD` and add `notarize` to the mac
block — no code changes.

**Entitlements** are the minimum the app actually uses: JIT (V8 under the
hardened runtime), outbound network (SSH), and user-selected file read/write
(the private key, and upload/download folders). Notably absent is any inbound
network entitlement, because nothing listens — the PostgreSQL tunnel is a
channel handed to the pg client rather than a bound port (ADR 0012).

No native modules are bundled (ADR 0005), so there is nothing to rebuild against
Electron's ABI and no `asarUnpack` is required.
