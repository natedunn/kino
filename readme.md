# Kino

## Development

Use Portless by default:

```bash
pnpm dev
```

That serves the app on a stable `https://*.localhost` URL instead of hard-coding `http://localhost:3000`, which avoids local port collisions across projects and worktrees.

If you need the old localhost flow, run:

```bash
pnpm dev:localhost
```
