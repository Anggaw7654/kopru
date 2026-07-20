# ADR 0011 — Docker polls at two rates, for two reasons

**Status:** accepted

`docker ps` costs ~30 ms. `docker stats --no-stream` costs 1–2 seconds: Docker
samples the cgroup counters twice internally and returns the delta. They cannot
share a schedule.

- **Cheap census** (`docker ps -a --format '{{.State}}|{{.Status}}'`) rides along
  in the metric chain every tick, whether or not any panel is open. It feeds the
  monitor summary card and the unhealthy warning.
- **`docker stats`** runs every 10 s and **only while the Docker panel is
  mounted**.

This is a deliberate departure from ADR 0009's "collect while connected". There
the justification was threshold alerting — an alert that only fires while the
user is watching is worthless. Container CPU has no alert attached to it, so
paying 1–2 s of server time every tick for a panel nobody is looking at buys
nothing.

**Follow channels are the leak risk.** `docker logs -f` holds an exec channel
open. It is closed on all three exits — toggle off, container change, panel
close — plus on disconnect, where the handles are dropped because the channels
already died with the connection.
