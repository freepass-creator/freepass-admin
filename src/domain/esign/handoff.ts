import { sha256 } from './snapshot';
import type { ContractHandoffSource } from './types';

export type ContractHandoffSourceCore = Omit<ContractHandoffSource, 'sourceDigest'>;

export function contractHandoffDigest(source: ContractHandoffSourceCore): string {
  return sha256(JSON.stringify({
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
  }));
}

export function withContractHandoffDigest(source: ContractHandoffSourceCore): ContractHandoffSource {
  return { ...source, sourceDigest: contractHandoffDigest(source) };
}
