# ADR 0002 — Single typed IPC contract

**Status:** accepted

All channel names and their request/response types live in `src/shared/ipc.ts` and nowhere
else. Three separate maps:

- `IpcInvokeMap` — request/response (`ipcRenderer.invoke`)
- `IpcSendMap` — renderer → main, fire-and-forget
- `IpcEventMap` — main → renderer push

**Why the split:** terminal output arrives at up to 60fps. Routing it through `invoke`
pays a promise round-trip per chunk and stalls the renderer. High-frequency streams use
`webContents.send` + `ipcRenderer.on` one-way.

`any` is banned in this file; an untyped channel is an untyped process boundary.
