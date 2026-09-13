export interface RawSourceSnapshot {
  id: string;
  supplierId: string;
  sourceType: 'SHEET' | 'API' | 'FILE' | 'WEB';
  sourceRef: string;
  collectedAt: string;
  payload: unknown;
}

export interface AdapterIssue {
  code:
    | 'UNKNOWN_VEHICLE'
    | 'CONFLICTING_VEHICLE'
    | 'UNKNOWN_POLICY'
    | 'AMBIGUOUS_UNIT'
    | 'SOURCE_FORMAT_CHANGED'
    | 'MISSING_REQUIRED_VALUE';
  message: string;
  sourcePath?: string;
}

export interface AdapterCandidate {
  supplierId: string;
  supplierProductKey: string;
  sourceSnapshotId: string;
  vehicleNodeId?: string;
  normalizedFields: Record<string, unknown>;
  issues: AdapterIssue[];
  status: 'READY' | 'REVIEW_REQUIRED';
}

export interface SupplierAdapter {
  supplierId: string;
  adapterVersion: string;
  parse(snapshot: RawSourceSnapshot): Promise<AdapterCandidate[]>;
}
