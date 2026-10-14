# Sultanahmet multiplayer — Render Free

Node.js 22+ authoritative WebSocket server for the existing Istanbul game.
Five rooms, five players each. Maps, models, missions and graphics stay in the
separate static game build. No paid API or database is required.

```sh
npm ci --ignore-scripts
npm test
npm start
```

Use the supplied `render.yaml`, or create a Render **Web Service**, runtime Node,
instance **Free**, build `npm ci --omit=dev --ignore-scripts`, start `npm start`,
health check `/health`. Set HOST=0.0.0.0, TRUST_PROXY=1, STORAGE_MODE=memory.
Render supplies PORT and public HTTPS/WSS. Do not attach a paid disk or database.

ALLOWED_ORIGINS contains exact game origins, currently
https://istanbuloyun.netlify.app and https://istanbulgame.netlify.app.
For a future CrazyGames-hosted game add the actual game iframe origin; the parent
portal is not the network Origin. No wildcard or guessed game URL is used.
The existing SDK v3 and offline solo mode are preserved.

Online progress is **temporary RAM state**. It survives a brief disconnect while
this process lives, but is lost on a restart, redeploy or idle shutdown.
`/health`, `/session`, welcome and account packets explicitly identify this.
Your separate solo browser save is never imported or overwritten.
An optional DATA_DIR supports your own persistent host; Render Free never uses it.

Free services sleep after 15 minutes without inbound traffic and wake in about a
minute. The client waits up to 150 seconds with cancellation, then reports a
timeout. Connected clients retry disruptions with exponential backoff and return
to a safe spawn; commands and awards are not replayed. Rooms are RAM-only and are
removed when empty. There is no fake always-on monitoring service.

Security: exact origins, TLS at Render's proxy, anonymous random session tokens
stored hashed on the server, JSON validation, 8 KiB WebSocket/1 KiB HTTP limits,
per-IP session/upgrade limits, command token buckets, heartbeat, bounded sockets,
server movement/collision/ownership checks, authoritative health/ammo/checkpoints
and rewards. This is movement-envelope protection, not full server physics.

See **MULTIPLAYER-KURULUM.md** for deployment, verified tests and limitations.
Official limits: https://render.com/docs/free
WebSocket deployment: https://render.com/docs/websocket
