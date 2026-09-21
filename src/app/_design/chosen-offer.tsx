'use client';
/**
 * 고른 요금 — 요약의 기간 고르기(OfferPicker)가 상세 판 하단바(DetailTabs)에 알린다.
 *   따로 둔 까닭: 두 부품이 서로를 부르면(순환) 개발 서버가 「export 가 없다」고 멈췄다(실측).
 */
import { createContext, useContext } from 'react';

export const ChosenOffer = createContext<(id: string) => void>(() => {});
export const useChosenOffer = () => useContext(ChosenOffer);
