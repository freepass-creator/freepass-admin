import { Erp5ProductRepository } from '../src/adapters/erp5/product-repository';
import { freePassDataProductRepositoryFromEnv } from '../src/adapters/freepass-data/product-repository';
import { compareProductSources, parityClean } from '../src/services/product-source-parity';

const legacy=new Erp5ProductRepository();
const data=freePassDataProductRepositoryFromEnv(process.env);

const [legacyProducts,dataProducts]=await Promise.all([
  legacy.list(),
  data.list(),
]);

const report=compareProductSources(legacyProducts,dataProducts);
const output={
  ...report,
  checkedAt:new Date().toISOString(),
  legacySource:'ERP5_DIRECT',
  dataSource:'FREEPASS_DATA_ADMIN_CATALOG_V1',
  clean:parityClean(report),
};

console.log(JSON.stringify(output,null,2));

if(String(process.env.FPA_DATA_SHADOW_STRICT||'').trim()==='on'&&!output.clean){
  process.exitCode=1;
}
