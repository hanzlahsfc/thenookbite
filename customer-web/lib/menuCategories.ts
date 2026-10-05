// Menu categories live in the menu_categories table so they can be managed from
// the admin panel. This module is the only place that reads them.

import { createServiceClient } from '@/lib/supabase/service';

export interface MenuCategory {
  id: string;
  name: string;
  display_label: string | null;
  image_url: string | null;
  sort_order: number;
}

/** Fallback used only if the table is unreachable, so the menu never renders empty. */
export const FALLBACK_CATEGORIES = [
  'Appetizers', 'Burgers', 'Food Bank', 'Pastas', 'Pizza Regular v1',
  'Pizza Special', 'Rolls & Wraps', 'Sandwiches', 'Drinks & Desserts',
];

export async function getMenuCategories(): Promise<MenuCategory[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('menu_categories')
    .select('id, name, display_label, image_url, sort_order')
    .order('sort_order');

  if (error || !data?.length) {
    return FALLBACK_CATEGORIES.map((name, i) => ({
      id: name, name, display_label: null, image_url: null, sort_order: i + 1,
    }));
  }
  return data;
}

export async function getCategoryNames(): Promise<string[]> {
  return (await getMenuCategories()).map(c => c.name);
}

/** Customer-facing name, falling back to the internal one. */
export function categoryLabel(c: { name: string; display_label?: string | null }): string {
  return c.display_label || c.name;
}
