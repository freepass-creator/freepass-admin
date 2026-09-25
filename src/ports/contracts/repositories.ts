import type { ContractTerminationInput } from '../../domain/contracts/termination';

export interface ContractLifecycleRepository {
  terminateContract(
    contractId: string,
    input: ContractTerminationInput,
    actor: string,
  ): Promise<{ terminated: boolean; effectiveDate: string; reason: string }>;
}
