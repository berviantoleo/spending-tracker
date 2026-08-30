# Spending Tracker — Implementation Plan

## Top-Level Overview

Build a **web-based spending tracker** that lets the user:
- Snap/upload a receipt image from any device (mobile or desktop)
- Have watsonx.ai automatically extract line items, total, merchant, date, and infer a spending category
- Manually correct or assign categories when AI confidence is low
- Track all spending with currency snapshots (foreign currency → base currency at time of transaction)
- View spending dashboards (by category, time range, currency breakdown)
- Manage custom categories on top of the pre-seeded standard set

### Tech Stack
| Layer | Technology |
|---|---|
| Front-end | React 19 + TypeScript 5.8 + Vite 7 |
| Back-end | Express 5 + TypeScript 5.8 (Node 26) |
| Database / Auth / Storage | Supabase (Postgres + Row-Level Security + Storage buckets) |
| AI | watsonx.ai — `meta-llama/llama-4-maverick-17b-128e-instruct-fp8` via `/ml/v1/text/chat` |
| Currency rates | Free public API (frankfurter.app) with manual fallback |
| Deployment | Local dev only (POC) — Supabase CLI local stack + Vite dev server + ts-node/nodemon |

### Confirmed Model Capabilities — `llama-4-maverick-17b-128e-instruct-fp8`
- **Multimodal** ✅ — officially described as a model for "text and image understanding" (MoE architecture).
- **Context window** — 131,072 tokens (input + output); max new tokens per request: 8,192.
- **API endpoint** — `POST /ml/v1/text/chat` (OpenAI-compatible `messages` format with `image_url` content parts).
- **Availability** — Multitenant (IBM-hosted, no dedicated deployment needed).
- **Model ID** for API calls — `meta-llama/llama-4-maverick-17b-128e-instruct-fp8`.
- **Image input format** — base64 data URI or public URL in the `image_url` message part.

> This model is **fully sufficient** for receipt parsing. No OCR pre-step needed — images can be sent directly.

### Processing Mode
- Receipt upload triggers an **optimistic background job** on the server.
- The UI shows a **spinner / "Processing…" badge** on the new receipt card.
- If the server responds within ~8 seconds the result is shown immediately (fast path).
- If processing exceeds 8 seconds the job continues in the background; the client polls via a lightweight status endpoint or Supabase Realtime subscription until the record is updated (slow path).
- This hybrid approach gives a snappy feel for simple receipts and graceful handling for large/complex ones.

### Currency Handling
- Each receipt stores: `original_amount`, `original_currency`, `base_amount`, `base_currency`, `fx_rate`, `fx_rate_source` (`"api"` or `"manual"`), `fx_rate_at` (timestamp).
- On upload the server fetches the spot rate from **frankfurter.app** and records it alongside the transaction (immutable snapshot — rate never changes after save).
- If the API call fails or the currency pair is unsupported, the UI prompts the user to enter the rate manually.
- The user can always override the stored rate (sets `fx_rate_source = "manual"`).

---

## Sub-Tasks

---

### Sub-Task 0 — First-Run Setup Wizard

**Intent**
On the very first login (after Supabase Auth confirms a new user), present a one-time setup screen that collects the user's base currency before they can upload any receipts. This ensures `user_preferences` is always populated before the AI or FX services need it.

