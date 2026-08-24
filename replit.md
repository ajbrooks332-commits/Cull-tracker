# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) with Expo Router

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── deer-cull/          # Expo mobile app (Deer Culling Records)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## App: Deer Culling Records (`artifacts/deer-cull`)

An estate deer culling management mobile app with:
- GPS-tracked map with colour-coded deer markers by species/sex
- Full deer cull record logging: species, sex, weight (optional/updatable later), body condition, pregnancy status, auto timestamp
- Edit/delete records
- PDF export filtered by stalker and/or season (includes stalker column)
- Stalker sign-in: PIN-based auth (4-digit), records tagged to logged-in stalker
- Seasons: Nov 1 – Oct 31 (e.g. 2024/25), records filterable by season
- Admin role: admins can manage (add/edit/delete) stalker accounts

### Deer Record Fields
- **Species**: Red Deer, Roe Deer, Fallow Deer, Sika Deer, Muntjac, Chinese Water Deer
- **Sex**: Stag/Hind (Red/Sika) or Buck/Doe (Roe/Fallow/Muntjac/CWD)
- **Weight**: Optional, can be added/updated after initial logging
- **Condition**: Excellent / Good / Fair / Poor
- **Pregnant**: Shown only for female animals
- **Location**: GPS (auto from device) or manual lat/lng entry
- **Notes**: Free text field

### Marker Colours (by species/sex)
- Red Deer Stag: dark red `#8B1A1A`
- Red Deer Hind: soft red `#C45C5C`
- Roe Deer Buck: dark green `#2D6A1A`
- Roe Deer Doe: light green `#6BAF3A`
- Fallow Deer Buck: dark blue `#1A5C8B`
- Fallow Deer Doe: light blue `#5C9FC4`
- Sika Deer Stag: dark purple `#6B1A8B`
- Sika Deer Hind: light purple `#A45CC4`
- Muntjac Buck: dark amber `#8B5A1A`
- Muntjac Doe: light amber `#C49A5C`
- Chinese Water Deer Buck: dark teal `#1A6B6B`
- Chinese Water Deer Doe: light teal `#5CB8B8`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing (limit `25mb` — assessments include base64 photos), routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers
  - `health.ts` — GET /healthz (public)
  - `stalkers.ts` — stalker list (public), login (public, rate-limited, lockout after 5 fails), bootstrap (public, only when 0 stalkers), create/update/delete (requireAdmin)
  - `culls.ts` — all endpoints require `requireAuth` session middleware
  - `assessments.ts` — all endpoints require `requireAuth`. POST/PUT use a `pickAssessmentFields` whitelist (`ASSESSMENT_COLUMNS`) to drop unknown keys before insert/update so legacy client fields like `racksInWoodTallies` / `racksEdgeTallies` / `saplingsGroupTallies` / `stalkerName` cannot crash the SQL insert (root cause of the offline-sync stuck-forever bug)
- Security: `src/middlewares/session.ts` — in-memory session store, UUID tokens, 8h TTL, auto-expiry
- Security: helmet (HTTP headers), express-rate-limit (20 login/15min, 300 req/min global), CORS configurable via ALLOWED_ORIGINS env var
- PINs stored as bcrypt hashes (12 rounds), 4-digit PINs with server-side format validation
- Account lockout: 5 failed attempts → 15-minute lockout, stored in DB (failedAttempts, lockedUntil columns)
- Depends on: `@workspace/db`, `@workspace/api-zod`, `bcryptjs`, `helmet`, `express-rate-limit`, `zod`

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `src/schema/culls.ts` — cullsTable with stalkerId FK, species/sex/weight/condition/pregnant/lat/lng/notes
- `src/schema/stalkers.ts` — stalkersTable with name, pin, isAdmin
- Enums: speciesEnum, sexEnum, conditionEnum

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `artifacts/deer-cull-web` (`@workspace/deer-cull-web`)

