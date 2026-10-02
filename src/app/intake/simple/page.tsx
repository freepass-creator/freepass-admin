import { requireAdmin } from '../../../server/require-admin';
import { redirect } from 'next/navigation';
import SimpleIntake from './SimpleIntake';

export const dynamic = 'force-dynamic';
export default async function Page() {
  if (await requireAdmin()) redirect('/login?next=%2Fintake%2Fsimple');
  return <SimpleIntake />;
}
