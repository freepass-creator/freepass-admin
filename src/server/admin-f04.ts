import { Erp5F04RowLinkRepository } from '../adapters/erp5/f04-row-link-repository';
import { FileF04RowLinkRepository } from '../adapters/store/f04-row-link-repository';
import type { F04RowLinkRepository } from '../ports/legacy-f04';
import { adminRuntimeMode } from './admin-runtime';

export function adminF04RowLinks(
  env:NodeJS.ProcessEnv=process.env,
):F04RowLinkRepository{
  const mode=adminRuntimeMode(env);
  if(mode==='ERP5')return new Erp5F04RowLinkRepository();
  if(mode==='FILE_DEV')return new FileF04RowLinkRepository(env.FPA_DATA_DIR);
  throw new Error('ADMIN_PRODUCTION_F04_LINK_STORE_NOT_BOUND');
}
