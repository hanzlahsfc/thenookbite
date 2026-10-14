# TNB (The Nook Bite) — Customer Website

Static marketing + menu site for **The Nook Bite** — a local Pakistani restaurant in Mandi Bahauddin. No backend, no database, no accounts — customers browse the menu, fill a cart, and place the order via **WhatsApp**.

## Project Structure

```
/thenookbite
  /customer-web      → Next.js 14 — static site
  /db                → original Supabase schema/seed (kept for reference)
```

## How Ordering Works

1. Customer browses `/menu`, adds items to cart (Zustand, persisted in localStorage)
2. Cart page → **ORDER VIA WHATSAPP** button
3. Opens `wa.me/923279627442` with a prefilled message listing items, quantities, and total
4. The restaurant confirms the order in WhatsApp — no payment or account needed

The WhatsApp number lives in `customer-web/lib/whatsapp.ts` (`WHATSAPP_NUMBER`).

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Cart | Zustand (client-side only) |
| Menu data | Static — `customer-web/lib/menuData.ts` (generated from `db/seed.sql`) |
| Images | Unsplash via `lib/itemImages.ts` + `public/` assets |
| Deployment | Vercel |

## Pages

| Route | Description |
|---|---|
| `/` | Homepage — hero, deals, category grid |
| `/menu` | Full menu with category filter + search |
| `/cart` | Cart review → WhatsApp order button |

## Updating the Menu

Edit `customer-web/lib/menuData.ts` — items are `MENU_ITEMS`, categories are `CATEGORIES`. Item images resolve automatically by name via `lib/itemImages.ts`; add a new entry there if an item has no photo.

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
3. Deploy — no environment variables needed
