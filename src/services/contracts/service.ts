import type { ContractTerminationInput } from '../../domain/contracts/termination';
import type { ContractLifecycleRepository } from '../../ports/contracts/repositories';

export class ContractLifecycleService {
  constructor(private repo: ContractLifecycleRepository) {}

  async terminate(contractId: string, input: ContractTerminationInput, actor = 'freepass-admin') {
    if (!contractId.trim()) throw new Error('계약 ID가 없습니다.');
    return this.repo.terminateContract(contractId.trim(), {
      effectiveDate: input.effectiveDate.trim(),
      reason: input.reason.trim(),
      operationId: input.operationId.trim(),
    }, actor);
  }
}
