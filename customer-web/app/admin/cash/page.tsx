import { requireAdmin } from '@/lib/admin-auth';
import { getCashSnapshot } from '@/lib/cashDrawer';
import { CashClient } from './CashClient';

export const dynamic = 'force-dynamic';

export default async function CashPage() {
  await requireAdmin();
  return <CashClient initial={await getCashSnapshot()} />;
}
