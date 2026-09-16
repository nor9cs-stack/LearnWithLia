# LearnWithLia engineering guide

## Repository rules

- Treat `sources/` as read-only synced reference material. Never edit, move, or delete it.
- Use `pnpm`; do not introduce another package manager or lockfile.
- Keep TypeScript strict. Avoid `any`; validate every external or client-controlled value with Zod.
- Keep credentials and secrets out of source control. Only `.env.example` may be committed.
- Use Prisma migrations for schema changes. Never use `prisma db push` against production.
- Keep authentication, authorization, assignment eligibility, time limits, scoring, and answer checks on the server.
- Never serialize reference answers into student-facing React props, HTML, API responses, logs, or client bundles.
- Re-check identity, role, and object ownership in every Server Action and Route Handler. UI guards are not security boundaries.
- Prefer archival and immutable versions over destructive deletion.
- All uploaded exam files remain private and are accessed through short-lived signed URLs.
- User-facing copy lives in `lib/i18n/`; Chinese is the default locale.

## Architecture boundaries

- `app/`: routes, layouts, Server Components, Route Handlers, and thin Server Actions.
- `components/`: reusable UI and feature components. No direct Prisma or secret access.
- `lib/auth/`: Auth.js configuration, password verification, sessions, and RBAC.
- `lib/auth/dal.ts` and feature services: server-only access checks and DTO allowlists that enforce ownership.
- `lib/exams/`: publishing validation, versioning, grading, assignment eligibility, and timing.
- `lib/imports/`: MIME detection, extraction, structured draft parsing, and Inngest jobs.
- `lib/storage/`: server-only Supabase Storage client and signed URLs.
- `lib/rate-limit/`: Upstash-backed policies.
- `lib/validation/`: shared Zod schemas.
- `prisma/`: schema, migrations, and non-sensitive development seed.
- `tests/`: unit, integration, authorization, and E2E coverage.

## Quality gate

Before declaring a phase complete, run the relevant focused tests. Before release, all of the following must pass:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Document deliberate limitations in `docs/TESTING.md` or `README.md`; do not hide them behind TODO comments.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
