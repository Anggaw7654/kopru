# ADR 0010 — Alert hysteresis and cooldown

**Status:** accepted

A disk parked at 91% would fire a macOS notification every 5 seconds. So:

- An alert fires once when the value crosses the threshold.
- It re-arms only when the value falls **5 points below** the threshold, so a
  metric oscillating around 90.0 does not flap.
- Even while continuously over the line, a repeat is capped at one per 15 min.

Memory is measured against `MemAvailable`, not `used`. `used` counts reclaimable
page cache, so a healthy Linux box that has been up for a week reads as ~95%
"used" and would alert constantly while having plenty of memory to hand out.
