import { requireAdmin } from '@/lib/admin-auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { LedgerClient } from './LedgerClient';

export const dynamic = 'force-dynamic';

export default async function LedgerPage() {
  await requireAdmin();
  return (
    <AdminShell>
      <LedgerClient />
    </AdminShell>
  );
}
