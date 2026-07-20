# ADR 0007 — Two SFTP channels per connection

**Status:** accepted

Browsing and transfers each get their own SFTP channel, both multiplexed over
the one SSH connection (ADR 0001 still holds — this is not a second connection).

**Why:** SFTP requests on a channel are serialised. With one channel, a 2 GB
download starves every `readdir` behind it and the file browser looks frozen for
the length of the transfer.

Transfers themselves stay sequential within their lane: parallel transfers over
one SSH connection share the same flow-control window, so they only slow each
other down while making per-file progress numbers meaningless.
