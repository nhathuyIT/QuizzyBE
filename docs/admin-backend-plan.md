# Admin Monitoring API V1

Admin V1 is a NestJS-only monitoring and moderation surface. Every route below requires a valid JWT with role `admin`; responses continue to use the global `{ success, data, meta? }` wrapper.

## Data model

- Users support `active` and `suspended`, suspension metadata, `lastLoginAt`, soft deletion, and token revocation through `tokenVersion`.
- Decks support `active` and `hidden` moderation states plus soft deletion. Owners may still read hidden decks; deleted decks are visible only through admin APIs.
- `admin_audit_logs` records actor, action, target, metadata, and timestamp.
- Admin mutations and their audit records run in the same MongoDB transaction.

## Endpoints

```http
GET    /v1/admin/dashboard/summary?from=&to=
GET    /v1/admin/analytics/activity?from=&to=&interval=day|week

GET    /v1/admin/users?keyword=&role=&status=&page=&take=
GET    /v1/admin/users/:userId
PATCH  /v1/admin/users/:userId/role
PATCH  /v1/admin/users/:userId/status
POST   /v1/admin/users/:userId/revoke-sessions
DELETE /v1/admin/users/:userId
POST   /v1/admin/users/:userId/restore

GET    /v1/admin/decks?keyword=&visibility=&moderationStatus=&ownerId=&page=&take=
POST   /v1/admin/decks
GET    /v1/admin/decks/:deckId?cardPage=&cardTake=
PATCH  /v1/admin/decks/:deckId
PATCH  /v1/admin/decks/:deckId/moderation
DELETE /v1/admin/decks/:deckId
POST   /v1/admin/decks/:deckId/restore

GET    /v1/admin/study-sessions?userId=&deckId=&mode=&status=&from=&to=&page=&take=
GET    /v1/admin/study-sessions/:sessionId
GET    /v1/admin/study-sessions/:sessionId/reviews?page=&take=
GET    /v1/admin/study/summary?from=&to=&mode=
GET    /v1/admin/audit-logs?adminId=&action=&from=&to=&page=&take=
```

Lists default to `page=1`, `take=20`, with a maximum of 100. Study and analytics ranges use UTC, default to 30 days, and reject ranges longer than 365 days.

## Seed and migration

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME`, then run:

```bash
npm run seed
```

The seed promotes an existing matching email or creates a hashed admin account. It also backfills missing user and deck statuses. Passwords are never printed. MongoDB must run as a replica set (or Atlas) for admin mutation transactions.

For an existing environment, run the non-destructive migration instead of resetting sample data:

```bash
npm run migrate:admin-v1
```
