# ADR 0014 — Packaging: ASCII bundle name, ad-hoc signature

**Status:** accepted

## The bundle name must be ASCII

`productName` is `Kopru`, not `Köprü`. A packaged build named `Köprü.app` dies
on the browser main thread with SIGTRAP before a single line of JS runs — no
stderr, no exception, just "quit unexpectedly". The same code runs fine
unpackaged, and the same binary runs fine under `ELECTRON_RUN_AS_NODE`, which is
what narrows it to bundle-name handling.

The user-visible name comes from `CFBundleDisplayName` in `extendInfo`, so
Finder and the menu bar still say **Köprü**.

Do **not** also override `CFBundleName`: Electron locates its helper processes
by it, and changing it aborts with `Unable to find helper app`.

## Signing

`mac.identity: "-"` — ad-hoc, done by electron-builder. On Apple Silicon every
binary needs a valid signature, and injecting our files into the bundle
invalidates the one Electron ships with. electron-builder signs the framework,
the helper apps and the outer bundle in the correct inside-out order.

Signing afterwards with `codesign --deep` does **not** work: it produces
mismatched Team IDs between the outer executable and the framework, and dyld
refuses to load it. `--deep` is deprecated by Apple for this reason.

`hardenedRuntime` is off. It only buys anything alongside notarisation, which
needs a paid Developer ID; with an ad-hoc signature it just adds a way to fail
(entitlements get dropped, JIT is blocked, V8 traps).

## What this build is not

Not notarised. It runs on the machine that built it. Copied to another Mac,
Gatekeeper blocks it until right-click → Open. To sign properly later, set
`CSC_LINK` / `CSC_KEY_PASSWORD`, restore `hardenedRuntime: true` with the
entitlements file, and add notarisation — no code changes.

`build/entitlements.mac.plist` is kept for that day.

## Data directory

`userData` is pinned to `<appData>/kopru` in `src/main/index.ts`, before
`app.whenReady()`. Electron otherwise derives it from the app name, which
differs between the dev run and the packaged build — installing the app would
appear to erase every profile, pinned host key and shortcut.
