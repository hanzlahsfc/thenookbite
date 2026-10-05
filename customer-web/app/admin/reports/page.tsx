import { requireAdmin } from '@/lib/admin-auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { ReportsClient } from './ReportsClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  await requireAdmin();
  return (
    <AdminShell>
      <ReportsClient />
    </AdminShell>
  );
}