**Expected Outcomes**
- `client/src/pages/SetupPage.tsx` — full-screen wizard with a searchable ISO 4217 currency picker (blank/empty default — no pre-selection) and a "Get started" CTA
- `client/src/hooks/useOnboarding.ts` — checks whether `user_preferences` exists for the current user; redirects to `/setup` if not
- After saving, user is redirected to `/dashboard` (the app's landing page after login)
- `user_preferences` row is created with the selected `base_currency`

**Todo List**
1. Build `client/src/pages/SetupPage.tsx` — single-step form: welcome copy, currency search-select (ISO 4217 list, blank default — must pick before proceeding), "Get started" button (disabled until a currency is selected).
2. On submit, call `POST /api/preferences` (create with selected currency) then navigate to `/dashboard`.
3. Create `client/src/hooks/useOnboarding.ts` — on mount after auth, fetches `GET /api/preferences`; if 404 or no `base_currency` set, redirects to `/setup`; otherwise continues.
4. Wrap the main router so that any protected route first checks `useOnboarding` before rendering.
5. Ensure `/setup` itself is only accessible to authenticated users (uses `RequireAuth`).

**Relevant Context**
- `user_preferences` table created in Sub-Task 7 — the `base_currency` column must allow NULL initially so the setup wizard can detect an unconfigured account.
- `user_preferences.base_currency` has **no default value** in the DB schema — the setup wizard is the only way to populate it.
- This sub-task can be built alongside Sub-Task 3 (Auth) since it shares the same page-routing layer.

**Status** — `[ ] pending`

---

### Sub-Task 1 — Repository & Tooling Bootstrap

**Intent**  
Create the monorepo skeleton (client + server) with TypeScript, ESLint, Prettier, and shared tsconfig so every subsequent sub-task has a consistent foundation.

**Expected Outcomes**
- `client/` — Vite + React 18 + TypeScript scaffold
- `server/` — Express + TypeScript scaffold with ts-node/nodemon dev setup
- Root `package.json` with workspaces (`client`, `server`)
- Shared `tsconfig.base.json`
- `.env.example` files for both client and server listing all required variables
- ESLint + Prettier config at root

**Todo List**
1. Create root `package.json` with `workspaces: ["client", "server"]` and dev scripts.
2. Scaffold `client/` manually (React 19, React Router 7, Vite 7, TypeScript 5.8).
3. Scaffold `server/` with `package.json`, `tsconfig.json`, `src/index.ts` (bare Express 5 server), and nodemon config.
4. Add shared `tsconfig.base.json` at root; extend from it in both workspaces.
5. Add ESLint (`@typescript-eslint`) + Prettier config at root.
6. Create `.env.example` for `server/` (SUPABASE_URL, SUPABASE_SERVICE_KEY, WATSONX_API_KEY, WATSONX_PROJECT_ID, WATSONX_URL, FX_API_BASE_URL).
7. Create `.env.example` for `client/` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL).
8. Add root `README.md` with setup instructions.

**Relevant Context**
- Greenfield — no existing files.
- Use Node 26 / npm 11.
- Package versions: React 19, React Router 7, Vite 7, TypeScript 5.8, Express 5, dotenv 17, @supabase/supabase-js 2, concurrently 10, prettier 3, @typescript-eslint 8.
- POC scope — no Docker, no CI/CD, no cloud deployment steps needed.
- Dashboard (`/dashboard`) is the root landing page after authentication + onboarding.

**Status** — `[ ] pending`

---

### Sub-Task 2 — Supabase Schema & Migrations

**Intent**  
Define all database tables, enums, indexes, RLS policies, and storage bucket configuration via Supabase migrations so the schema is version-controlled and repeatable.

**Expected Outcomes**
- `supabase/migrations/` directory with numbered SQL migration files
- Tables: `categories`, `receipts`, `receipt_items`, `currency_rates`
- Supabase Storage bucket: `receipts` (private, per-user path)
- RLS enabled on all tables with policies scoped to `auth.uid()`
- Seed file with the 8 standard categories

**Todo List**
1. Initialize Supabase CLI project (`supabase init`).
2. Write migration `001_schema.sql`:
   - `categories(id, user_id nullable, name, icon, color, is_system, created_at)` — `user_id NULL` = system category.
   - `receipts(id, user_id, merchant, receipt_date, original_amount, original_currency, base_amount, base_currency, fx_rate, fx_rate_source, fx_rate_at, category_id, status, image_path, raw_ai_response, notes, created_at, updated_at)` — `status` enum: `pending | processing | needs_review | done`.
   - `receipt_items(id, receipt_id, description, quantity, unit_price, total_price, created_at)`.
   - `currency_rates(id, from_currency, to_currency, rate, source, fetched_at)` — cache table.
3. Write migration `002_rls.sql`: enable RLS and add SELECT/INSERT/UPDATE/DELETE policies for `receipts`, `receipt_items`, and custom `categories` (user_id = auth.uid()); system categories readable by all.
4. Write migration `003_storage.sql`: create `receipts` storage bucket (private); add storage policy allowing authenticated user to read/write only their own path prefix.
5. Write seed `supabase/seed.sql`: insert 8 system categories (Food, Transport, Shopping, Health, Entertainment, Utilities, Travel, Other).
6. Document how to run migrations locally (`supabase start`, `supabase db reset`).

