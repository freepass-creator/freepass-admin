import { esignAssets, esignRepository } from '../adapters/erp5/esign-repository';
import { EsignService } from '../services/esign/service';

export const esign = new EsignService(esignRepository, esignAssets);
