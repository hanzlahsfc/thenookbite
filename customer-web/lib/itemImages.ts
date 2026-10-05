import type { Category } from '@/lib/types';

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=75`;

// Per-item images keyed by lowercased item name.
// Size suffixes (" - Small", " - Large", etc.) and cheese variants
// ("(No Cheese)", "(Cheese)") are stripped before lookup so one entry
// covers all variants of the same item.
const BY_NAME: Record<string, string> = {
  // ── APPETIZERS ──────────────────────────────────────────────────────
  '10 x wings':                U('1608039755401-742074f0548d'),
  '10 x nuggets':              U('1562967914-608f82629710'),
  'chicken piece':             U('1626645738196-c2a7c87a8f58'),
  'broast (4 pcs)':            U('1626645738196-c2a7c87a8f58'),
  '10 x oven baked wings':     U('1527477396000-e27163b481c2'),
  'small plain fries':         U('1573080496219-bb080dd4f877'),
  'medium plain fries':        U('1573080496219-bb080dd4f877'),
  'large plain fries':         U('1573080496219-bb080dd4f877'),
  'pizza faries':              U('1513104890138-7c749659a591'),
  'loaded fries':              U('1630384060421-cb20d0e0649d'),
  // nuggets & strips
  'arabian nuggets':           U('1562967914-608f82629710'),
  'tempura nuggets':           U('1562967914-608f82629710'),
  'simple nuggets':            U('1562967914-608f82629710'),
  'arabian fillet nuggets':    U('1562967914-608f82629710'),
  'crispy chicken strips':     U('1626645738196-c2a7c87a8f58'),
  'spicy chicken strips':      U('1626645738196-c2a7c87a8f58'),
  'spicy chicken donnet':      U('1562967914-608f82629710'),
  'chick n cheese paratha':    U('1476224203421-9ac39bcb3327'),
  'chicken spring rolls':      U('1548943487-a2e4e43b4853'),
  // prepared dishes
  'kung pao chicken':          U('1525755662778-989d0524087e'),
  'noodles / ramen':           U('1546069901-ba9599a7e63c'),
  'chowmein':                  U('1546069901-ba9599a7e63c'),
  'crispy poppers / hotshots': U('1562967914-608f82629710'),
  'chicken honey donnet':      U('1562967914-608f82629710'),
  'aqua buddies (kids)':       U('1562967914-608f82629710'),
  'egg fried rice + shashlik': U('1563245372-f21724e3856d'),
  'egg fried rice + cream bites': U('1563245372-f21724e3856d'),

  // ── BURGERS ─────────────────────────────────────────────────────────
  'ch tikka burger':           U('1568901346375-23c9450c58cd'),
  'petti burger':              U('1571091718767-18b5b1457add'),
  'zinger burger':             U('1568901346375-23c9450c58cd'),
  'grill burger':              U('1571091718767-18b5b1457add'),
  'tower burger':              U('1586190848861-99aa4a171e90'),
  'double decker burger':      U('1550317138-10000687a72b'),
  'pizza burger':              U('1571091718767-18b5b1457add'),
  'crispy petti burger':       U('1571091718767-18b5b1457add'),
  'lava burger':               U('1550317138-10000687a72b'),
  'special tikka burger':      U('1568901346375-23c9450c58cd'),

  // ── FOOD BANK ────────────────────────────────────────────────────────
  'kabab bite pizza':          U('1565299624946-b28f40a0ae38'),
  'crown star pizza':          U('1604068549290-dea0e4a305ca'),
  'crown crust pizza':         U('1604068549290-dea0e4a305ca'),
  'kabab crust pizza':         U('1565299624946-b28f40a0ae38'),
  'cheese crust pizza':        U('1593560708920-61dd98c46a4e'),
  'behari kabab pizza':        U('1565299624946-b28f40a0ae38'),

  // ── PASTAS ────────────────────────────────────────────────────────────
  'hunger crave special pasta': U('1551183053-bf91a1d81141'),
  'regular pasta':             U('1621996346565-e3dbc646d9a9'),
  'creamy pasta':              U('1645112411341-6c4fd023714a'),
  'lasagna':                   U('1574894709920-11b28e7367e3'),
  'crunchy pasta':             U('1563379926898-05f4575a45d8'),

  // ── PIZZA REGULAR v1 ─────────────────────────────────────────────────
  'chicken tikka pizza':       U('1513104890138-7c749659a591'),
  'chicken fajita pizza':      U('1574071318508-1cdbab80d002'),
  'chicken supreme pizza':     U('1574071318508-1cdbab80d002'),
  'tandoori pizza':            U('1513104890138-7c749659a591'),
  'hot & spicy pizza':         U('1565299624946-b28f40a0ae38'),

  // ── PIZZA SPECIAL ────────────────────────────────────────────────────
  'hunger crave sp pizza':     U('1574071318508-1cdbab80d002'),
  'cheese lover pizza':        U('1593560708920-61dd98c46a4e'),
  'chicken lover pizza':       U('1574071318508-1cdbab80d002'),
  'mushroom lover pizza':      U('1604068549290-dea0e4a305ca'),
  'corn lover pizza':          U('1604068549290-dea0e4a305ca'),
  'sp donut pizza':            U('1513104890138-7c749659a591'),
  'malai boti pizza':          U('1565299624946-b28f40a0ae38'),

  // ── ROLLS & WRAPS ────────────────────────────────────────────────────
  'hunger wrap':               U('1626700051175-6818013e1d4f'),
  'spin behari roll':          U('1559847844-5315695dadae'),
  'pizza shawarma large':      U('1561651823-34feb02250e4'),
  'chicken shawarma large':    U('1561651823-34feb02250e4'),
  'chicken pratha roll':       U('1476224203421-9ac39bcb3327'),
  'zinger shawarma large':     U('1561651823-34feb02250e4'),
  'zinger paratha roll':       U('1559847844-5315695dadae'),

  // ── SANDWICHES ───────────────────────────────────────────────────────
  'grilled sandwich':          U('1528735602780-2552fd46c7af'),
  'club sandwich':             U('1528735602780-2552fd46c7af'),
  'cold sandwich':             U('1528735602780-2552fd46c7af'),
  'fried sandwich':            U('1528735602780-2552fd46c7af'),

  // ── DRINKS & DESSERTS ────────────────────────────────────────────────
  'ice cream - single scoop':  U('1560180474-e8563fd75bab'),
  'ice cream - double scoop':  U('1560180474-e8563fd75bab'),
  'mint margarita':            U('1544145945-f90425340c7e'),
  'soft drink':                U('1534482421-64566f976cfa'),
  'coffee':                    U('1495474472287-4d71bcdd2085'),
  'tea':                       U('1564890369478-c89ca6d9cde9'),
};

const BY_CATEGORY: Record<Category, string> = {
  Appetizers:            U('1576107232684-1279f390859f'),
  Burgers:               U('1568901346375-23c9450c58cd'),
  'Food Bank':           U('1565299624946-b28f40a0ae38'),
  Pastas:                U('1551183053-bf91a1d81141'),
  'Pizza Regular v1':    U('1513104890138-7c749659a591'),
  'Pizza Special':       U('1593560708920-61dd98c46a4e'),
  'Rolls & Wraps':       U('1626700051175-6818013e1d4f'),
  Sandwiches:            U('1528735602780-2552fd46c7af'),
  'Drinks & Desserts':   U('1495474472287-4d71bcdd2085'),
};

// Strip size/variant suffixes before name lookup.
function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*-\s*(small|medium|large|x-large|xl)\b/gi, '')
    .replace(/\s*\((no cheese|cheese|nc|ch)\)\s*$/i, '')
    .trim();
}

/** Resolve the best image: DB url → exact name → normalised name → category fallback. */
export function imageForItem(
  name: string,
  category: Category,
  dbImageUrl?: string | null,
): string {
  if (dbImageUrl) return dbImageUrl;
  const exact = BY_NAME[name.toLowerCase()];
  if (exact) return exact;
  const normalised = normalise(name);
  return BY_NAME[normalised] ?? BY_CATEGORY[category];
}
