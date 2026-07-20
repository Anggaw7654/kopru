# ADR 0009 — One command chain per metric round, history in main

**Status:** accepted

All metrics are collected by a single shell chain on one exec channel, delimited
by `<<<KOPRU:<BLOCK>` markers and split by the parser.

**Why not one exec per metric:** every `exec` opens a new SSH channel. Six of
them every five seconds per server is six channel setups per tick, and it walks
into the server's `MaxSessions` limit. The chain costs one channel and ~5 KB.

Every block is failure-tolerant (`|| true`): a box without `who`, without swap,
or with no nginx must still return the other blocks.

**CPU needs two samples.** `/proc/stat` is cumulative, so the first round has no
percentage at all. It reports `null`, and the UI shows `—` rather than 0% —
which would be a lie that looks like a healthy server.

**History lives in main**, as a 180-entry ring buffer (15 min at 5 s). In the
renderer it would reset whenever a window closed or the view switched, and a
second window would open to an empty chart.

**Collection runs while connected, not while the panel is visible.** Threshold
alerts that only fire when the user is already looking at the numbers are
pointless. The cost is one command per interval per connected server.
