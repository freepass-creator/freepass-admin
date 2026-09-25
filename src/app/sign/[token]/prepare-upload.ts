import { PHOTO_JPEG_QUALITY, PHOTO_MAX_SIDE, UPLOAD_MAX_BYTES, UPLOAD_MAX_LABEL } from '../../../domain/esign/upload-limits';

const tooLarge = () => new Error('파일이 너무 큽니다 — ' + UPLOAD_MAX_LABEL + ' 이하로 올려 주세요.');

async function encodeJpeg(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('사진을 처리할 수 없습니다.');
  ctx.fillStyle = '#fff';               // 투명 PNG 도 JPEG 에서 검게 되지 않게
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('사진을 처리할 수 없습니다.');
  return blob;
}

/**
 * 올리기 전에 폰에서 사진을 줄인다.
 * - 긴 변 2000px · JPEG 로 다시 그린다(면허증 글자는 읽히고 보통 1MB 안팎).
 * - 폰의 회전 정보를 반영해 똑바로 그리고, 다시 그리면서 위치정보(EXIF GPS) 같은 메타데이터가 빠진다.
 * - PDF 는 폰에서 줄일 수 없으므로 한도만 확인한다.
 * - 사진을 해석하지 못하면(일부 브라우저의 HEIC 등) 한도 안일 때만 원본을 그대로 보낸다.
 */
export async function prepareUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    if (file.size > UPLOAD_MAX_BYTES) throw tooLarge();
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (file.size <= UPLOAD_MAX_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    throw new Error('사진을 읽지 못했습니다 — 카메라로 다시 찍어 주세요.');
  }
  try {
    const attempts: Array<[number, number]> = [[PHOTO_MAX_SIDE, PHOTO_JPEG_QUALITY], [PHOTO_MAX_SIDE, 0.7], [1600, 0.7]];
    for (const [side, quality] of attempts) {
      const blob = await encodeJpeg(bitmap, side, quality);
      if (blob.size <= UPLOAD_MAX_BYTES) {
        const name = (file.name.replace(/\.[^.]+$/, '') || 'photo') + '.jpg';
        return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
      }
    }
    throw tooLarge();
  } finally {
    bitmap.close();
  }
}
