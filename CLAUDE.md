# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (auto-reload via nodemon)
pnpm dev

# Production start
pnpm start

# Start database (MySQL 8.0 on port 3307)
docker-compose up -d mysql-db-tracker
```

No test suite or linter is configured. Code style is enforced by Prettier (180-char print width, 3-space indentation, ES5 trailing commas).

## Architecture

**Vio-V-Aktionstracker** is an Express + Handlebars MVC app for tracking gang operations in the online game Vio-V. It integrates with the Vio-V game API via OAuth2 and sends real-time Discord notifications.

### Request lifecycle

1. Routes in [routes/index.js](routes/index.js) and [routes/leader.js](routes/leader.js) apply auth middleware, then delegate to controllers.
2. Auth middleware lives in [helpers/authentification.js](helpers/authentification.js): `isAuthenticated`, `hasRank(minLevel)`, `isLeader()`.
3. Session identity is stored in an **in-memory singleton** (`helpers/auth.js`) mapping session ID → user ID (not in the DB).
4. Controllers query Sequelize models and render `.hbs` templates from `views/`.

### Key files

| File | Role |
|------|------|
| [bin/www](bin/www) | Entry point: DB sync, cron loader, graceful shutdown (SIGTERM/SIGINT) |
| [app.js](app.js) | Express app, middleware stack, global error handler |
| [config.js](config.js) | Single source of truth for all `process.env` values |
| [helpers/vioHandler.js](helpers/vioHandler.js) | Vio-V API client: JWT expiry check, token refresh, all API calls |
| [helpers/crons.js](helpers/crons.js) | Two cron jobs: gangwar attack monitor (every 1 min), storage weight check (every 60 min) |
| [helpers/utility.js](helpers/utility.js) | Discord webhook client (`logHook`, `notificationHook`), logging helpers |
| [models/index.js](models/index.js) | Sequelize init: dynamically loads all model files, sets up associations |
| [controllers/login.js](controllers/login.js) | OAuth2 PKCE flow with Vio-V; creates/updates User on callback |
| [controllers/operations.js](controllers/operations.js) | Operation CRUD, many-to-many membership, payment calculation |

### Database (Sequelize + MySQL)

Models: `User`, `Role`, `Operation`, `OperationType`, `GWData`

- `GWData` is a **singleton row** (ID=1) that persists the last-known territory state between cron runs.
- Users belong to Roles (permission levels); operations have types with point values.
- `user_operation` is the join table for who participated in which operation.
- DB connection pool config comes from `DB_POOL_*` env vars (default max 10 connections).

### OAuth2 / token flow

- Login redirects to `apiv1.vio-v.com` with PKCE parameters. Callback exchanges code for tokens and stores them on the `User` row.
- `vioHandler.js` decodes the JWT to check expiry before every API call, then refreshes if needed.
- A revoked/invalid refresh token sets `User.vio_refresh_token = null` and marks `GWData.invalidToken = true`, which triggers a Discord alert.

### Cron jobs (`helpers/crons.js`)

Which 1-minute job runs depends on `GROUP_TYPE`:
- **`gang`** (default): `checkGangwarAttacks()` — fetches `/group/areas`, diffs against `GWData.lastData`, sends Discord embeds on attack or territory loss.
- **`squad`**: `checkFactoryAttacks()` — fetches `/group/own_factories` + `/group/factories`, diffs against `GWData.lastFactoryData`, sends Discord embeds on attack or factory loss.
- **Every 60 minutes** (both modes): `checkStorageWeight()` — fetches `/group/storage` + `/system/items`, alerts if total weight >80% capacity.

### Discord integration

Two `WebhookClient` instances in `utility.js`:
- `logHook` → `DISCORD_WEBHOOK` env var (operational logs: Info / Important / Error / Action)
- `notificationHook` → `NOTIFY_DISCORD_WEBHOOK` env var (war alerts with `DC_PING_ROLE` mention)

## Environment variables

Copy `.env.example` to `.env`. Required variables:

- `CLIENT_ID`, `CLIENT_SECRET`, `redirectUri` — Vio-V OAuth app credentials
- `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_HOST` — MySQL connection
- `VIO_GROUP_ID`, `GANG_NAME` — identifies the gang in API responses
- `DISCORD_WEBHOOK`, `NOTIFY_DISCORD_WEBHOOK`, `DC_PING_ROLE` — Discord output
- `GROUP_TYPE` — `gang` (default) tracks gangwar territories; `squad` tracks factories
- `CUSTOM_FACTORY_ATTACK_MESSAGE` — custom text for factory attack Discord pings (squad mode)
- `DOMAIN` — used in OAuth redirect URI construction

## Docker

`docker-compose.yml` runs three services: `tracker` (the app behind Traefik), `mysql-db-tracker` (port 3307), and `mysql-backup-tracker` (daily 3am backups, 3-file retention). The app image is built from the repo's `Dockerfile` (Node 22 slim).
