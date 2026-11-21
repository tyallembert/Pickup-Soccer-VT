<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

# Dev workflow

The README's "Development" section has the full picture. Short version:

- The dev stack is `docker compose up -d`: a self-hosted Convex backend and dashboard, `convex dev`, `next dev`, and Caddy. First run, or after `docker compose down -v`: `dev/setup.sh`.
- Never start `npm run dev` or `npx convex dev` on the host; the containers already run them. Check `docker compose ps` before assuming the app is down.
- Convex CLI goes through the container: `docker compose exec convex npx convex <cmd>` (`env list`, `run module:fn '<json>'`, `data <table>`, `logs`). On the host it can't reach the deployment.
- Tests, typecheck and lint run on the host (shared `node_modules`): `npm test`, `npx tsc --noEmit`, `npm run lint`. Lint has 8 errors that predate the dev stack (`react-hooks/purity`, `react-hooks/set-state-in-effect` in existing components). Compare against that baseline rather than treating them as yours.
- After editing `convex/`, check `docker compose logs --tail 20 convex` for "Convex functions ready" or a push error. It typechecks and pushes on every save, and regenerates `convex/_generated/`, which gets committed with the change.
- Check UI work at `https://$DEV_HOST:$WEB_PORT` (values in `.env`; the admin login is `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD`). From this machine's shell, the tailnet name doesn't resolve, so use `curl --resolve "$DEV_HOST:$WEB_PORT:$DEV_BIND_IP" https://$DEV_HOST:$WEB_PORT/...`.
- Keep the dev site on HTTPS. Convex Auth's cookies are `Secure` + `__Host-` off localhost, so plain HTTP (an nginx-proxy-manager `*.the-allemberts` host, for example) breaks sign-in without any error.
- A fresh deployment gets `docs/seed-data/pickup-games.json` through the internal `seedLocations:run` mutation, which does nothing once any location exists. Use the same path for new seed data rather than hand-inserting rows.
