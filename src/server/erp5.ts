/**
 * @deprecated FreePass Admin의 정본 데이터 출입구는 `./freepass-data`다.
 * 기존 import 호환만 유지한다. 새 코드는 이 파일을 import하지 않는다.
 */
export {
  FREEPASS_DATA_PROJECT_ID,
  products,
  settlements,
  contracts,
  productList,
  productById,
  productByIdFresh,
  feeRuleSet,
  freePassDataReady,
  freePassDataWriteEnabled,
  WriteDisabledError,
  today,
} from './freepass-data';
export type { ClaimView } from './freepass-data';
