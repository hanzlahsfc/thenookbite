# TNB (The Nook Bite) — Customer Ordering Website

Full-stack online ordering site for **The Nook Bite** — a local Pakistani restaurant in Mandi Bahauddin. This repo contains the customer-facing website only.

## Project Structure

```
/thenookbite
  /customer-web      → Next.js 14 — customer site + API routes
  /db                → schema.sql + seed.sql + migrations
  CLAUDE.md          → full spec and coding rules
  MILESTONES.md      → sprint plan
```

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (no separate server) |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime (live order status updates) |
| Images | Unsplash + `public/` assets; `next/image` optimized |
| Deployment | Vercel |

## Pages

| Route | Description |
|---|---|
| `/` | Homepage — hero, deals, category grid |
| `/menu` | Full menu with category filter + search |
| `/cart` | Cart review |
| `/checkout` | Name, phone, notes, payment method |
| `/order-confirmation` | Success page with order ID |
| `/order-status` | Live order tracking |
| `/my-orders` | Order history (logged in) |
| `/login`, `/signup`, `/forgot-password` | Auth |
| `/profile` | Customer profile |
| `/careers` | Job application form |

## Database Setup

1. Create a Supabase project
2. SQL Editor → run [db/schema.sql](db/schema.sql)
3. SQL Editor → run [db/all_migrations.sql](db/all_migrations.sql) — safe to run on a fresh DB
4. SQL Editor → run [db/seed.sql](db/seed.sql) — loads all 139 menu items

Menu item images resolve automatically by item name via `customer-web/lib/itemImages.ts` — no image uploads needed.

## Run Locally

```bash
cd customer-web
cp .env.example .env.local
# fill in .env.local — see below
npm install
npm run dev
# → http://localhost:3000
```

## Environment Variables

Create `customer-web/.env.local` (see `.env.example`):

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=        # service_role key — server only, never exposed to browser

# Order + careers notifications
ADMIN_EMAIL=owner@thenookbite.com
RESEND_API_KEY=              # optional — careers form email
EMAIL_DOMAIN=thenookbite.com

# Optional — rate limiting via Upstash (skipped when unset)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional — Sentry error monitoring
NEXT_PUBLIC_SENTRY_DSN=
```

> `NEXT_PUBLIC_*` vars are inlined at build time — rebuild/redeploy after changing them.

## Deploy to Vercel

1. Import this repo at [vercel.com/new](https://vercel.com/new)
2. **Root Directory:** set to `customer-web` (Project Settings → General)
3. Add the environment variables above (Project Settings → Environment Variables)
4. Deploy — Vercel auto-detects Next.js, no other config needed

> The Supabase env vars must be present at build time — prerendering pages fails without them.

## Uptime (prevent Supabase free tier sleep)

Set up a free monitor on [uptimerobot.com](https://uptimerobot.com):
- URL: `https://your-domain.com/api/menu`
- Interval: every 5 minutes

## API Routes

All backend logic lives in `customer-web/app/api/`:

| Method | Route | Description |
|---|---|---|
| GET | `/api/menu` | Available menu items (filter: `?category=`) |
| POST | `/api/orders` | Create order |
| GET | `/api/orders/[id]` | Single order |
| GET | `/api/orders/[id]/items` | Order line items |
| PATCH | `/api/orders/[id]/status` | Update status (e.g. customer cancel) |
| GET | `/api/display` | Public preparing/ready board |
| GET | `/api/me` | Current user profile |
| POST | `/api/careers` | Job application (emails owner via Resend) |
| GET | `/api/health` | Health check |
