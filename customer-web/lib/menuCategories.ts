// Categories live in the menu_categories table so they can be added, renamed
// and reordered from /admin without a deploy. The static CATEGORIES list in
// lib/menuData.ts is the fallback when Supabase isn't configured or reachable.

import { CATEGORIES, type StaticCategory } from '@/lib/menuData';
import { getSupabase } from '@/lib/supabase';

export interface MenuCategory {
  id: string;
  name: string;
  display_label: string | null;
  image_url: string | null;
  sort_order: number;
}

export async function getMenuCategories(): Promise<MenuCategory[]> {
  const sb = getSupabase();
  if (!sb) return CATEGORIES.map(c => ({ id: c.name, ...c }));
  const { data, error } = await sb
    .from('menu_categories')
    .select('*')
    .order('sort_order');
  if (error || !data) return CATEGORIES.map(c => ({ id: c.name, ...c }));
  return data as MenuCategory[];
}

export async function getCategoryNames(): Promise<string[]> {
  return (await getMenuCategories()).map(c => c.name);
}

/** Customer-facing name, falling back to the internal one. */
export function categoryLabel(c: { name: string; display_label?: string | null }): string {
  return c.display_label || c.name;
}
