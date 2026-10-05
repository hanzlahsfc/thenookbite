import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminShell } from '@/components/admin/AdminShell';
import { InventoryClient } from './InventoryClient';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  await requireAdmin();
  const db = createServiceClient();

  const { data: ingredients } = await db
    .from('ingredients')
    .select('id, name, unit, stock_qty, low_stock_threshold, updated_at')
    .order('name');

  const enriched = (ingredients ?? []).map(i => ({
    ...i,
    low_stock: i.stock_qty <= i.low_stock_threshold,
  }));

  return (
    <AdminShell>
      <InventoryClient initialIngredients={enriched} />
    </AdminShell>
  );
}
