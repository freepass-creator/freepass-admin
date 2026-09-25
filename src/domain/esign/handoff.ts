import { sha256 } from './snapshot';
import type { ContractHandoffSource } from './types';

export type ContractHandoffSourceCore = Omit<ContractHandoffSource, 'sourceDigest'>;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonical(child)]),
    );
  }
  return value;
}

export function contractHandoffDigest(source: ContractHandoffSourceCore): string {
  return sha256(JSON.stringify(canonical({
    intakeId: source.intakeId,
    customerName: source.customerName,
    vehicleName: source.vehicleName,
    plate: source.plate,
    supplierCode: source.supplierCode,
    supplierName: source.supplierName,
    rent: source.rent,
    termMonths: source.termMonths,
    deposit: source.deposit,
    sourceProductId: source.sourceProductId,
    sourceProductVersion: source.sourceProductVersion,
    sourceOfferId: source.sourceOfferId,
    sourceSnapshotId: source.sourceSnapshotId,
    catalogSnapshot: source.catalogSnapshot,
  })));
}

export function withContractHandoffDigest(source: ContractHandoffSourceCore): ContractHandoffSource {
  return { ...source, sourceDigest: contractHandoffDigest(source) };
}
