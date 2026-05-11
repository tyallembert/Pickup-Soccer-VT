<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Vermont Pickup Soccer. Here's a summary of every change made:

- **`instrumentation-client.ts`** (new) — initializes PostHog client-side using Next.js 15.3+ instrumentation, with a reverse proxy (`/ingest`), exception capture, and debug mode in development.
- **`next.config.ts`** — added `rewrites()` to proxy PostHog ingestion through `/ingest/*` and `/ingest/array/*`, plus `skipTrailingSlashRedirect: true`.
- **`.env.local`** — added `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` (never hardcoded in source).
- **`app/signin/SignInForm.tsx`** — `posthog.identify()` + `user_signed_in` on successful sign-in; `sign_in_failed` on error.
- **`app/signup/SignUpForm.tsx`** — `posthog.identify()` + `user_signed_up` on successful account creation.
- **`app/locations/[id]/LocationDetail.tsx`** — `location_viewed` fires once when location data loads (top-of-funnel); `maps_link_clicked` on Google Maps link click.
- **`app/submit/SubmitForm.tsx`** — `location_submitted` fires after the Convex mutation succeeds.
- **`app/_components/StatusForm.tsx`** — `game_status_saved` fires after owner saves weekly game on/off status.
- **`app/_components/RecapForm.tsx`** — `session_recap_saved` fires after owner saves a session recap.
- **`app/admin/queue/[id]/ReviewClient.tsx`** — `location_approved` / `location_rejected` fire after admin decisions.
- **`app/account/locations/[id]/OwnerLocationClient.tsx`** — `location_resubmitted` fires when owner resubmits a rejected location.
- **`app/_components/Filters.tsx`** — `directory_filtered` fires on town selection, day-of-week selection, and search input blur.

## Events

| Event | Description | File |
|---|---|---|
| `user_signed_in` | User successfully signed in | `app/signin/SignInForm.tsx` |
| `sign_in_failed` | Sign-in attempt failed (bad credentials) | `app/signin/SignInForm.tsx` |
| `user_signed_up` | User created a new account | `app/signup/SignUpForm.tsx` |
| `location_viewed` | User viewed a pickup location detail page | `app/locations/[id]/LocationDetail.tsx` |
| `maps_link_clicked` | User opened a location in Google Maps | `app/locations/[id]/LocationDetail.tsx` |
| `location_submitted` | User submitted a new pickup location for review | `app/submit/SubmitForm.tsx` |
| `game_status_saved` | Owner saved weekly game-on/off status | `app/_components/StatusForm.tsx` |
| `session_recap_saved` | Owner saved a post-game session recap | `app/_components/RecapForm.tsx` |
| `location_approved` | Admin approved a pending location | `app/admin/queue/[id]/ReviewClient.tsx` |
| `location_rejected` | Admin rejected a pending location | `app/admin/queue/[id]/ReviewClient.tsx` |
| `location_resubmitted` | Owner resubmitted a rejected location | `app/account/locations/[id]/OwnerLocationClient.tsx` |
| `directory_filtered` | User applied a filter on the main directory | `app/_components/Filters.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1568871)
- [New sign-ups over time](/insights/yztu8jJS)
- [Location submissions over time](/insights/BSVTq7C2)
- [Location views over time](/insights/tiGU3Txe)
- [Sign-up to location submission funnel](/insights/MgjlsYzJ)
- [Owner engagement: status & recap saves](/insights/pvZnfoAy)

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
