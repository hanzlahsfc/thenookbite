import { getMenuItems, buildMenuCards } from '@/lib/menu';
import { getMenuCategories, categoryLabel } from '@/lib/menuCategories';
import { MenuBrowser } from '@/components/MenuBrowser';

export default function MenuPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const cats = getMenuCategories();
  const categoryNames = cats.map(c => c.name);
  const labels = Object.fromEntries(cats.map(c => [c.name, categoryLabel(c)]));

  const rawCat = searchParams.category;
  const initialCategory = rawCat && categoryNames.includes(rawCat) ? rawCat : undefined;

  const cards = buildMenuCards(getMenuItems());

  // Include any category still present on an item, so a renamed or removed
  // category never leaves items unreachable from the tabs.
  const onCards = [...new Set(cards.map(c => c.category))];
  const tabCategories = [...categoryNames, ...onCards.filter(c => !categoryNames.includes(c))];

  return (
    <div>
      {/* Page header */}
      <div className="bg-[#0a0a0a] py-12 sm:py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="font-heading text-xs tracking-[0.4em] text-brand-red mb-3">139+ ITEMS</p>
          <h1 className="font-heading text-4xl sm:text-6xl text-white leading-none">ORDER<br/>ONLINE</h1>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        <MenuBrowser cards={cards} initialCategory={initialCategory} categories={tabCategories} labels={labels} />
      </div>
    </div>
  );
}
