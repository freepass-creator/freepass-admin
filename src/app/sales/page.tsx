import type { Metadata } from 'next';
import { SalesCatalog } from './sales-catalog';
import { PRODUCTS } from '@/demo/catalog';
import { projectProductForSales } from '@/domain/access/sales-product';

export const metadata: Metadata = {
  title: 'freepasserp.com · 상품 조회',
  description: 'FreePass sales product search',
};

export default function SalesPage() {
  const products = PRODUCTS.map(projectProductForSales);
  return <SalesCatalog products={products} />;
}
