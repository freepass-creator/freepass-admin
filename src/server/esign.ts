import { esignFinalDocumentRenderer } from '../adapters/esign/puppeteer-final-document-renderer';
import { esignAssets, esignRepository } from './freepass-data';
import { EsignService } from '../services/esign/service';

export const esign = new EsignService(esignRepository, esignAssets, esignFinalDocumentRenderer);
