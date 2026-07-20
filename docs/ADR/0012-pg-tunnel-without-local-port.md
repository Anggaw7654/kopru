# ADR 0012 — The database tunnel binds nothing

**Status:** accepted — deviates from the original spec

The spec called for local port forwarding: `localhost:randomPort -> server:5432`,
with a security requirement that it bind only to 127.0.0.1.

`node-postgres` accepts a `stream` factory and speaks the wire protocol over
whatever Duplex it is given. We hand it the ssh2 `direct-tcpip` channel itself.

The result satisfies the requirement more strictly than the design that
prompted it: **no TCP listener exists on the Mac at all**. There is no port for
another local process — or another user account on the machine — to connect to,
and nothing to leave behind if a window crashes.

`pg`'s factory is synchronous, so the channel is opened first and the factory
returns the already-open one.
