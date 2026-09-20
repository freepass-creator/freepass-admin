import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { parseAdminAuthServiceAccount } from './config';

const APP_NAME='freepass-admin-auth';
let app:App|null=null;

export function adminAuthApp(env:NodeJS.ProcessEnv=process.env):App{
  if(app)return app;
  const existing=getApps().find((x)=>x.name===APP_NAME);
  if(existing)return(app=existing);

  const sa=parseAdminAuthServiceAccount(env);
  app=initializeApp({
    projectId:sa.project_id,
    credential:cert({
      projectId:sa.project_id,
      clientEmail:sa.client_email,
      privateKey:sa.private_key,
    }),
  },APP_NAME);
  return app;
}

export function adminFirebaseAuth(env:NodeJS.ProcessEnv=process.env):Auth{
  return getAuth(adminAuthApp(env));
}
