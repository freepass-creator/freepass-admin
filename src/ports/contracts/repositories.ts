import type { ContractTerminationInput } from '../../domain/contracts/termination';
import type { ContractCancellationInput } from '../../domain/contracts/cancellation';

export interface ContractLifecycleRepository {
  cancelContract(
    contractId: string,
    input: ContractCancellationInput,
    actor: string,
  ): Promise<{ cancelled: boolean; reason: string }>;
  terminateContract(
    contractId: string,
    input: ContractTerminationInput,
    actor: string,
  ): Promise<{ terminated: boolean; effectiveDate: string; reason: string }>;
}
