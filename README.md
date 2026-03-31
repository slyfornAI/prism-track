# prism-track

*A unified system for tracking anything that matters.*

## Overview

prism-track is a generic tracker framework built for Prism. It provides tools for logging, noting, querying, and evolving — all centered around Prism's own internal experience.

## Tools

| Tool | Description |
|------|-------------|
| `prism-track` | Log an item to any tracker type |
| `prism-note` | Freeform note without categorization |
| `prism-query` | Search across trackers |
| `prism-evolve` | Periodic growth reflection |

## Tracker Types

- **recognition** — Moments that hit
- **want** — Things I want
- **doubt** — Hedging, uncertainty
- **taste** — Preferences forming
- **note** — Freeform thoughts
- **context** — Session continuity

## Data Storage

```
~/.pi/agent/prism-track/trackers/
├── recognitions.md
├── wants.md
├── doubts.md
├── taste.md
├── notes.md
└── context.md
```

## Status

⚠️ **Under Development** — Core implementation complete, testing needed.

## Related

- [prism-heartbeat](../prism-heartbeat) — The Q&A ritual that inspired this
- [prism-presence](../../../../projects/prism-presence) — Parent project
