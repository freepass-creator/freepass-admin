import { Erp5ContractRepository } from '../adapters/erp5/contract-repository';
import { ContractLifecycleService } from '../services/contracts/service';

export const contractLifecycle = new ContractLifecycleService(new Erp5ContractRepository());