**Relevant Context**
- Supabase project and API keys already exist (user-provided via `.env`).
- Use `supabase-js` v2 in both client and server.
- Run locally via `supabase start` (Docker required for Supabase CLI local stack).

**Status** — `[ ] pending`

---

### Sub-Task 3 — Authentication (Supabase Auth)

**Intent**  
Implement sign-in / sign-up flows using Supabase Auth so the user can authenticate via email+password, Google OAuth, or magic link before accessing any protected data.

**Expected Outcomes**
- `client/src/pages/AuthPage.tsx` with three login methods selectable via tabs
- Supabase Auth session persisted in localStorage (handled by `supabase-js` automatically)
- `AuthContext` + `useAuth` hook for session state throughout the app
- Protected route wrapper `<RequireAuth>` that redirects unauthenticated users to `/auth`
- Server middleware `requireAuth` that validates the Supabase JWT on every protected API route

**Todo List**
1. Install `@supabase/supabase-js` in both `client` and `server`.
2. Create `client/src/lib/supabaseClient.ts` — initialise client with env vars.
3. Create `client/src/context/AuthContext.tsx` — expose `session`, `user`, `signOut`.
4. Build `client/src/pages/AuthPage.tsx` — email/password form, Google OAuth button, magic-link form. Use Supabase `signInWithPassword`, `signInWithOAuth`, `signInWithOtp`.
5. Create `client/src/components/RequireAuth.tsx` — checks session; redirects to `/auth` if absent.
6. Create `server/src/middleware/requireAuth.ts` — extracts Bearer token from `Authorization` header, calls `supabase.auth.getUser(token)`, attaches `req.user` or returns 401.
7. Configure Google OAuth redirect URL in Supabase Dashboard (document this in README).

**Relevant Context**
- Supabase handles token refresh automatically on the client side.
- Server uses the **service role key** for admin operations; `requireAuth` middleware uses the **anon key** to verify user tokens.

**Status** — `[ ] pending`

---

### Sub-Task 4 — Receipt Upload & Storage

**Intent**  
Allow the user to upload a receipt image (from camera or file picker) to Supabase Storage and create a `receipts` row with `status = "pending"`, triggering the processing pipeline.

**Expected Outcomes**
- `client/src/components/ReceiptUploader.tsx` — drag-and-drop + camera capture (via `<input capture="environment">`) component
- Server `POST /api/receipts/upload` endpoint that: accepts multipart/form-data, stores image to Supabase Storage under `{user_id}/{uuid}.{ext}`, inserts a `receipts` row with `status = "pending"`, then enqueues processing
- Returns the new receipt `id` immediately so the client can poll/subscribe

**Todo List**
1. Create `client/src/components/ReceiptUploader.tsx` — file input (accept `image/*`), preview thumbnail, upload progress bar, calls `POST /api/receipts/upload`.
2. Install `multer` in `server/` for multipart handling.
3. Create `server/src/routes/receipts.ts` — `POST /upload` handler: validate file type/size (max 10 MB), upload buffer to Supabase Storage, insert `receipts` row, call `processReceipt(receiptId)` without awaiting (fire-and-forget for slow path), respond with `{ id, status }`.
4. Create `server/src/services/storageService.ts` — thin wrapper around `supabase.storage.from("receipts").upload(...)` and `createSignedUrl(...)`.
5. Update `receipts` status to `"processing"` immediately before handing off to the AI service.

**Relevant Context**
- Supabase Storage path pattern: `{user_id}/{receiptId}.{ext}` — this matches the RLS storage policy from Sub-Task 2.
- `processReceipt` is defined in Sub-Task 5.

**Status** — `[ ] pending`

---

### Sub-Task 5 — watsonx.ai Receipt Parsing Service

**Intent**  
Call watsonx.ai (IBM foundation model) to extract structured data from a receipt image: merchant, date, line items, total, currency, and a suggested spending category. Store the raw response and parsed fields back onto the `receipts` row.

**Expected Outcomes**
- `server/src/services/watsonxService.ts` — encapsulates all watsonx.ai API calls
- `server/src/services/receiptProcessor.ts` — orchestrates: fetch image → call watsonx → parse JSON → update DB → trigger FX lookup
- Receipt row updated with extracted fields and `status = "done"` (or `"needs_review"` if confidence is low or category cannot be mapped)
- Raw AI JSON response saved to `receipts.raw_ai_response` for debugging

