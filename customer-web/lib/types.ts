// Shared domain types for TNB customer-web.

// Categories are no longer a fixed union — they live in the menu_categories
// table and are read via lib/menuCategories.ts, so they can be added, renamed
// and reordered from /admin/categories without a deploy.
export type Category = string;

// Raw row from menu_items (one row per SKU).
export interface MenuItem {
  id: string;
  sku: string;
  name: string;
  category: Category;
  price: number; // PKR integer
  image_url: string | null;
  description: string | null;
  available: boolean;
  sort_order: number;
}

// A pizza size option derived from a group of same-name pizza SKUs.
export type PizzaSize = 'S' | 'M' | 'L' | 'XL';

export interface SizeOption {
  size: PizzaSize;
  label: string;
  sku: string;
  price: number;
  available: boolean;
}

// A burger cheese variant derived from a group of same-name burger SKUs.
export type CheeseVariant = 'NC' | 'CH';

export interface VariantOption {
  variant: CheeseVariant;
  label: string;
  sku: string;
  price: number;
  available: boolean;
}

// A presentation card: either a plain item, a pizza (size picker),
// or a burger (cheese toggle).
export type MenuCard =
  | { kind: 'plain'; name: string; category: Category; item: MenuItem }
  | { kind: 'pizza'; name: string; category: Category; base: MenuItem; sizes: SizeOption[] }
  | { kind: 'burger'; name: string; category: Category; base: MenuItem; variants: VariantOption[] };

/**
 * Stable, unique React key for a menu card.
 *
 * Cards were keyed by name + category, which is not unique: the menu holds two
 * distinct "Cheese Lover Pizza" groups and two "Crispy Petti Burger" groups.
 * Duplicate keys make React reuse the wrong nodes when the list is filtered, so
 * cards from the previously selected category stayed on screen — which is why
 * pizzas and burgers appeared under Sandwiches. SKUs are unique; key on those.
 */
export function cardKey(card: MenuCard): string {
  return card.kind === 'plain' ? card.item.sku : card.base.sku;
}

// Cart line — variant selection baked into a stable key.
export interface CartLine {
  key: string; // sku — uniquely identifies the chosen variant/size
  menu_item_id: string | null;
  name: string; // display name incl. size/cheese, e.g. "Chicken Tikka (Large)"
  price: number;
  quantity: number;
  /** Set only for lines read back from a placed order, so they can be removed. */
  orderItemId?: string;
}
