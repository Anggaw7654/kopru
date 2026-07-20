# ADR 0004 — Reconnect behaviour, and what "session survival" actually means

**Status:** accepted

Auto-reconnect uses exponential backoff (1s → 2s → 4s → … capped at 30s) with jitter.

**The honest limitation:** an SSH shell session is a server-side process bound to the TCP
connection. When the connection drops, the remote pty and everything running in it are
gone. No client-side code can revive them.

So Phase 1 does *not* claim session continuity. It preserves the **tab**: scrollback stays
in the UI, and on reconnect a fresh pty is attached and the tab is marked
"oturum yenilendi". Real continuity needs a server-side multiplexer (tmux) or a
protocol that survives IP change (mosh) — deferred to Phase 7 as opt-in.
