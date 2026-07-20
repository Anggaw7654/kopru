# ADR 0013 — Read-only mode is a transaction, not a regex

**Status:** accepted

Every statement runs inside `BEGIN TRANSACTION READ ONLY`. PostgreSQL refuses
writes with SQLSTATE 25006, and it does so for the cases pattern matching cannot
reach:

- a write hidden in a CTE
- a `DO $$ ... $$` block
- a function with side effects called from a `SELECT`
- comment- or case-obfuscated keywords
- a second statement smuggled after a semicolon

The keyword scan still exists, but its job is the **confirmation dialog** — it
tells the user what a statement is about to do and roughly how many rows it
touches. It is deliberately conservative: a false positive costs one click, a
false negative costs data.

Calling that scan the security boundary would be selling a guarantee we cannot
keep. Write mode also resets to off on every panel open and is never persisted;
a panel that remembered it would eventually be left writable by accident.
