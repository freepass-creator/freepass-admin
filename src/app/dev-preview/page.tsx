import { notFound } from 'next/navigation';
import AdminDashboard from '../admin-dashboard';

export default function DevelopmentPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <AdminDashboard adminId="local-preview" enableLocalPersistence />;
}
