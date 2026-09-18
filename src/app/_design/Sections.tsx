/**
 * ★★★**원자를 성격별 구역으로 — 구역마다 제 자리** (대표 2026-09-18)
 *   「erp5에서 가져올 원자 다 갖고 오는데 디자인 쪽에다가 들어갈 공간 좀 제대로 성격에 따라서 잘 만들어 달라고 해.. 막 뭉쳐놓지 말고」
 *   「erp4 디자인 중에서 … 상세페이지나 … 잘 생각해봐」 → ③ 「상세정보 = 한 표 + 섹션 아이콘」 · ⑤ 「모르는 값 흐리게」
 *
 * 구역은 기능 쪽이 준다(`productSections` · `settlementSections` — erp4 사전 이름 그대로). 여기는 «자리»만.
 * 정본 = freepasserp4 `components/ui/detail.tsx` DetailTable 규격 + `section-icons.tsx`:
 * ```
 *   [▣] 차량                                       10칸    ← 머리: 아이콘 하나 + 이름 + 칸 수 (hint 는 밑 한 줄)
 *   ┌──────────────────────────────────────────────┐
 *   │ 차량번호        133허4558                     │    ← 모든 구역이 «같은 표» — 항목 │ 값
 *   │ 차대번호        —                             │    ← ⑤ 없는 값은 칸을 두고 「—」 흐리게(지우면 «없음»을 못 본다)
 *   │ 심사 [내부]      신용조회                      │    ← 내부 전용 값은 딱지(손님·견적에 절대 안 나간다)
 *   │ 옵션            …                             │
 *   │                 공급사 원문으로 확인 안 됨      │    ← note 는 값 밑 보조 글
 *   └──────────────────────────────────────────────┘
 * ```
 * ★아이콘은 **머리에 하나씩만** — 칸 안에는 넣지 않는다(erp4 「표가 시끄러워지고 값이 안 읽힌다」).
 * ★머리 무게 = «중요도»(erp4 대표 2026-08-20 「중요한 섹션은 메인 컬러로, 부가적인 건 좀 다르게」):
 *   main 남색 면 아이콘 · sub 회색 면 · trace 면 없음(대조용 값).
 * ★칸이 많은 구역(정책 셋 · 사전에 없는 칸)은 접힌 채로 선다 — 머리에 「값 있는 칸 / 전체」를 보여 펼칠지 고른다.
 * ★선은 없다(규칙 ①) — 표는 옅은 박스, 줄은 사이로 가른다.
 */
import type { Section, SectionItem } from '../../domain/catalog/sections';
import { Icon } from './Icon';

/** 구역 → 머리 그림 (erp4 section-icons 의 짝을 이 집 구역 이름에 맞췄다) */
const 그림: Record<string, string> = {
  vehicle: 'car', spec: 'gauge', look: 'palette', release: 'truck', supply: 'building', match: 'link',
  screening: 'shield-check', policy_product: 'file-text', policy_sales: 'file-text', policy_contract: 'file-text', policy_other: 'info',
  정체: 'id-card', 상대: 'users', 조건: 'file-text', '요율·돈': 'wallet', 날: 'calendar', '정산 축': 'scale', 상태: 'activity', 이월: 'repeat', 출처: 'database',
};
/** 머리 무게 — 차를 고르는·돈을 셈하는 데 필요한 것만 main */
const 무게: Record<string, 'main' | 'sub' | 'trace'> = {
  vehicle: 'main', screening: 'main', policy_other: 'trace',
  '요율·돈': 'main', 상태: 'main', 출처: 'trace',
};
/** 처음에 접혀 서는 구역 */
const 접힘 = (key: string, n: number) => key.startsWith('policy_') || key === '출처' || n > 14;

const 수 = (n: number) => n.toLocaleString('ko-KR');

/** 값의 꼴 — type 만 받아서 화면이 정한다(기능 쪽은 꼴을 안 정한다) */
function 꼴(it: SectionItem) {
  const v = it.value;
  if (v === null || v === undefined || (Array.isArray(v) && !v.length)) return <span className="dz-none">—</span>;
  if (Array.isArray(v)) return <span className="dz-sec-list">{v.map((x) => <i key={x}>{x}</i>)}</span>;
  if (typeof v === 'boolean' || it.type === 'boolean') return v === true || v === 'true' || v === 'Y' ? '예' : '아니오';
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  const isNum = typeof v === 'number' || (String(v).trim() !== '' && !Number.isNaN(n));
  switch (it.type) {
    case 'money': return isNum ? `${n < 0 ? '−' : ''}${수(Math.abs(Math.round(n)))}원` : String(v);
    case 'km': return isNum ? `${수(n)}km` : String(v);
    case 'cc': return isNum ? `${수(n)}cc` : String(v);
    case 'kwh': return isNum ? `${수(n)}kWh` : String(v);
    case 'percent': return isNum ? `${+(n * 100).toFixed(2)}%` : String(v);
    case 'rate': return isNum ? `${+(n * 100).toFixed(2)}%` : String(v);
    /* 연식은 자릿점 없이(2,026 이 아니라 2026) */
    case 'number': return isNum ? (/year/i.test(it.key) ? String(n) : 수(n)) : String(v);
    case 'date': {
      const s = String(v);
      return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 16).replace('T', ' ') : s;
    }
    case 'link': return <a href={String(v)} target="_blank" rel="noreferrer">열기</a>;
    default: return String(v);
  }
}

const 있음 = (it: SectionItem) => !(it.value === null || (Array.isArray(it.value) && !it.value.length));

export function Sections({ sections }: { sections: Section[] }) {
  return (
    <div className="dz-secs">
      {sections.map((s) => {
        const 찬 = s.items.filter(있음).length;
        const w = 무게[s.key] ?? 'sub';
        return (
          <details key={s.key} className={`dz-sec ${w}`} open={!접힘(s.key, s.items.length)}>
            <summary>
              <span className="dz-sec-ico"><Icon name={그림[s.key] ?? 'info'} size={15} /></span>
              <b>{s.title}</b>
              <small>{찬 === s.items.length ? `${s.items.length}칸` : `${찬} / ${s.items.length}칸`}</small>
              <span className="dz-sec-fold" aria-hidden><Icon name="chevron-down" size={16} /></span>
            </summary>
            {s.hint && <p className="dz-sec-hint">{s.hint}</p>}
            <dl className="dz-sec-table">
              {s.items.map((it) => (
                <div key={it.key} className={있음(it) ? '' : 'none'}>
                  <dt>
                    {it.label}
                    {it.exposure === 'internal' && <i className="dz-internal" title="내부 전용 — 손님·견적서에 안 나가는 값">내부</i>}
                    {it.article && <small className="dz-article">{it.article}</small>}
                  </dt>
                  <dd>
                    {꼴(it)}
                    {it.note && <small className="dz-sec-note">{it.note}</small>}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        );
      })}
    </div>
  );
}
