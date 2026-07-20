# ADR 0001 — One SSH connection, many channels

**Status:** accepted

Every server gets exactly one `ssh2.Client`. Terminal shells, SFTP, metric polling and
(later) Claude's exec calls are all *channels* multiplexed over that single TCP/SSH
connection. Opening a second connection per module is forbidden.

**Why:** each extra connection costs a full TCP + KEX + auth handshake, counts against
`MaxSessions`/`MaxStartups` on the server, and multiplies the reconnect surface. SSH is a
multiplexing protocol — using it as one-connection-per-feature wastes what it is for.

**Cost:** the connection is a single point of failure; a drop takes every module down at
once. Accepted, because that is exactly the state the UI must surface anyway (see ADR 0004).
