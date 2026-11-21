# Vermont Pickup Soccer

A statewide directory of pickup soccer in Vermont: a map and list of games,
account-based submissions that go through an admin moderation queue, owner and
co-maintainer tools (weekly on/off status, session recaps), and an installable
admin PWA with web push.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 ·
[Convex](https://convex.dev) (database, functions, crons) · Convex Auth
(email + password) · Leaflet/OpenStreetMap · GSAP · PostHog · Vitest +
`convex-test`.

Design history lives in `docs/superpowers/specs/` (read the newest first; later
specs supersede earlier ones) with matching plans in `docs/superpowers/plans/`.

## Development

Everything runs in Docker Compose: a self-hosted Convex backend and dashboard,
`convex dev` (pushes `convex/` on every save), `next dev`, and Caddy serving it
all over HTTPS on this machine's Tailscale name. Nothing is exposed beyond the
tailnet, and nothing talks to Convex cloud.

**Needs:** Docker with Compose, and Tailscale with MagicDNS and HTTPS
certificates enabled for the tailnet.

```sh
dev/setup.sh            # first run; safe to re-run any time
```

It writes `.env` (your tailnet name and IP, a dev admin password), starts the
stack, stores the Convex admin key, sets the Convex env vars, creates the admin
account, and imports `docs/seed-data/pickup-games.json`. Then:

| What | URL |
|---|---|
| App | `https://<DEV_HOST>:8444` |
| Convex dashboard | `https://<DEV_HOST>:8447` |
| Convex API / HTTP actions | `:8445` / `:8446` |

Sign in as `admin@example.com` with `DEV_ADMIN_PASSWORD` from `.env`. HTTPS
works from any device on the tailnet, phones included, so you can install the
PWA and test push there too.

### Day to day

```sh
docker compose up -d                          # start (after setup.sh has run once)
docker compose logs -f web convex             # Next output + Convex function logs
docker compose exec convex npx convex <cmd>   # Convex CLI: env list, run, data, logs, ...
docker compose down                           # stop; data persists
docker compose down -v && dev/setup.sh        # wipe the dev database and start fresh

npm test                                      # Vitest (convex-test) — runs on the host
npx tsc --noEmit                              # typecheck
npm run lint
```

- **Don't run `npm run dev` or `npx convex dev` on the host.** The containers
  already do, and two `next dev` processes fight over `.next/`.
- **Run Convex CLI commands in the `convex` container.** Its deployment URL is
  the tailnet name, which the host itself can't resolve.
- `node_modules` is shared with the host. The containers run Node 24 on glibc
  as uid 1000, the same as this machine, so host-side `npm test`, editors, and
  `npm install <pkg>` all just work. The `deps` service reinstalls on `up`
  whenever `package-lock.json` changes.
- `convex dev` regenerates `convex/_generated/` on save. Commit those changes
  along with the function changes that caused them.

### Why HTTPS (and Caddy)

Convex Auth's Next.js middleware marks its cookies `Secure` with a `__Host-`
prefix on any host that isn't `localhost`. Over plain HTTP, sign-in returns 200
but the browser drops the cookies, so you stay signed out. Two consequences:

- A plain-HTTP `*.the-allemberts` proxy host can't serve this app.
- `tailscale serve` can't either. Its listeners bind to the `tailscale0`
  device, and the Next server inside Docker also has to reach Convex at the
  same URL as the browser (middleware, `fetchQuery`, `preloadQuery`).

Caddy solves both. It gets the `*.ts.net` certificate from `tailscaled`
through the mounted socket, publishes ports only on the tailnet IP, and is
aliased to the tailnet name inside the Compose network. Browsers and
containers resolve the same URLs to it.

## Environment variables

### Dev stack (`.env`, read by Compose)

Created by `dev/setup.sh` from `.env.example`; git-ignored.

| Variable | Purpose |
|---|---|
| `DEV_HOST` | This machine's Tailscale name. All URLs are `https://$DEV_HOST:<port>`. |
| `DEV_BIND_IP` | Tailnet IPv4. Caddy publishes only on this address. |
| `WEB_PORT`, `CONVEX_PORT`, `SITE_PORT`, `DASHBOARD_PORT` | HTTPS ports (default 8444–8447). |
| `CONVEX_ADMIN_KEY` | Self-hosted backend admin key, derived from the instance secret in the `convex-data` volume. |
| `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD` | The seeded admin login. |

`convex dev` also writes `.env.local` (`NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_CONVEX_SITE_URL`). Leave it alone.

### Next.js app

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | yes | Convex deployment URL, used by the browser and the server. |
| `NEXT_PUBLIC_SITE_URL` | no | Canonical URL for metadata, OG images, sitemap, and robots. Defaults to `https://vermontpickupsoccer.com`. |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | no | Enables PostHog. Unset in dev, so analytics stay clean. |
| `DEV_HOST` | dev only | Added to `allowedDevOrigins` in `next.config.ts`. |

### Convex deployment (`npx convex env set`)

`dev/bootstrap.mjs` sets all of these for the dev deployment. Production needs
the same set with its own values.

| Variable | Purpose |
|---|---|
| `JWT_PRIVATE_KEY`, `JWKS` | Convex Auth signing keys (`npx @convex-dev/auth` generates them). |
| `SITE_URL` | The app's URL, used by Convex Auth for redirects. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push (`npx web-push generate-vapid-keys`; the subject is a `mailto:` or `https:` URL). Changing the keys invalidates every existing push subscription. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Read only by `npx convex run seedAdmin:run`, which creates the admin account. |
| `CONVEX_SITE_URL` | Built in, not set by hand. It's the JWT issuer in `convex/auth.config.ts`. |
