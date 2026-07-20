# ADR 0006 — Pinned to TypeScript 5.9, not 7.x

**Status:** accepted

TypeScript 7 (the Go-based compiler) installs cleanly but `typescript-eslint` declares
`typescript@>=4.8.4 <6.1.0` and refuses to resolve against it.

typescript-eslint's type-aware rules are what actually enforce this project's `no any` and
`no floating promises` rules — without them those rules are documentation, not
enforcement. Losing the linter is a worse trade than losing compiler speed, so the
toolchain is pinned to the 5.9 line.

**Revisit when:** typescript-eslint ships TS 7 support.
