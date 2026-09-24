# Local infrastructure workflow

This document describes the reproducible local setup used by Phase 1. It starts PostgreSQL with Docker Compose, applies the versioned Prisma migrations, seeds the QA session, and starts the API only after the database is healthy.

## Prerequisites

Install Docker Desktop with Compose support, Node.js 20 or newer, and pnpm. Copy `.env.example` to `.env` when running the API outside Docker. Never use the development secrets in a shared or production environment.

## Start the complete local stack

Run:

```bash
docker compose up --build
```

The `db` service exposes PostgreSQL on `localhost:5432`. The `api` service exposes the backend on `http://localhost:3000`. On startup, the API container waits for PostgreSQL, runs `prisma migrate deploy`, runs the idempotent seed, and starts the compiled server.

The development Compose database uses the following disposable credentials:

| Setting | Value |
|---|---|
| Database | `fearless_footballer` |
| User | `ff_user` |
| Password | `ff_password` |
| Host port | `5432` |

These values are for local development only.

## Run database setup without starting the API container

With PostgreSQL already available at the `DATABASE_URL`, run:

```bash
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm prisma:seed
```

The equivalent convenience command is:

```bash
pnpm db:setup
```

## Neon staging database

The authorized Neon PostgreSQL database is now the staging/integration database for this project. Keep its connection string in a local environment variable or a deployment secret; never commit it to `.env.example`, Compose files, CI logs, or source control.

For a staging setup, export `DATABASE_URL` with the Neon connection string and run `pnpm db:setup`. The versioned migration has been applied successfully and the idempotent QA seed has created the sample session. The database-backed Phase 2 security suite has also passed all 10 tests against Neon.

Do not run `pnpm db:reset` against Neon. The integration suite clears and recreates its disposable test records, so it must only be pointed at this dedicated staging/integration database and never at production data.

For a disposable reset that removes all local database data and reseeds the sample session, run:

```bash
pnpm db:reset
```

Do not run `db:reset` against staging or production.

## CI behavior

The CI workflow starts PostgreSQL 16 as a service, generates Prisma Client, applies the versioned migrations with `prisma migrate deploy`, seeds QA data, runs the server test suite, and builds the backend. This makes CI exercise the same migration path used by a deployed container instead of using an untracked schema push.

## Shutdown and cleanup

Stop the stack with:

```bash
docker compose down
```

Remove the disposable local database volume with:

```bash
docker compose down -v
```

Removing the volume deletes all local database data. It does not affect staging or production databases.

## Phase 1 limitations

This workflow does not configure production backups, create a staging API deployment, or provide a production rollback mechanism. Neon staging is provisioned and migration-tested, but those operational Phase 1 items remain open.