React + Vite web app. This is the **primary interface** — works directly in a mobile browser, no Expo Go required. Preview path: `/web/`.
- `src/pages/Login.tsx` — PIN-based stalker sign-in, first-time setup flow
- `src/pages/MapPage.tsx` — Interactive Leaflet map (Esri satellite/OSM), GPS, coloured markers, click-to-log
- `src/pages/RecordsPage.tsx` — Records list with season/stalker filters, search, PDF export, **cull-plan progress strip** (estate-wide, unfiltered by stalker), **per-stalker / per-block / avg-weight summary stats**
- `src/pages/AssessmentsPage.tsx` — Habitat-impact assessments list/detail/edit, season selector, **block + recorder filters**, **year-on-year comparison panel**, PDF export with **2x2 photo grid + static survey-route map**
- `src/pages/Admin.tsx` — Admin panel: manage stalker accounts
- `src/components/CullForm.tsx` — Log/edit cull modal (species, sex, weight, condition, pregnancy, GPS, notes), **larder-tag field**, **out-of-season warning**, **active-session auto-link banner**
- `src/components/CullDetailSheet.tsx` — View/edit/delete detail drawer
- `src/components/Layout.tsx` — App shell with navigation (bottom tabs: Map, Records, Sessions, Assess, Help)
- `src/hooks/use-api.ts` — fetch-based API hooks (useCulls, useStalkers, useLoginStalker, useCullPlans, useUpdateAssessment, etc.)
- `src/hooks/use-auth.tsx` — Auth context: stalker stored in localStorage
- `src/hooks/use-offline-sync.ts` — IndexedDB queue flush + invalidates both `["culls"]`/`["assessments"]` and `["/api/...]` query keys after sync. Exposes `syncError`; failures (any 4xx/5xx from API) surface as a red **"N stuck"** badge in `Layout.tsx` so silent infinite retries can no longer hide bad payloads.
- `src/lib/offlineQueue.ts` — `flushQueue` / `flushAssessmentQueue` return `{ succeeded, failed, lastError }` so the hook can detect persistent failures (previously errors were silently swallowed and `attempts` incremented forever).
- `src/lib/constants.ts` — Species/sex marker colours, season utilities, labels, open-season ranges with `isInOpenSeason` / `formatOpenSeasonRange` helpers
- `src/lib/draftStore.ts` — Assessment draft persistence with localStorage → IndexedDB fallback (`saveDraft` / `loadDraft` / `clearDraft`)
- `src/lib/pdf.ts` — jsPDF + jspdf-autotable PDF export (summary stats + full records table, includes **larder column**, **per-stalker / per-block summary tables**, **High-impact red highlighting** via `didDrawCell`)

### `lib/db/src/schema/culls.ts` — Cull Plans

In addition to `cullsTable`, this file exports `cullPlansTable` (id, seasonStartYear, species, sex, target, notes) for tracking estate culling targets per species/sex per **plan year**. The cull endpoints in `artifacts/api-server/src/routes/culls.ts` mount `/cull-plans` (GET/POST/PUT/DELETE) alongside `/culls`. The `cullsTable` also has `sessionId` and `larderTag` columns for tagging culls with the active stalking session and the larder reference number.

### Plan Year vs Record Season

Two distinct year windows coexist:
- **Record season** — Nov 1 → Oct 31 (`getCurrentSeasonYear`, `formatSeasonLabel`, `getAvailableSeasons`). Used for filtering the records list, sessions, assessments, and PDF "Season" headers.
- **Plan year** — May 1 → Apr 30 (`getCurrentPlanYear`, `formatPlanYearLabel`, `getPlanYearRange`, `isInPlanYear`, `getAvailablePlanYears`). Used **only** by the Cull Plan progress strip on RecordsPage. Targets stored in `cullPlansTable.seasonStartYear` are interpreted as the May year (e.g. `2025` = May 2025 → Apr 2026). Cull-plan progress counts estate-wide culls inside the May→Apr window of the selected plan year, independent of the record-season selector.

### `artifacts/deer-cull` (`@workspace/deer-cull`)

Expo mobile app.
- `app/(tabs)/index.tsx` — Map screen (native: react-native-maps)
- `app/(tabs)/index.web.tsx` — Web fallback for Map screen
- `app/(tabs)/records.tsx` — Records list with search
- `components/CullMarker.tsx` — Coloured map markers with callouts
- `components/CullForm.tsx` — Add/Edit deer cull modal
- `components/CullDetailSheet.tsx` — View/edit/delete detail sheet
- `components/MapLegend.tsx` — Expandable map legend
- `components/MapWebFallback.tsx` — Web placeholder for map
- `hooks/useCulls.ts` — React Query hooks for API
- `utils/markerColors.ts` — Colour mapping for species/sex
- `utils/pdf.ts` — PDF generation and sharing
- `constants/types.ts` — TypeScript types and labels
- `constants/colors.ts` — Forest green theme with species colours
