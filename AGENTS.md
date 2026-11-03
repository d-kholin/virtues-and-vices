# Working in this repository

- Develop on a descriptive feature branch (for example, `feature/calendar-controls`), never directly on `main`.
- Commit and push the feature branch, then merge into `main` after relevant checks pass. Prefer a pull request when repository tooling permits; if it is unavailable, use a normal local merge commit and verify remote CI. Preserve unrelated changes. Do not force-push `main`.
- Run `npm run check` for code changes. Run `npm run test:browser` for user-visible behavior; use installed Edge locally or Playwright Chromium via `PLAYWRIGHT_CHANNEL=chromium` in CI.
- For container/workflow changes, build the Docker image and verify startup, health, non-root operation, and persistent data as appropriate.
- Pushes to branches publish GHCR images tagged with the normalized branch name. Pushes to `main` publish `1.<workflow-run-number>` and the moving major tag `1`. All published builds also receive a commit SHA tag. Do not publish branch images using release tags.
- Publishing an image does not deploy it to a running service. Do not claim deployment without verifying the destination service.
- Keep credentials in environment variables. Never commit `.env`, SQLite databases, local logs/screenshots, or `node_modules`.
- Follow the existing warm journal design, separate Virtues and Vices, and use large, visibly touchable controls on mobile. Shared habits appear inline with a Shared tag.
- Enforce personal ownership and private-habit filtering on the server. Both family members can edit shared habits.
