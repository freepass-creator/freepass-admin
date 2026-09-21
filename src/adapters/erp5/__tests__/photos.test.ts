import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { photosOf } from '../photos.js';

const DRIVE = 'https://drive.google.com/drive/folders/abc';
const IMG = 'https://img.example.com/a.jpg';

describe('photosOf — 화이트라벨과 같은 차례', () => {
  it('① 직접 이미지 배열이 먼저', () => {
    const r = photosOf({ image_urls: [IMG, 'https://x.com/b.png'], photo_link: DRIVE });
    assert.deepEqual(r.photos, [IMG, 'https://x.com/b.png']);
    assert.equal(r.photoLink, DRIVE);
  });
  it('JSON 글자로 든 배열도 읽는다', () => assert.deepEqual(photosOf({ photos: JSON.stringify([IMG]) }).photos, [IMG]));
  it('② 캐시는 출처가 지금 링크와 같을 때만', () => {
    const cache = { urls: ['https://drive.google.com/thumbnail?id=1&sz=w640'], src: DRIVE };
    assert.equal(photosOf({ photo_link: DRIVE, photo_cache: cache }).photos.length, 1);
    /* ★공급사가 링크를 바꿨으면 옛 캐시를 안 쓴다 — 「바뀐 링크 · 옛 사진」 이 굳는다 */
    assert.equal(photosOf({ photo_link: 'https://drive.google.com/drive/folders/NEW', photo_cache: cache }).photos.length, 0);
  });
  it('③ photo_link 안의 직접 이미지 주소 (쉼표로 여럿)', () => {
    const r = photosOf({ photo_link: `${IMG}, https://img.example.com/b.png` });
    assert.deepEqual(r.photos, [IMG, 'https://img.example.com/b.png']);
    assert.equal(r.photoLink, undefined);
  });
  it('★폴더·상세페이지는 사진이 아니다 — photoLink 로만', () => {
    const r = photosOf({ photo_link: 'https://www.moderentcar.co.kr/detail/v.php?v=1' });
    assert.deepEqual(r.photos, []);
    assert.equal(r.photoLink, 'https://www.moderentcar.co.kr/detail/v.php?v=1');
  });
  it('없으면 비운다 · 겹치면 한 번', () => {
    assert.deepEqual(photosOf({}).photos, []);
    assert.deepEqual(photosOf({ image_urls: [IMG, IMG] }).photos, [IMG]);
  });
});

import { allowedImageHost, imgSrc, isPrivateOrLocalIp } from '../../../server/image-proxy.js';

describe('사진 길 (/api/img) — 허용 호스트만', () => {
  it('드라이브는 우리 길로 감싼다 · 바로 뜨는 곳은 그대로', () => {
    assert.match(imgSrc('https://drive.google.com/thumbnail?id=1&sz=w640')!, /^\/api\/img\?url=/);
    assert.equal(imgSrc('https://sokrc.com/api/file/preview?file_name=a.jpg'), 'https://sokrc.com/api/file/preview?file_name=a.jpg');
    assert.equal(imgSrc(undefined), undefined);
  });
  it('★SSRF — 허용 밖 호스트 · 사설 IP 는 막는다', () => {
    assert.equal(allowedImageHost('http://169.254.169.254/latest'), null);
    assert.equal(allowedImageHost('file:///etc/passwd'), null);
    assert.ok(isPrivateOrLocalIp('10.0.0.1') && isPrivateOrLocalIp('::1') && !isPrivateOrLocalIp('142.250.1.1'));
  });
});
