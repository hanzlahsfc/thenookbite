// Menu categories are static — defined in lib/menuData.ts alongside the items.

import { CATEGORIES, type StaticCategory } from '@/lib/menuData';

export interface MenuCategory {
  id: string;
  name: string;
  display_label: string | null;
  image_url: string | null;
  sort_order: number;
}

export function getMenuCategories(): MenuCategory[] {
  return CATEGORIES.map(c => ({ id: c.name, ...c }));
}

export function getCategoryNames(): string[] {
  return CATEGORIES.map(c => c.name);
}

/** Customer-facing name, falling back to the internal one. */
export function categoryLabel(c: { name: string; display_label?: string | null }): string {
  return c.display_label || c.name;
}
