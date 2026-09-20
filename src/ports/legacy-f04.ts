export type F04BridgeMode =
  | 'OBSERVE'
  | 'MIRROR_ADMIN_OWNED'
  | 'ADMIN_SINGLE_WRITER';

export type F04CaseProjection = {
  applicationId: string;
  applicationNumber: string;
  f04SettlementCode: string;

  sourceSnapshotId?: string;
  productId: string;
  productVersion: number;
  sourceOfferId?: string;
  sourceOfferRevision?: number;
  sourcePriceTermKey?: string;

  receivedAt: string;
  vehicleNumber?: string;
  supplierId: string;
  supplierLabel?: string;
  modelLabel: string;
  salesChannelId: string;
  salesChannelLabel?: string;
  assigneeId: string;
  assigneeLabel?: string;
  customerName: string;

  commercialType?: string;
  termMonths: number;
  monthlyRent: number;
  deposit?: number;
  depositState?: 'KNOWN' | 'ZERO' | 'UNKNOWN' | 'NOT_APPLICABLE';

  contractCompleted: boolean;
  deliveryCompleted: boolean;
  deliveredAt?: string;
  cancelled: boolean;

  performanceId?: string;
  settlementId?: string;
  supplierReceivable?: number;
  channelPayable?: number;
  billingCreated?: boolean;
  invoiceEvidenceComplete?: boolean;
  collectedAmount?: number;
  paidAmount?: number;
};

export type F04BridgeReceipt = {
  bridge: 'F04';
  mode: F04BridgeMode;
  applicationId: string;
  f04SettlementCode: string;
  operationId: string;
  applied: boolean;
  mirroredAt: string;
  legacyRowRef?: string;
  warnings: string[];
};

/**
 * Transitional compatibility bridge only.
 *
 * F04 is not a Domain repository and must never become an implicit fallback SSOT.
 * Implementations must be idempotent by operationId/applicationId.
 */
export interface F04Bridge {
  compare(projection:F04CaseProjection):Promise<{
    found:boolean;
    differences:string[];
    legacyRowRef?:string;
  }>;

  mirror(
    projection:F04CaseProjection,
    mode:F04BridgeMode,
    operationId:string,
  ):Promise<F04BridgeReceipt>;
}
