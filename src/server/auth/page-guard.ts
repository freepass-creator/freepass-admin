import { redirect } from 'next/navigation';
import { requireAdminSessionActor } from './session';

export async function requireAdminPageActor(){
  try{
    return await requireAdminSessionActor();
  }catch{
    redirect('/login');
  }
}
