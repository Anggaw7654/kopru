# ADR 0003 — Host key pinning, trust on first use

**Status:** accepted

On first connect the SHA256 fingerprint (OpenSSH `SHA256:<base64>` form) is shown in a
native dialog. On approval it is pinned in `hostkeys.json`. On later connects a *mismatch
refuses the connection* — no "continue anyway" escape hatch.

**Why no override:** a changed host key is either a server rebuild or an active MITM, and
the user cannot tell which from the dialog. Offering "continue" converts a hard security
boundary into a click-through. Re-keying is handled by deleting the pin deliberately.

The dialog is raised with `dialog.showMessageBox` from **main**, not via a renderer
round-trip: the verifier callback is synchronous-ish inside the handshake, and keeping it
out of the renderer removes a whole class of spoofed-prompt attacks.
