import type { ApplicationRepository, PerformanceRepository, SettlementRepository } from '../ports/repositories';
import { settlementTotals } from '../domain/settlement/types';

export interface ApplicationListRow {
  id: string;
  applicationNumber: string;
  applicantName: string;
  applicantPhone?: string;
  vehicleNumber?: string;
  supplierId: string;
  salesChannelId: string;
  assigneeId: string;
  termMonths: number;
  monthlyRent: number;
  deposit?: number;
  status: 'RECEIVED' | 'CONTRACTED' | 'DELIVERED' | 'CANCELLED';
  progress: {
    contractCompleted: boolean;
    documentsCompleted: boolean;
    balanceCompleted: boolean;
    deliveryCompleted: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export async function listApplicationRows(
  applications: ApplicationRepository,
): Promise<ApplicationListRow[]> {
  return (await applications.list()).map((application) => ({
    id: application.id,
    applicationNumber: application.applicationNumber,
    applicantName: application.applicantName,
    ...(application.applicantPhone ? { applicantPhone: application.applicantPhone } : {}),
    vehicleNumber: application.snapshot.registration?.vehicleNumber,
    supplierId: application.snapshot.supplierId,
    salesChannelId: application.salesChannelId,
    assigneeId: application.assigneeId,
    termMonths: application.snapshot.offer.termMonths,
    monthlyRent: application.snapshot.offer.monthlyRent,
    ...(application.snapshot.offer.deposit !== undefined
      ? { deposit: application.snapshot.offer.deposit }
      : {}),
    status: application.status,
    progress: { ...application.progress },
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  }));
}

export interface SettlementListRow {
  performanceId: string;
  performanceNumber: string;
  settlementCode: string;
  applicationId: string;
  applicantName: string;
  vehicleNumber?: string;
  supplierId: string;
  salesChannelId: string;
  termMonths: number;
  monthlyRent: number;
  occurredAt: string;

  settlementId?: string;
  calculationState: 'NOT_CREATED' | 'READY' | 'REVIEW_REQUIRED';
  claimTotal: number | null;
  payoutTotal: number | null;
  margin: number | null;
  claimIssued: boolean;
  collected: boolean;
  payoutPaid: boolean;
  reviewReason?: string;
}

export async function listSettlementRows(
  performances: PerformanceRepository,
  settlements: SettlementRepository,
): Promise<SettlementListRow[]> {
  const [performanceRows, settlementRows] = await Promise.all([
    performances.list(),
    settlements.list(),
  ]);
  const byPerformance = new Map(settlementRows.map((row) => [row.performanceId, row]));

  return performanceRows.map((performance) => {
    const settlement = byPerformance.get(performance.id);
    if (!settlement) {
      return {
        performanceId: performance.id,
        performanceNumber: performance.performanceNumber,
        settlementCode: performance.settlementCode,
        applicationId: performance.applicationId,
        applicantName: performance.applicantName,
        vehicleNumber: performance.snapshot.registration?.vehicleNumber,
        supplierId: performance.snapshot.supplierId,
        salesChannelId: performance.salesChannelId,
        termMonths: performance.snapshot.offer.termMonths,
        monthlyRent: performance.snapshot.offer.monthlyRent,
        occurredAt: performance.occurredAt,
        calculationState: 'NOT_CREATED' as const,
        claimTotal: null,
        payoutTotal: null,
        margin: null,
        claimIssued: false,
        collected: false,
        payoutPaid: false,
      };
    }

    const totals = settlementTotals(settlement);
    return {
      performanceId: performance.id,
      performanceNumber: performance.performanceNumber,
      settlementCode: performance.settlementCode,
      applicationId: performance.applicationId,
      applicantName: performance.applicantName,
      vehicleNumber: performance.snapshot.registration?.vehicleNumber,
      supplierId: performance.snapshot.supplierId,
      salesChannelId: performance.salesChannelId,
      termMonths: performance.snapshot.offer.termMonths,
      monthlyRent: performance.snapshot.offer.monthlyRent,
      occurredAt: performance.occurredAt,
      settlementId: settlement.id,
      calculationState: settlement.calculation.state,
      ...totals,
      claimIssued: Boolean(settlement.claimIssuedAt),
      collected: Boolean(settlement.collectedAt),
      payoutPaid: Boolean(settlement.payoutPaidAt),
      ...(settlement.calculation.state === 'REVIEW_REQUIRED'
        ? { reviewReason: settlement.calculation.reason }
        : {}),
    };
  });
}
