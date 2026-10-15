# TNB (The Nook Bite) — Customer Website

Marketing + menu site for **The Nook Bite** — a local Pakistani restaurant in Mandi Bahauddin. Customers browse the menu, fill a cart, and place the order via **WhatsApp**. Menu items and categories live in **Supabase** and are managed from an owner-only `/admin` panel.

## Project Structure

```
/thenookbite
  /customer-web      → Next.js 14
  /db                → Supabase schema/seed/migrations
```

## How Ordering Works

1. Customer browses `/menu`, adds items to cart (Zustand, persisted in localStorage)
2. Cart → `/checkout` — fills name, phone, delivery/pickup, address, notes
3. Opens `wa.me/923279627442` with a prefilled message: items, quantities, total, and customer details
4. The restaurant confirms the order in WhatsApp — no payment or account needed

The WhatsApp number lives in `customer-web/lib/whatsapp.ts` (`WHATSAPP_NUMBER`).

## Admin Panel

`/admin` — owner-only, Supabase Auth email login. Two sections:

- **Menu items** — search/filter, toggle availability, edit price/name/description, add/delete SKUs (sizes & cheese variants are separate SKUs)
- **Categories** — rename (moves items via `rename_menu_category` RPC), relabel, reorder, add/delete

### Setup

1. In Supabase SQL Editor, run: `db/schema.sql` → `db/seed.sql` → `db/menu_categories.sql` → `db/admin_menu_write.sql` (skip files already applied)
2. Supabase Dashboard → Authentication → Users → **Add user** with the owner email + password (keep public signups disabled)
3. Set env vars (below)

## Environment Variables (`customer-web/.env.local` + Vercel project settings)

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # anon/public key — safe to expose, RLS protects writes
NEXT_PUBLIC_ADMIN_EMAIL=         # owner email; extra client-side gate for /admin
```

Without these vars the site still works — it falls back to the static menu in `lib/menuData.ts`.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Cart | Zustand (client-side only) |
| Menu data | Supabase `menu_items` + `menu_categories` (static `lib/menuData.ts` fallback) |
| Images | Unsplash via `lib/itemImages.ts` + `public/` assets |
| Deployment | Vercel |

## Pages

| Route | Description |
|---|---|
| `/` | Homepage — hero, deals, category grid |
| `/menu` | Full menu with category filter + search |
| `/cart` | Cart review → checkout |
| `/checkout` | Customer details → WhatsApp order |
| `/admin` | Owner panel — menu + category management |
| `/admin/login` | Owner sign-in |

## Run Locally

```bash
cd customer-web
npm install
npm run dev
# → http://localhost:3000
```

## Deploy to Vercel

1. Import this repo at [vercel.com/new](https://vercel.com/new)
2. **Root Directory:** set to `customer-web` (Project Settings → General)
3. Add the three env vars above in Project Settings → Environment Variables
4. Deploy
