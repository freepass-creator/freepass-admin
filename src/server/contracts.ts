import { contracts } from './freepass-data';
import { ContractLifecycleService } from '../services/contracts/service';

export const contractLifecycle = new ContractLifecycleService(contracts);
