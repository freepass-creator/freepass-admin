'use client';
/**
 * ★★★**freepass-admin 의 얼굴 — 프리패스 CI 규격 그대로** (대표 2026-09-18)
 *   「freepass admin 은 우리 CI 규격에 맞춰서 BI 규격으로 해주세요」
 *   「상단바도 남색이랑 색깔 잘 활용합시다」
 *
 * 정본 = freepasserp4 — 새로 짓지 않는다. 거기 적힌 값을 옮긴다.
 *   · 색    `app/globals.css:4` 「프리패스 CI(네이비 #1B2A4A · 스카이 #9EC5F3)」
 *   · 마크  `public/icon.svg` — 둥근 네모(라운드 96/512 = 18.75%) + 체크
 *           체크 꼭짓점 (128,264)-(208,344)-(384,168) · 획 52 · 끝 둥글게
 *   · 반전  남색 띠 위에서는 «흰 네모 + 남색 체크» — `components/sign/sign.css` 「.brand-mark」
 *           (대표 2026-08-28 「하얀 네모에 체크는 남색이라야 임팩트」 · 대비 14.1:1 로 원본 CI 와 같은 세기)
 *   · 글자  워드마크는 Exo 2 — 「freepass」 600, 뒤에 붙는 말은 300 (명함과 같다 · `sign.css` 「CI 워드마크 규격」)
 *
 * ⚠ 앞서 상단바는 `freepass-admin` 을 본문 글꼴로 적은 글자 한 줄이었다 — 마크도, CI 글꼴도 없었다.
 * ⚠ 좌표·비율을 고칠 일이 생기면 **fp4 `public/icon.svg` 와 같이** 고친다. 여기만 고치면 마크가 둘이 된다.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Exo_2 } from 'next/font/google';

const 레터링 = Exo_2({ weight: ['300', '600'], subsets: ['latin'], display: 'swap' });

/** CI 마크 — 띠 위 반전형(흰 네모 + 남색 체크). 크기는 감싸는 쪽이 정한다. */
export function BrandMark() {
  return (
    <svg className="dz-mark" viewBox="0 0 512 512" aria-hidden>
      <rect width="512" height="512" rx="96" fill="#ffffff" />
      <path d="M128 264 l80 80 L384 168" fill="none" stroke="#1B2A4A" strokeWidth={52}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 마크 + 워드마크 — 「freepass」(600) 「admin」(300). 누르면 첫 화면으로. */
export function Brand({ tail = 'admin' }: { tail?: string }) {
  return (
    <Link href="/" className={`dz-brand ${레터링.className}`} aria-label={`freepass ${tail}`}>
      <BrandMark />
      <span className="dz-word"><b>freepass</b><i>{tail}</i></span>
    </Link>
  );
}

/**
 * 위 띠의 메뉴 — «지금 있는 곳»을 색으로 말한다(규칙 ④ 강조는 색으로만).
 *   켜진 메뉴 = 한 단 밝은 남색 면 + 스카이 글자 — CI 두 색을 다 쓴다. 선·밑줄은 긋지 않는다.
 */
export function TopMenu({ items }: { items: readonly (readonly [string, string])[] }) {
  const path = usePathname() || '/';
  return (
    <div className="dz-menu">
      {items.map(([href, label]) => {
        const 여기 = path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className={여기 ? 'on' : undefined} aria-current={여기 ? 'page' : undefined}>
            {label}
          </Link>
        );
      })}
    </div>
  );
}