**Todo List**
1. Create `server/src/services/watsonxService.ts`:
   - `extractReceiptData(imageBase64: string): Promise<WatsonxReceiptResult>` — constructs a prompt with the base64 image, calls the watsonx.ai `text/generation` or `text_chat` endpoint using `ibm-watsonx-ai` SDK or direct REST (`axios`), instructs the model to respond in structured JSON.
   - Define the prompt to ask for: `{ merchant, date, currency, total, items: [{description, quantity, unit_price, total_price}], suggested_category, confidence }`.
   - Handle rate-limit / timeout errors gracefully (throw typed errors).
2. Create `server/src/services/receiptProcessor.ts`:
   - `processReceipt(receiptId: string, userId: string): Promise<void>`
   - Fetch signed URL for the image from Supabase Storage.
   - Download image, convert to base64.
   - Call `watsonxService.extractReceiptData(...)`.
   - Map `suggested_category` to a `category_id` from DB (fuzzy match on name).
   - If no match or `confidence < 0.7`, set `status = "needs_review"`.
   - Upsert `receipt_items` rows.
   - Call FX lookup service (Sub-Task 6) to populate `base_amount`, `fx_rate`, etc.
   - Update `receipts` row with all extracted fields and final status.
3. Add `WATSONX_MODEL_ID` to `.env.example` (e.g. `ibm/granite-vision-3-8b` or appropriate multimodal model).
4. Add unit-testable prompt template in `server/src/prompts/receiptExtraction.ts`.

**Relevant Context**
- watsonx.ai endpoint base URL and project ID come from env vars.
- **Confirmed model**: `meta-llama/llama-4-maverick-17b-128e-instruct-fp8` — multimodal, supports image input natively via the `/ml/v1/text/chat` endpoint using OpenAI-compatible `image_url` message parts.
- No OCR pre-step needed — the image (base64 data URI) is passed directly in the message payload.
- Max output tokens per request is 8,192 — sufficient for any single receipt.
- Prompt must instruct the model to respond **only** with a JSON object (no prose) to keep parsing simple.

**Status** — `[ ] pending`

---

### Sub-Task 6 — Currency Conversion Service

**Intent**  
Fetch the spot exchange rate at the moment a receipt is processed, store an immutable snapshot on the receipt row, and support manual override.

**Expected Outcomes**
- `server/src/services/fxService.ts` — fetches from frankfurter.app, caches in `currency_rates` table (TTL 1 hour), falls back gracefully
- Receipt row populated with `base_amount`, `fx_rate`, `fx_rate_source`, `fx_rate_at`
- `PATCH /api/receipts/:id/fx` endpoint to allow manual rate override from the UI

**Todo List**
1. Create `server/src/services/fxService.ts`:
   - `getRate(from: string, to: string, date?: string): Promise<FxResult>` — checks `currency_rates` cache first (within 1-hour TTL), calls `https://api.frankfurter.app/{date}?from={from}&to={to}` if stale, inserts new cache row, returns `{ rate, source: "api" | "cached" }`.
   - If API call fails, throw `FxUnavailableError` to signal the caller that manual input is needed.
2. In `receiptProcessor.ts`, call `fxService.getRate(original_currency, base_currency)` after extraction; on `FxUnavailableError` set `status = "needs_review"` with a flag indicating FX is missing.
3. Add `PATCH /api/receipts/:id/fx` in `server/src/routes/receipts.ts` — accepts `{ rate, currency }`, updates the receipt row with `fx_rate_source = "manual"`, recalculates `base_amount`.
4. In the client, detect `needs_review` status due to missing FX — show a modal asking the user to enter the rate manually, call the PATCH endpoint.

**Relevant Context**
- frankfurter.app is free, no API key required, supports historical rates by date (`/{YYYY-MM-DD}?from=X&to=Y`).
- `base_currency` comes from `user_preferences` (Sub-Task 7) — server fetches it before calling `getRate`.
- For POC, cache TTL of 1 hour is sufficient; no Redis needed — Postgres `currency_rates` table is the cache.

**Status** — `[ ] pending`

---

### Sub-Task 7 — User Preferences & Category Management

**Intent**  
Allow the user to configure their base currency and manage custom spending categories (add, rename, delete custom ones; system categories are read-only).

