import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminMenuClient } from './AdminMenuClient';
import { getCategoryNames } from '@/lib/menuCategories';

export const dynamic = 'force-dynamic';

export default async function AdminMenuPage() {
  await requireAdmin();
  const db = createServiceClient();

  const { data: items } = await db
    .from('menu_items')
    .select('id, sku, name, category, price, available')
    .order('category')
    .order('sort_order');

  const categories = await getCategoryNames();

  return (
    <AdminShell>
      <AdminMenuClient initialItems={items ?? []} categories={categories} />
    </AdminShell>
  );
}
