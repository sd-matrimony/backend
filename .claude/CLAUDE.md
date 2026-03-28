# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (hot reload)
pnpm dev         # tsx watch src/index.ts — runs on port 5000

# Production
pnpm build       # tsc → outputs to ./dist/
pnpm start       # node dist/index.js

# No test runner is configured yet; manual testing uses the .http files in /test/
# with the VS Code REST Client extension
```

## Architecture

**Stack:** TypeScript + Hono (web framework) + MongoDB (Mongoose) + Redis

**Entry point:** `src/index.ts` — creates a Hono app with base path `/api`, registers global middleware (logger, CORS, secure headers, compression), connects to MongoDB/Redis, and mounts all route groups.

**Middleware order matters:**
1. Logger → CORS → Secure Headers → Compression
2. Static file serving (`/api/static/*`)
3. Account routes (public — no auth)
4. Rate limiter
5. Auth middleware (JWT validation + Redis user caching)
6. All other routes (protected)

**Layer structure:**

| Layer | Directory | Responsibility |
|---|---|---|
| Routes | `src/routes/` | HTTP method + path + Zod validation → controller |
| Controllers | `src/controllers/` | Business logic, returns JSON |
| Models | `src/models/` | Mongoose schemas (User, Admin, Payment, UserAccess) |
| Middlewares | `src/middlewares/` | auth.ts, rate-limit.ts, role-check.ts |
| Services | `src/services/` | MongoDB/Redis connections, Cloudinary, Nodemailer |
| Validations | `src/validations/` | Zod schemas (used via `@hono/zod-validator`) |
| Utils | `src/utils/` | JWT tokens, password hashing, cookies, enums, user-filter |

## Key Domain Concepts

- **Users** have subscription plans (Basic/Gold/Diamond/Platinum) and must unlock profiles to see full details
- **UserAccess** model tracks which profiles a user has unlocked and against which payment plan
- **Admins** have role `admin` or `super-admin`; both require approval before accessing protected routes
- **Refresh tokens** are stored as an array on User/Admin documents (multi-device support)
- Token validity: verify=15min, access=30min, refresh=7 days (see `src/utils/enums.ts`)

## Environment Variables

Required in `.env`:
```
MONGODB_URL, REDIS_URL
ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET
CLOUDINARY_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_SECRET
FRONTEND_URL
EMAIL_ID, EMAIL_PASS, EMAIL_HOST
PHONE_PAY_CLIENT_ID, PHONE_PAY_SECRET
```

## Patterns to Follow

- **Validation:** All route input is validated with Zod via `zv("json"|"query"|"param"|"form"|"cookie", schema)` before reaching the controller.
- **Auth context:** The auth middleware sets `c.set("user", ...)` (typed as `zContext` in `src/types/index.d.ts`). Access via `c.get("user")` in controllers.
- **Module system:** The project uses `"type": "module"` (ESM). All imports must include file extensions when referencing local files after compilation.
- **Payment gateway:** PhonePay integration — sandbox vs. production URLs are toggled via `src/utils/enums.ts`.
