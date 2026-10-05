# TNB (The Nook Bite) — Restaurant Ordering System

Full-stack online ordering system for **The Nook Bite** — a local Pakistani restaurant in Mandi Bahauddin.

## Project Structure

```
/Thenookbite
  /customer-web      → Next.js 14 — customer site + all API routes + admin panel + kitchen display
  /db                → schema.sql + seed.sql
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
| Realtime | Supabase Realtime (kitchen + admin live updates) |
| Storage | Supabase Storage (menu item images) |
| Deployment | Hostinger Node.js hosting |

## Apps (all inside `/customer-web`)

| URL | Description |
|---|---|
| `thenookbite.com` | Customer ordering site |
| `admin.thenookbite.com` | Owner admin panel (subdomain routing via middleware) |
| `kitchen.thenookbite.com` | Kitchen display screen (subdomain routing via middleware) |

## Database Setup

1. Create a Supabase project
2. SQL Editor → run [db/schema.sql](db/schema.sql)
3. SQL Editor → run [db/seed.sql](db/seed.sql) — loads all 139 menu items

## Run Locally

```bash
cd customer-web
cp .env.example .env.local
# fill in .env.local — see below
npm install
npm run dev
# customer site  → http://localhost:3000
# admin panel    → http://localhost:3000/admin
# kitchen        → http://localhost:3000/kitchen
```

## Environment Variables

Create `customer-web/.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=        # service_role key — server only, never exposed to browser

# Admin
ADMIN_EMAIL=owner@thenookbite.com
NEXT_PUBLIC_ADMIN_EMAIL=owner@thenookbite.com
```

> `NEXT_PUBLIC_*` vars are inlined at build time — rebuild after changing them.

## Deploy to Hostinger (Node.js Hosting)

1. Build:
   ```bash
   cd customer-web
   npm install
   npm run build
   ```

2. In Hostinger hPanel → Node.js → Create Application:
   - Node version: **18 or 20**
   - Application root: `customer-web`
   - Startup file: `start.js`

3. Upload via FTP or File Manager:
   ```
   .next/
   public/
   node_modules/
   package.json
   start.js
   ```

4. Add environment variables in hPanel → Node.js → Environment (same as `.env.local` above)

5. In Hostinger → Subdomains:
   - `admin.thenookbite.com` → point to same Node.js app
   - `kitchen.thenookbite.com` → point to same Node.js app

6. Start the app — middleware handles subdomain routing automatically

## Uptime (prevent Supabase free tier sleep)

Set up a free monitor on [uptimerobot.com](https://uptimerobot.com):
- URL: `https://thenookbite.com/api/menu`
- Interval: every 5 minutes

## Admin Panel

Visit `admin.thenookbite.com` (or `localhost:3000/admin` in dev).

| Route | Description |
|---|---|
| `/admin/login` | Owner sign in |
| `/admin` | Dashboard — today's orders + revenue |
| `/admin/orders` | Live order board with realtime updates |
| `/admin/orders/[id]` | Order detail + update status |
| `/admin/menu` | All menu items — toggle available/sold out |
| `/admin/menu/[id]` | Edit item name, price, description, image, deal |

## API Routes

All backend logic lives in `customer-web/app/api/`:

| Method | Route | Description |
|---|---|---|
| GET | `/api/menu` | All available menu items |
| PATCH | `/api/menu/[id]` | Update item details |
| PATCH | `/api/menu/[id]/availability` | Toggle available |
| POST | `/api/orders` | Create order |
| GET | `/api/orders` | List orders |
| GET | `/api/orders/[id]` | Single order |
| PATCH | `/api/orders/[id]/status` | Update order status |
| GET | `/api/me` | Current user profile |
