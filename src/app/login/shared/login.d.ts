/**
 * 공용 로그인(`login.js`)의 타입 — 그 파일은 프리패스 데이터 정본을 그대로 옮긴 것이라 고치지 않는다.
 * 타입만 곁에 둔다(SHARED-LOGIN-DESIGN.md §3 — 앱은 브랜드·정책만 넘긴다).
 */
export interface SharedLoginBrand {
  kind: 'ours' | 'channel';
  label?: string;
  color?: string;
  colorHover?: string;
  wordmark?: { text: string; weight?: number; color?: string }[];
}

export interface SharedLoginOptions {
  brand: SharedLoginBrand;
  policy?: 'AUTO' | 'APPROVAL';
  fields?: 'basic' | 'sales';
  consent?: boolean;
  /** Firebase Auth 인스턴스와 모듈 — 이 화면은 비밀번호를 저장하지도 토큰을 만들지도 않는다 */
  auth: unknown;
  firebase: unknown;
  onSignedIn?: () => void | Promise<void>;
}

export function mount(root: HTMLElement, options: SharedLoginOptions): void;
export const FREEPASS_DATA_BRAND: SharedLoginBrand;
