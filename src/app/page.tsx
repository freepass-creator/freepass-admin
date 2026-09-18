import { redirect } from 'next/navigation';

/** 첫 화면은 메인(계약접수)이다 — 대표 2026-09-18 「이게 우리 메인」. ★견본 4대(가짜)를 띄우던 자리 — ERP5 를 직접 읽는 화면으로 넘긴다. */
export default function Home() {
  redirect('/intake');
}
