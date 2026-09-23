import { SignClient } from './SignClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '전자계약 · FreePass', robots: { index: false, follow: false } };

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SignClient token={token}/>;
}