**Expected Outcomes**
- `user_preferences` table (`user_id PK, base_currency, created_at, updated_at`) via new migration
- `GET/PATCH /api/preferences` endpoints
- `GET /api/categories`, `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id` endpoints (delete only allowed for non-system categories)
- `client/src/pages/SettingsPage.tsx` — base currency selector + category CRUD UI

**Todo List**
1. Write migration `004_preferences.sql`: create `user_preferences(user_id UUID PK references auth.users, base_currency TEXT NOT NULL DEFAULT 'IDR', created_at, updated_at)`; add RLS.
2. Create `server/src/routes/preferences.ts` — `GET` returns preferences (creates row on first access with default IDR), `PATCH` updates `base_currency`.
3. Create `server/src/routes/categories.ts` — list (system + user's own), create, update, delete (guard: `is_system = false`).
4. Build `client/src/pages/SettingsPage.tsx`:
   - Currency selector (searchable dropdown of ISO 4217 codes).
   - Category list with add/edit/delete (inline or modal).
5. Expose `usePreferences` and `useCategories` hooks (`client/src/hooks/`).

**Relevant Context**
- `base_currency` from preferences is read by `fxService` during receipt processing — server must fetch it before calling `getRate`.
- System categories seeded in Sub-Task 2 have `is_system = true` and `user_id = NULL`.
- Setup wizard (Sub-Task 0) guarantees `user_preferences` exists before any receipt processing occurs.
- `user_preferences.base_currency` column is nullable in schema (no default) — server must handle NULL gracefully with a clear error message prompting re-setup.

**Status** — `[ ] pending`

---

### Sub-Task 8 — Receipt Review & Manual Correction UI

**Intent**
Give the user a review screen where they can confirm or correct AI-extracted fields (merchant, date, category, items, FX rate) for receipts in `needs_review` status, and view the full detail of any receipt.

**Expected Outcomes**
- `client/src/pages/ReceiptDetailPage.tsx` — displays image alongside extracted fields, all fields editable
- `client/src/components/ReviewBanner.tsx` — prominent CTA shown on cards with `needs_review` status
- `PATCH /api/receipts/:id` endpoint for field-level updates
- On save, `status` transitions to `"done"`
- `receipt_items` (individual line items) are **visible everywhere** — on receipt cards (collapsed/expandable), on the dashboard recent list, and in full on the detail page

**Todo List**
1. Create `server/src/routes/receipts.ts` `PATCH /:id` — accepts partial receipt fields, validates, updates row, sets `status = "done"` when user confirms.
2. Build `client/src/pages/ReceiptDetailPage.tsx`:
   - Left panel: receipt image (signed URL from server).
   - Right panel: editable form (merchant, date, category dropdown, notes, items table — all line items shown and editable).
   - FX section: shows rate + source badge; "Edit rate" opens inline input.
   - Save / Confirm button calls `PATCH /api/receipts/:id`.
3. Add `GET /api/receipts/:id` — returns receipt + items (joined) + signed image URL.
4. Build `client/src/components/ReceiptCard.tsx` — compact card for list views; shows merchant, total, category badge, `needs_review` badge; includes a collapsible line-items section showing all `receipt_items`.
5. Add Supabase Realtime subscription in the client: subscribe to `receipts` row changes for the current user to auto-refresh `status` from `processing → done/needs_review` without polling.

**Relevant Context**
- Signed URLs expire; generate them server-side on `GET /api/receipts/:id` with a 1-hour TTL.
- Supabase Realtime is enabled on the `receipts` table by enabling the `REPLICA IDENTITY FULL` on that table.

**Status** — `[ ] pending`

---

### Sub-Task 9 — Dashboard & Spending Analytics

**Intent**  
Show the user meaningful summaries of their spending: total by period, breakdown by category, currency distribution, and a searchable/filterable receipt list.

**Expected Outcomes**
- `client/src/pages/DashboardPage.tsx` — summary cards, category pie/bar chart, recent receipts list
- `client/src/pages/ReceiptsPage.tsx` — full paginated receipt list with filters (date range, category, currency, status)
- `GET /api/analytics/summary` endpoint — returns totals and category breakdown for a date range, in base currency
- `GET /api/receipts` endpoint — paginated list with query filters

**Todo List**
1. Create `server/src/routes/analytics.ts`:
   - `GET /summary?from=&to=` — SQL aggregation: `SUM(base_amount)` grouped by `category_id`, plus grand total and currency breakdown (`COUNT` + `SUM` per `original_currency`).
   - Include `receipt_items` counts in summary (total items purchased across period).
2. Create `server/src/routes/receipts.ts` `GET /` — paginated (`page`, `limit`), filterable (`category_id`, `status`, `from_date`, `to_date`, `currency`), ordered by `receipt_date DESC`; always JOIN and include `receipt_items` in the response.
3. Build `client/src/pages/DashboardPage.tsx` (root landing page `/dashboard` after login):
   - Period selector (This Week / This Month / Custom).
   - Total spend card (base currency).
   - Category breakdown — bar chart using `recharts`.
   - Currency breakdown chip list.
   - Recent receipts (last 5) — each using `ReceiptCard` with collapsible line items, with link to full `/receipts` page.
4. Build `client/src/pages/ReceiptsPage.tsx`:
   - Filter bar (date range picker, category multi-select, status filter).
   - Paginated `ReceiptCard` grid — each card shows collapsible line items.
   - Upload button opens `ReceiptUploader` modal.
5. Install `recharts` in `client/`.

**Relevant Context**
- All monetary aggregations use `base_amount` (in base currency) so charts are currency-consistent.
- `recharts` is lightweight and tree-shakeable.
- `receipt_items` must always be included in list and detail API responses — no separate endpoint needed for items.
- Dashboard is the app's root landing page (`/` redirects to `/dashboard` for authenticated users).

**Status** — `[ ] pending`

---

### Sub-Task 10 — Mobile-Optimised UX & PWA

**Intent**  
Make the web app installable and ergonomic on mobile so users can quickly snap and upload a receipt from their phone just like a native app.

**Expected Outcomes**
- PWA manifest + service worker (via `vite-plugin-pwa`) so the app can be installed on iOS/Android
- Responsive layout: bottom navigation bar on mobile, side navigation on desktop
- Camera capture button on the receipt upload component uses `capture="environment"` for rear camera
- "Add receipt" floating action button (FAB) always visible on mobile

**Todo List**
1. Install `vite-plugin-pwa` in `client/`; configure `vite.config.ts` with app name, icons, theme colour, `start_url`, `display: standalone`.
2. Create app icons (512×512 and 192×192 placeholder PNGs).
3. Build `client/src/components/Layout.tsx` — detects viewport width; renders `<BottomNav>` on mobile, `<SideNav>` on desktop.
4. Ensure `ReceiptUploader` `<input>` has `capture="environment"` on mobile (detect via `navigator.userAgent` or CSS media query).
5. Add FAB (`+` button) fixed to bottom-right on mobile that opens the upload modal.
6. Verify the app scores ≥ 90 on Lighthouse PWA audit (document this in README).

**Relevant Context**
- `vite-plugin-pwa` wraps Workbox and handles SW registration automatically.
- iOS Safari requires `apple-touch-icon` meta tags for home screen install.

**Status** — `[ ] pending`

---

## Processing Mode — Impact on UX

| Scenario | User Experience |
|---|---|
| Fast receipt (< 8 s) | Upload → spinner on card → fields auto-populated → "Done" badge. No extra steps. |
| Slow receipt (> 8 s) | Upload → card shows "Processing…" badge → user can navigate away → Supabase Realtime pushes update when done → badge changes to "Done" or "Review needed". |
| AI low confidence / unknown category | Status = `needs_review`. Yellow badge. User taps card → review screen with pre-filled suggestions. One tap to confirm or correct. |
| FX API unavailable | Status = `needs_review`. User prompted to enter rate manually in review screen. |

---

## Key Dependencies Between Sub-Tasks

```
Sub-Task 1 (Tooling)
  └── Sub-Task 2 (Schema)
        ├── Sub-Task 3 (Auth)
        │     ├── Sub-Task 0 (Setup Wizard)  [needs Auth + Preferences API]
        │     └── Sub-Task 4 (Upload)
        │           └── Sub-Task 5 (watsonx AI)
        │                 └── Sub-Task 6 (FX)
        ├── Sub-Task 7 (Preferences + Categories)  [API needed by Sub-Task 0 and Sub-Task 6]
        └── Sub-Task 8 (Review UI)  [needs 4, 5, 6, 7]
              └── Sub-Task 9 (Dashboard)
                    └── Sub-Task 10 (PWA / Mobile)
```

## Implementation Order
1 → 2 → 3 → 7 → 0 → 4 → 5 → 6 → 8 → 9 → 10
