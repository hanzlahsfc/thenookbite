import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminShell } from '@/components/admin/AdminShell';
import { MenuItemEditor } from './MenuItemEditor';
import { notFound } from 'next/navigation';
import { getCategoryNames } from '@/lib/menuCategories';

export const dynamic = 'force-dynamic';

export default async function MenuItemPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const db = createServiceClient();

  const { data: item } = await db
    .from('menu_items')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!item) notFound();

  // Fetch all items in the same category ordered the same way, to find prev/next
  const { data: siblings } = await db
    .from('menu_items')
    .select('id, name')
    .eq('category', item.category)
    .order('sort_order')
    .order('name');

  const idx     = (siblings ?? []).findIndex(s => s.id === item.id);
  const prevItem = idx > 0 ? siblings![idx - 1] : null;
  const nextItem = siblings && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const categories = await getCategoryNames();

  return (
    <AdminShell>
      <MenuItemEditor item={item} prevItem={prevItem} nextItem={nextItem} categories={categories} />
    </AdminShell>
  );
}
