<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# cco-platform AGENTS

The Next.js 16 portal that replaces the Zenforo-based legacy CCO exam tool. This file is the operating contract for the **`cco-platform/` repo specifically**. Workspace-level context (sub-projects, Podio app IDs, identity model, milestones, task discipline) lives in [`../AGENTS.md`](../AGENTS.md).

## Source Order

When asked "where are we" inside this repo, check in order:

1. [`../CONTINUITY.md`](../CONTINUITY.md) - workspace decision/Done/Now/Next ledger.
2. [`../agents-tasks-knowledge/SESSION.md`](../agents-tasks-knowledge/SESSION.md) - active session rollup.
3. [`../agents-tasks-knowledge/tasks/tasks.md`](../agents-tasks-knowledge/tasks/tasks.md) - task register.
4. This file (`cco-platform/AGENTS.md`) - repo-specific rules.
5. `git log` (this folder is the actual git repo; the workspace parent is not).

## Repo Constraints

- **Next.js**: 16.2.3 with App Router. The `BEGIN:nextjs-agent-rules` block above is the load-bearing rule - this is not the Next.js in training data. Read `node_modules/next/dist/docs/` before writing any new pattern (route handlers, layouts, fetching, caching, params).
- **React**: 19.2.4.
- **Tailwind CSS**: v4 (note: v4, not v3 - PostCSS plugin is `@tailwindcss/postcss`, config style differs from v3).
- **Database**: Neon Postgres via `@neondatabase/serverless`. Drizzle ORM (`drizzle-orm` + `drizzle-kit`) for schema and queries.
- **Auth crypto**: `bcryptjs` for password hashing; `jose` (preferred) and `jsonwebtoken` (legacy) both present for JWTs.
- **PDF**: `@react-pdf/renderer` for CEU certificates (rendered from React); `pdf-lib` for legacy AAPC certificate overlay (per-event source PDF, never a generic template - see workspace AGENTS).

## Verification commands

Run from inside this folder (`cco-platform/`).

| Goal | Command | Notes |
| --- | --- | --- |
| Lint | `npm run lint` | eslint, no args; uses `eslint-config-next` |
| Build (also type-checks) | `npm run build` | `next build` - blocks on TS errors |
| Type-check only | `npx tsc --noEmit` | No dedicated npm script |
| Dev server | `npm run dev` | `next dev` |
| Start prod build locally | `npm run start` | After `npm run build` |
| Drizzle schema gen / migrate | `npx drizzle-kit ...` | See `drizzle-kit` docs for the correct subcommand against the current config |
| Live smoke | open `https://cco-platform.vercel.app` after push | Auto-deploys from `master`, ~30s build |

There is no test runner configured. If a task requires automated tests, add one (`vitest` + `@testing-library/react` is the natural fit for this stack) and document the choice as a decision in `../CONTINUITY.md`.

## Repo Conventions

- **Server components by default.** Mark client components explicitly with `"use client"` only when needed for interactivity (form state, event handlers, browser APIs).
- **Podio is server-side only.** No Podio access tokens, app tokens, or signing material in browser bundles. All Podio calls go through `src/lib/podio.ts`.
- **Write-through pattern.** Mutations: write to Podio first, then update the Neon mirror. Reads: serve from the mirror, refresh from Podio in the background (stale-while-revalidate).
- **No new top-level abstractions without need.** Three similar lines beats a premature helper. Add helpers in `src/lib/` when the third caller materializes.
- **Brand**: purple `#815481`, green `#89bd40`. Body font Manrope, headings Sora. Use `"CCO Academy"` in user-facing copy, never `"CCO Certificate"`.
- **Test on live, not localhost** for changes that depend on real Podio data: commit + push, verify on the Vercel deploy.

## File Structure

```
cco-platform/
├── src/
│   ├── app/
│   │   ├── (authenticated)/    Pages behind sign-in (gradebook, exam, catalog)
│   │   ├── api/                Route handlers (sso, certificates, etc.)
│   │   └── ...
│   ├── components/
│   │   └── gradebook/          PastResults, Scorecard, etc.
│   └── lib/
│       ├── podio.ts            Podio API client
│       ├── db.ts               Neon database client
│       ├── schema.ts           Drizzle schema (ceu_items, certificates, ...)
│       ├── auth.ts             Email + password auth
│       ├── sso.ts              Circle SSO callback
│       ├── exam.ts             Exam engine (timer, state, scoring)
│       ├── certificate.ts      CEU certificate metadata + verification codes
│       ├── certificate-pdf.tsx Render CEU cert via @react-pdf/renderer
│       ├── certificate-aapc.ts Overlay name+date onto legacy AAPC PDF
│       ├── legacy-results.ts   Query Test Results app 16234798 by student
│       └── sync.ts             Mirror sync helpers
├── scripts/                    Migration / probe utilities (.mjs, mostly untracked)
├── package.json                Scripts: dev, build, start, lint
├── CLAUDE.md                   `@AGENTS.md`
└── AGENTS.md                   This file
```

## Risk Hot Spots

These areas should get extra audit attention:

- **`src/lib/auth.ts` and `src/lib/sso.ts`** - production sessions; mistakes lock out students.
- **`src/lib/podio.ts` write paths** - any write that bypasses the write-through pattern can desync the mirror.
- **`src/lib/legacy-results.ts`** - query filter mistakes can leak another student's history (P1).
- **`src/app/api/legacy-certificate/[podioItemId]/route.ts`** - authorization mistakes can return another student's certificate (P1).
- **Podio category field updates** - settings at TOP LEVEL, never nested in `config` (postmortem 2026-04-09 in `../CONTINUITY.md`).
