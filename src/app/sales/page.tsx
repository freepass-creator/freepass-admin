import type { Metadata } from 'next';
import { SalesCatalog } from './sales-catalog';
import { PRODUCTS } from '@/demo/catalog';
import { projectProductForSales } from '@/domain/access/sales-product';
import { AuthGate } from '../auth-gate';
import { AccessError } from '@/server/auth/errors';
import { requireServerCapability } from '@/server/auth/server-session';
import { forbidden, unauthorized } from 'next/navigation';

export const metadata: Metadata = {
  title: 'freepasserp.com · 상품 조회',
  description: 'FreePass sales product search',
};

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  try {
    await requireServerCapability('PRODUCT_SEARCH');
    const products = PRODUCTS.map(projectProductForSales);
    return <SalesCatalog products={products} />;
  } catch (error) {
    if (error instanceof AccessError) {
      if (error.status === 401) unauthorized();
      if (error.status === 403) forbidden();
      return <AuthGate code={error.code} surface="SALES" />;
    }
    throw error;
  }
}
