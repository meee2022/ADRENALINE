# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Adrenaline Meals Manager** — a full-stack meal plan management system for gym subscribers. Supports Arabic (RTL) and English (LTR) with role-based access for staff and customers.

## Commands

```bash
npm run dev          # Start Express server (port 5000) with Vite middleware for development
npm run dev:client   # Vite-only dev server (port 5000) — use if working frontend-only
npm run build        # Build client (Vite → dist/public/) + server (esbuild → dist/index.cjs)
npm run start        # Run production build
npm run check        # TypeScript type check (no emit)
npm run db:push      # Apply Drizzle schema changes to PostgreSQL
```

There is no test suite configured.

## Architecture

This project has **two parallel backends** that coexist:

1. **Convex** (`convex/`) — the primary backend used by the React frontend. Provides real-time subscriptions, authentication, and all core data operations. The Convex deployment URL is set via `VITE_CONVEX_URL`.

2. **Express + Drizzle/PostgreSQL** (`server/`) — a secondary REST API at `/api/*`. Currently handles supplemental endpoints. Schema lives in `shared/schema.ts`; migrations in `migrations/`.

Most frontend data fetching goes through Convex queries/mutations (via `@convex-dev/react`), not the Express API.

### Frontend (`client/src/`)

- **Routing**: Wouter (`App.tsx`). Public routes under `/public/` and `/customer/`; protected routes require auth via Zustand store.
- **State**: Zustand (`lib/store.ts`) holds `currentUser` (staff) and `currentCustomer`. TanStack Query handles server state for the Express API.
- **i18n**: Context-based (`lib/i18n.tsx`). All UI strings are bilingual Arabic/English; direction (`dir`) is toggled on the root element.
- **UI**: shadcn/ui components in `components/ui/`. Import from there, not from Radix directly.
- **Path alias**: `@/` maps to `client/src/`; `@shared/` maps to `shared/`.

### Convex Schema (`convex/schema.ts`)

Core tables: `users` (staff), `customerAccounts`, `customers`, `mealCategories`, `menuItems`, `addons`, `modifiers`, `dailyPlans`, `inventoryItems`, `suppliers`.

Daily plan status flow: `DRAFT → CONFIRMED → PREPARED → DELIVERED`.

Staff roles: `ADMIN`, `KITCHEN`, `DELIVERY`, `NUTRITIONIST`, `INVENTORY_MANAGER`.

### Authentication (`convex/auth.ts`)

Single `authenticateUnified` mutation handles both staff and customer login. Returns `{ accountType: "staff", user }` or `{ accountType: "customer", customer }`. The Zustand store's `login()` / `customerLogin()` methods persist the session.

### Build

Server is bundled with esbuild (`script/build.ts`) into a single CJS file. Dependencies are explicitly allowlisted in that script — if you add a new server-side npm package, add it to the external/bundle list there.

## Key Environment Variables

```
VITE_CONVEX_URL        # Convex deployment URL (required for frontend)
CONVEX_DEPLOYMENT      # dev:rightful-parakeet-660 (local Convex dev)
DATABASE_URL           # PostgreSQL connection string (for Express/Drizzle)
PORT                   # Server port (default 5000)
```
