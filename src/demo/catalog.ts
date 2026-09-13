import type { CanonicalProduct } from '@/domain/product/types';

export type ProductView = {
  product: CanonicalProduct;
  name: string;
  sub: string;
  supplierName: string;
  category: '신차렌트' | '재렌트';
  status: '판매중' | '판매종료';
};

export const PRODUCTS: ProductView[] = [
  {
    name: '기아 카니발 9인승 시그니처', sub: '카니발 KA4 · 2026년형', supplierName: 'A 렌터카',
    category: '재렌트', status: '판매중',
    product: {
      id: 'carnival-001', version: '2026-09-13-v1', displayName: '기아 카니발 9인승 시그니처', supplierId: 'supplier-a', supplierProductKey: 'A-CV-001',
      vehicle: { nodeId: 'trim-carnival-signature', originId: 'kr', manufacturerId: 'kia', modelId: 'carnival', subModelId: 'ka4', trimId: 'signature-9', matchLevel: 'TRIM' },
      specs: { modelYear: 2026, fuel: '디젤', displacementCc: 2151, seats: 9 },
      registration: { vehicleNumber: '189하 1234' },
      offers: [
        { id: 'cv-1', termMonths: 1, monthlyRent: 1290000, deposit: 0, annualMileageKm: 20000, policyValues: [] },
        { id: 'cv-6', termMonths: 6, monthlyRent: 1090000, deposit: 0, annualMileageKm: 20000, policyValues: [] },
        { id: 'cv-12', termMonths: 12, monthlyRent: 949000, deposit: 0, annualMileageKm: 20000, policyValues: [] },
        { id: 'cv-24', termMonths: 24, monthlyRent: 829000, deposit: 0, annualMileageKm: 20000, policyValues: [] },
        { id: 'cv-36', termMonths: 36, monthlyRent: 729000, deposit: 0, annualMileageKm: 20000, policyValues: [{ policyId: 'payment', type: 'MULTI_SELECT', value: ['CARD', 'TRANSFER'] }] },
        { id: 'cv-60', termMonths: 60, monthlyRent: 689000, deposit: 0, annualMileageKm: 20000, policyValues: [] },
      ],
      productPolicies: [{ policyId: 'age', type: 'NUMBER', value: 21 }], sourceSnapshotId: 'sample-carnival', updatedAt: '2026-09-13T00:00:00.000Z',
    },
  },
  {
    name: '현대 싼타페 MX5 캘리그래피', sub: '싼타페 MX5 · 2026년형', supplierName: 'B 렌터카',
    category: '신차렌트', status: '판매중',
    product: {
      id: 'santafe-001', version: '2026-09-13-v1', displayName: '현대 싼타페 MX5 캘리그래피', supplierId: 'supplier-b', supplierProductKey: 'B-SF-001',
      vehicle: { nodeId: 'trim-santafe-calligraphy', originId: 'kr', manufacturerId: 'hyundai', modelId: 'santafe', subModelId: 'mx5', trimId: 'calligraphy', matchLevel: 'TRIM' },
      specs: { modelYear: 2026, fuel: '가솔린', displacementCc: 2497, seats: 7 },
      registration: {},
      offers: [
        { id: 'sf-24', termMonths: 24, monthlyRent: 990000, deposit: 1000000, annualMileageKm: 20000, policyValues: [] },
        { id: 'sf-36', termMonths: 36, monthlyRent: 920000, deposit: 0, annualMileageKm: 20000, policyValues: [] },
      ],
      productPolicies: [], sourceSnapshotId: 'sample-santafe', updatedAt: '2026-09-13T00:00:00.000Z',
    },
  },
];
