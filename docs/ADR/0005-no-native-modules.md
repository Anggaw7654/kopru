# ADR 0005 — No native modules in the dependency tree

**Status:** accepted

`ssh2`'s optional `cpu-features` addon and the `node-pty` dependency are deliberately
*not* installed/approved.

**Why:** native addons must be rebuilt against Electron's ABI, break on every Electron
major, and turn `npm ci` into a compiler-toolchain requirement on every machine and CI
runner. `ssh2` runs fine on its pure-JS crypto path — `cpu-features` only picks a faster
AES implementation.

`node-pty` is unnecessary because we never spawn a *local* pty: every terminal is a remote
shell channel (ADR 0001).

**Revisit if:** profiling shows the pure-JS cipher path is actually the bottleneck on
large SFTP transfers.
