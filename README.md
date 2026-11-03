# Virtues & Vices

A family habit tracker with a warm journal interface, separate Virtues and Vices, light/dark themes, and Pocket ID authentication. The original design-only mockup remains at `index.html`; the working app is served from `public/`.

## Run locally

Requires Node.js 22.13 or newer. SQLite uses Node's built-in `node:sqlite` module (Node 22 prints an experimental-module warning).

```powershell
npm ci
npm run demo
```

Open http://localhost:5173 and choose **Enter local demo**. Create your first habits with **New habit**. Data is stored in `data/app.sqlite`. Settings includes a demo-only account switch so both family members' permissions can be reviewed. Demo mode defaults to localhost, is disabled in production, and bypasses Pocket ID. For explicitly approved testing with demo data on a trusted LAN, set `HOST=0.0.0.0`, `ALLOW_NETWORK_DEMO=true`, and `APP_URL` to the LAN URL. Set `ADDITIONAL_ORIGINS` to other exact URLs you use (for example, `http://localhost:5173`). Devices that can reach it can access and change demo data without sign-in. Do not expose it using a tunnel or public reverse proxy.

## Connect Pocket ID

1. Copy `.env.example` to `.env`.
2. Create an OIDC client in Pocket ID. Set its callback URL to `https://YOUR-APP/auth/callback` (or `http://localhost:5173/auth/callback` for local development).
3. Set `APP_URL`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET`. The issuer is your Pocket ID instance's issuer URL.
4. Set `ALLOWED_SUBJECTS` to the exact two approved users' OIDC `sub` claims, comma-separated. Access is denied by default. Household membership is this list, including users who have not signed in yet.
5. Set `SESSION_SECRET` to a random secret of at least 32 characters. For example: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
6. Set `DEMO_MODE=false`. Run `npm start`.

For hosting: use HTTPS, `NODE_ENV=production`, persistent storage for `data/`, and `HOST=0.0.0.0` inside your hosting environment if needed. Set `TRUST_PROXY=1` only behind a trusted single reverse proxy; secure session cookies require Express to recognize the incoming HTTPS connection. Keep `.env` and the database outside any static web root. The server serves only `public/` and the shared calculation module, never the repository root.

Sign-in uses OIDC authorization code flow with PKCE, state, nonce, issuer discovery, and ID-token validation through `openid-client`. Sessions persist in SQLite with HttpOnly/SameSite cookies. Mutations require a session CSRF token and matching Origin. There is no public registration. Sign-out ends this app's session, not the Pocket ID SSO session.

**Live Pocket ID sign-in has not yet been tested against your instance.** It needs the actual issuer/client settings and approved subject IDs. Do not use the demo database for real users; set `DB_PATH` to a different database when switching to real authentication.

## Working features

- Create/edit/archive habits; private or spouse-visible personal habits; fully shared habits.
- Separate virtue completion and vice occurrence/avoidance controls.
- Daily schedules or flexible weekly targets with preferred days; multiple occurrences stored per day, distinct days counted for weekly targets.
- Vice weekly limits count days with occurrences. Automatic avoidance can be selected per habit.
- Date navigation and historical corrections; unresolved historical entries are prompted for review and keep streaks pending. Marking a day missed settles a break; correcting it recalculates the streak.
- Daily and weekly current/best streaks, calendar heatmap, monthly completion rates, and filtered household activity.
- Scheduled personal vacations with proportional, manual, or excused weekly targets. Shared habits pause only on overlapping vacation days for all approved family members.
- Profile timezone/week start; per-habit week start; evening and extra habit reminder preferences.
- PWA manifest and public-asset service worker. This first version needs a network connection for sign-in and tracking; it does not queue offline writes. Installation support depends on browser support for SVG manifest icons.

## Not connected yet

Reminder times are stored, but notification delivery and scheduling are intentionally deferred. There is no push, email, or other reminder channel yet. This is a single household and a single server process; there is no household invitation system or account management UI.

Habit setting changes currently recalculate all history using the new settings. Historical versions of schedules and an automatic backup/export UI are future work. Back up the SQLite database using SQLite's backup tooling or stop the app before copying `data/` so WAL files are handled consistently.

## Checks

```powershell
npm run check
npm run test:browser
```

The browser check uses installed Microsoft Edge via Playwright, starts an isolated server on port 5174, and writes its own database/screenshots beneath `data/qa-*`. It verifies UI creation, reload persistence, vice occurrences, desktop/mobile layouts, privacy filtering, CSRF rejection, and owner/shared permissions. Core tests cover streaks, distinct-day counting, historical corrections, vice limits, and vacation policies.

## Structure

- `server.mjs`: HTTP API, Pocket ID, sessions, SQLite, permissions.
- `lib/habits.mjs`: shared date, streak, vacation, and validation rules.
- `public/app.js`: browser UI, forms, reporting, and API calls.
- `public/style.css`: approved journal design and responsive layouts.
- `docs/PRODUCT.md`: agreed product decisions.

OIDC reference: [openid-client authorization-code documentation](https://github.com/panva/openid-client/blob/main/docs/functions/authorizationCodeGrant.md).

## Docker and GHCR

The Container workflow tests the app and its browser flows before building an image. Pushes to any branch publish to `ghcr.io/d-kholin/virtues-and-vices`; pull requests build and test without publishing. GitHub's built-in `GITHUB_TOKEN` supplies registry authentication with `packages: write`; no registry password needs to be added to repository secrets. Actions are pinned to commit SHAs.

| Source | Example image tags |
| --- | --- |
| `feature/calendar-controls` | `feature-calendar-controls`, `sha-<12-character-commit>` |
| `main`, workflow run 23 | `1.23`, `1`, `sha-<12-character-commit>` |

Branch tags are lowercase, with unsupported characters such as `/` replaced by `-`. Avoid names that normalize to the same tag. Release and SHA tag names are reserved; feature branches cannot overwrite them. The numbered main tag is `1.<workflow run number>` (not the version from `package.json`), so numbering can have gaps. Rerunning a workflow reuses its numbered tag. `1` moves to the most recently published main build. There is no `latest` tag. Publishing currently targets Linux amd64 and does not deploy to a running server.

To build locally:

```powershell
docker build -t virtues-and-vices:local .
```

To run a published image, put real Pocket ID and session settings in your untracked `.env`, then:

```powershell
docker compose pull
docker compose up -d
```

Compose uses `:1` by default. Set `VV_IMAGE=ghcr.io/d-kholin/virtues-and-vices:feature-calendar-controls` to try a feature image, or use a numbered `1.x` tag to pin a main build. The named `habit-data` volume persists SQLite. Use a separate Compose project/volume for feature testing (`docker compose -p vv-feature ...`) so test and production data stay separate. Bind-mounted data directories must be writable by container user UID 1000.

Compose deliberately sets production mode and disables demo authentication bypass, even if your local `.env` has demo settings. It validates that real authentication settings are present. It binds the published port to localhost by default; set `BIND_ADDRESS` and `PUBLISHED_PORT` as appropriate for your reverse proxy or network. Set `APP_URL` to the externally reachable URL. Set `TRUST_PROXY=1` only behind a trusted single reverse proxy.

If the GHCR package is private, sign in on the deployment machine with a GitHub token that has package-read access before pulling. Keep tokens out of Compose files. [GitHub's Container registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) covers package access and registry authentication.

Development happens on feature branches followed by pull requests into `main`; see [AGENTS.md](AGENTS.md).
