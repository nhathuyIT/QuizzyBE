# Quizzy Backend Project Tracking

Current date: 2026-05-23

This file is a handoff note for continuing the project in a new chat. It records what has been built, how to run it, and what should be handled next.

## Project Overview

Quizzy Backend is a NestJS + MongoDB/Mongoose backend for a flashcard learning app inspired by Gizmo/Quizlet.

Main architecture follows the project guide:

Client -> Controller -> Service -> Repository -> MongoDB

Feature modules live under:

```txt
src/modules/<module>/
  dto/
  schemas/
  <module>.controller.ts
  <module>.service.ts
  <module>.repository.ts
  <module>.module.ts
```

## Current Modules

- `auth`: register, login, JWT auth, current user endpoint.
- `user`: user schema, repository, service.
- `deck`: deck schema, repository/service, pagination search support.
- `card`: card schema, bulk card DTO, repository/service.
- `card-progress`: SRS progress schema and basic repository/service.
- `study`: study session and card review schemas plus repository/service.
- `ai-generator`: AI source and AI generation job schemas plus repository/service.
- `database`: Mongo connection using `MONGO_URI` or `MONGODB_URI`.

## Common Core

Created lightweight core utilities under `src/common`:

- `dto/abstract.dto.ts`
- `dto/page-options.dto.ts`
- `dto/page-meta.dto.ts`
- `dto/page.dto.ts`
- `interceptors/transform.interceptor.ts`
- `guards/jwt.guard.ts`
- `guards/roles.guard.ts`
- `decorators/current-user.decorator.ts`
- `decorators/roles.decorator.ts`
- `enums/order.enum.ts`
- `enums/role-type.enum.ts`

`TransformInterceptor` is registered globally in `src/app.module.ts`, so responses are wrapped as:

```json
{
  "success": true,
  "data": {}
}
```

For paginated `PageDto`, it returns:

```json
{
  "success": true,
  "data": [],
  "meta": {}
}
```

It also removes `password`, `passwordHash`, and `__v` from returned objects.

## Auth Status

Implemented JWT authentication:

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`

Important files:

- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.module.ts`
- `src/modules/auth/strategies/jwt.strategy.ts`
- `src/common/guards/jwt.guard.ts`
- `src/common/guards/roles.guard.ts`

Register currently creates a user and returns an auth response with token:

```ts
return this.buildAuthResponse(user);
```

If the desired behavior is "register only creates account and does not return token", change `register()` in `src/modules/auth/auth.service.ts` to return `this.toAuthUser(user)` instead.

Seeded login user:

```txt
email: student@gizmo.local
password: password123
```

## Database

Mongo connection:

- File: `src/database/database.module.ts`
- Env keys: `MONGO_URI` or `MONGODB_URI`
- The code trims the URI and sets connection timeouts.

Seed file:

- `src/database/seed/seed.ts`

Seed command:

```bash
npm run seed
```

Seed collections:

- `users`
- `ai_sources`
- `ai_generation_jobs`
- `decks`
- `cards`
- `card_progress`
- `study_sessions`
- `card_reviews`

The seed deletes old data in these collections before inserting sample data.

## Environment Variables

Local `.env` should contain:

```env
PORT=3001
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

Do not put a space after `MONGO_URI=`.

On Vercel, `PORT` is not needed.

## Vercel Deployment

Current Vercel setup:

- `vercel.json`
- `api/index.ts`
- `src/main.ts` exports `createNestApp()`.

`api/index.ts` is the serverless handler. It creates an Express server, mounts Nest on it through `ExpressAdapter`, caches the Nest app, and forwards Vercel requests to Express.

Recommended Vercel settings:

- Application preset: `Other` or `NestJS`
- Root Directory: `./` if GitHub repo root is this NestJS project
- Root Directory: `nestjs` if this project is inside a monorepo folder named `nestjs`
- Build Command: `npm run build`
- Output Directory: leave empty
- Install Command: leave empty

Required Vercel env:

```env
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

MongoDB Atlas must allow Vercel network access. For demo/dev, `0.0.0.0/0` works, but tighten it later for production.

## Postman

Postman collection:

- `Quizzy.postman_collection.json`

It contains:

- `GET /`
- `GET /ping`
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`

Collection variables:

- `baseUrl`
- `accessToken`

Register/Login test scripts automatically store `accessToken` into collection variables. `Get Me` sends:

```http
Authorization: Bearer {{accessToken}}
```

## Commands

Install dependencies:

```bash
npm install
```

Run dev:

```bash
npm run start:dev
```

Build:

```bash
npm run build
```

Run production build:

```bash
npm run start:prod
```

Run tests:

```bash
npm test -- --runInBand
```

Typecheck:

```bash
npx tsc --noEmit
```

Seed database:

```bash
npm run seed
```

## Verified Recently

These commands were run successfully during setup:

```bash
npm run build
npx tsc --noEmit
npm test -- --runInBand
npm run seed
```

Auth smoke tests were also run:

- Register returned token.
- Login seeded student returned `200` and token.
- `GET /v1/auth/me` worked with Bearer token.

## Important Notes

- `register` currently returns token. Decide whether the product should auto-login after register.
- `RolesGuard` works only after `JwtAuthGuard` attaches `request.user`.
- `TransformInterceptor` strips password fields from response objects.
- `src/modules/user/dto/register-user.dto.ts` and `login-user.dto.ts` still exist from earlier user module work, but auth uses `src/modules/auth/dto/register.dto.ts` and `login.dto.ts`.
- The app is currently a monolith. BullMQ/Redis for AI jobs is not implemented yet.
- Controllers for deck/card/study/card-progress/ai-generator are mostly DI shells. Business endpoints still need to be added.

## Next Work Checklist

- Add real CRUD endpoints for decks.
- Add card endpoints for create, bulk insert, update, list by deck.
- Add auth guard to protected routes.
- Add ownership checks for deck/card operations.
- Add study session endpoints.
- Add card review logging endpoint and connect it to SRS progress update.
- Add AI generation queue with BullMQ/Redis if needed.
- Add refresh token flow if the project requires long-lived sessions.
- Add API docs or Swagger once endpoint set stabilizes.
- Add more unit/e2e tests for auth and protected routes.
