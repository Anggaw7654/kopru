# ADR 0008 — `sudo cp`, not `sudo mv`, for privileged saves

**Status:** accepted — deviates from the original spec

The spec called for "write to a temp file + `sudo mv`". We use `sudo cp` instead.

**Why:** `mv` replaces the target inode. The file then carries the *temp file's*
owner and mode — typically `<login user>:<group>` and `0600`. For exactly the
files that need sudo to write (`/etc/nginx/nginx.conf`, systemd units, anything
a daemon reads as another user) that silently breaks the service on next reload,
and the breakage shows up long after the save.

`cp` writes through into the existing inode, so owner, group, mode and ACLs
survive.

The password is read with an AppleScript dialog (`with hidden answer` — Electron
has no native text input), passed on **stdin** to `sudo -S`, and never written to
argv (world-readable via `/proc`), a file, or a log. The temp file is removed in
a `finally` whether the write succeeded or not.
