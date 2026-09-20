import type { Offer } from './types';

/**
 * Supplier periods are data, never a fixed UI enum.
 * The same term may contain multiple Offer variants (mileage/deposit/policies/supplier/price).
 */
export function offerTerms(offers: readonly Offer[]): number[] {
  return [...new Set(
    offers
      .map((offer)=>offer.termMonths)
      .filter((months)=>Number.isInteger(months)&&months>0),
  )].sort((a,b)=>a-b);
}

export function offersForTerm(offers: readonly Offer[], termMonths: number): Offer[] {
  return offers.filter((offer)=>offer.termMonths===termMonths);
}

export function firstOfferForTerm(
  offers: readonly Offer[],
  termMonths: number,
): Offer | undefined {
  return offersForTerm(offers,termMonths)[0];
}
