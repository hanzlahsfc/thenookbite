import { createServiceClient } from '@/lib/supabase/service';
import { CategoriesClient } from './CategoriesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categories — TNB Admin' };

export default async function CategoriesPage() {
  const db = createServiceClient();
  const [{ data: cats }, { data: items }] = await Promise.all([
    db.from('menu_categories').select('*').order('sort_order'),
    db.from('menu_items').select('category'),
  ]);

  const counts = new Map<string, number>();
  for (const i of items ?? []) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);

  const initial = (cats ?? []).map(c => ({ ...c, item_count: counts.get(c.name) ?? 0 }));

  return (
    <div className="px-4 sm:px-8 py-8">
      <CategoriesClient initial={initial} />
    </div>
  );
}
