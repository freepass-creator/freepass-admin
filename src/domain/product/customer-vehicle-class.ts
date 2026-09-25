import type { CanonicalProduct } from './types';

/**
 * White Label과 Admin이 함께 쓰는 고객용 큰 차종 갈래.
 * 원본 vehicleClass는 그대로 두고 검색/표시용 projection만 만든다.
 */
export const CUSTOMER_VEHICLE_CLASSES = ['승용', 'SUV', '승합', '화물·픽업'] as const;
export type CustomerVehicleClass = (typeof CUSTOMER_VEHICLE_CLASSES)[number];

export function customerVehicleClass(
  product: Pick<CanonicalProduct, 'vehicleClass'>,
): CustomerVehicleClass | '' {
  const value=String(product.vehicleClass??'').trim();
  if(!value)return '';
  // White Label과 동일 순서. 「소형 SUV」를 승용으로 읽거나 「소형화물」을 승용으로 읽지 않는다.
  if(/픽업|화물|밴|트럭/i.test(value))return '화물·픽업';
  if(/SUV|RV/i.test(value))return 'SUV';
  if(/MPV|승합|미니밴|버스/i.test(value))return '승합';
  if(/세단|해치|왜건|쿠페|컨버터블|승용/i.test(value))return '승용';
  return '';
}
