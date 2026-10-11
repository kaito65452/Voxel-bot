# Voxel AI -> 9Router -> OpenCode

## Environment
Set these on the Voxel server:

```bash
export NINE_ROUTER_URL="https://voxelbot.sairistore.web.id/v1"
export NINE_ROUTER_KEY="YOUR_9ROUTER_KEY"
export OPENCODE_MODEL="oc/muse-spark-1.3-contributor-free"
```

Do NOT put `NINE_ROUTER_KEY` in GitHub or source code.

## Models
- `oc/muse-spark-1.2-contributor-free`
- `oc/muse-spark-1.3-contributor-free`
- `oc/union-alpha`
- `oc/mimo-v2.5-free`

Aliases:
- `spark12`
- `spark13`
- `union`
- `mimo`

Example:
`.ai model spark13`

Then:
`.ai jelaskan promise JavaScript`

## Memory improvements
- Per-user persistent state in `db.ai[sender]`
- Last 20 messages are retained
- Older context is compacted into a local summary (max 6000 chars)
- Character and model are stored per user
- Switching character/model clears context to prevent contamination
- `reset` clears conversation memory
