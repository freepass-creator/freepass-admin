import AdminDashboard from './admin-dashboard';
import { AuthGate } from './auth-gate';
import { AccessError } from '@/server/auth/errors';
import { requireServerCapability } from '@/server/auth/server-session';
import { forbidden, unauthorized } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  try {
    const principal = await requireServerCapability('APPLICATION_READ');
    return <AdminDashboard adminId={principal.uid} enableLocalPersistence={false} />;
  } catch (error) {
    if (error instanceof AccessError) {
      if (error.status === 401) unauthorized();
      if (error.status === 403) forbidden();
      return <AuthGate code={error.code} surface="ADMIN" />;
    }
    throw error;
  }
}
