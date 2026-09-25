/**
 * 고객 링크 업로드 한도 — Vercel 함수 요청 본문 한도(4.5MB)보다 작게 잡는다.
 * 이보다 크면 서버에 닿기 전에 플랫폼이 413 으로 끊어 고객은 까닭 모를 실패를 본다.
 * 사진은 폰에서 줄여 보내므로(sign 화면) 보통 1MB 안팎이다. 줄일 수 없는 PDF 만 이 한도에 걸린다.
 */
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const UPLOAD_MAX_LABEL = '4MB';

/** 폰 사진을 줄일 때의 기준 — 면허증 글자가 읽히는 크기 */
export const PHOTO_MAX_SIDE = 2000;
export const PHOTO_JPEG_QUALITY = 0.85;
