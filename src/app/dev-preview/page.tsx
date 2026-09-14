import { notFound } from 'next/navigation';
import AdminDashboard from '../admin-dashboard';

export default function DevelopmentPreviewPage() {
  const isLocalDevelopment = process.env.NODE_ENV === 'development';
  const isVercelPreview = process.env.VERCEL_ENV === 'preview';
  if (!isLocalDevelopment && !isVercelPreview) notFound();
  return <AdminDashboard adminId="local-preview" enableLocalPersistence />;
}
