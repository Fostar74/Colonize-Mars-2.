# Colonize Mars 2.0

A new browser-based Mars strategy game built from reusable code and artwork from the original Colonize-Mars project. This repository starts with a fresh Git history; it is not a fork.

## Status

Development foundation only. Registration, progress persistence, and unique server-side spawn reservations have initial implementations, but the game is **not production ready**. Authentication/authorization for progress endpoints, real-time multiplayer, resource production, and database deployment durability still require work and testing.

## Local development

- Install Node.js and run `npm install`.
- Run the backend with `node server.js` (default port 3001).
- In another terminal, run `npm start` for the React frontend.
- Set `REACT_APP_API_URL` at frontend build time to the public backend URL for deployment.

## Password recovery email

Password reset links are sent through the Brevo transactional email API. Configure `BREVO_API_KEY` and `BREVO_FROM_EMAIL` in the backend service environment; `BREVO_FROM_NAME` is optional and defaults to `Colonize Mars`. Brevo requires the sender address to be registered and verified by email. Domain authentication improves deliverability but is not required to create a verified sender. `APP_BASE_URL` is optional and defaults to `https://colonize-mars-2.onrender.com`; set it to the public game URL if that changes. Keep the API key in the hosting provider's secret environment settings, never in source control.

Reset links contain a single-use token that expires after 30 minutes. The database stores only its SHA-256 hash.

## Important deployment warning

The current backend uses SQLite in `database/colonize_mars.db`. A Render instance with ephemeral filesystem storage can lose that file on redeploy or restart. Configure persistent storage or migrate to a managed database before inviting players. Do not import a live user database or secrets into this repository.

The original repository remains separate and unchanged by this migration.
