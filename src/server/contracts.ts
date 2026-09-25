import { contracts } from './erp5';
import { ContractLifecycleService } from '../services/contracts/service';

export const contractLifecycle = new ContractLifecycleService(contracts);
