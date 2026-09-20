'use client';

import { useState } from 'react';

export function LogoutButton(){
  const [busy,setBusy]=useState(false);
  async function logout(){
    setBusy(true);
    try{
      await fetch('/api/auth/logout',{method:'POST'});
    }finally{
      window.location.href='/login';
    }
  }
  return <button type="button" onClick={logout} disabled={busy}>{busy?'로그아웃 중':'로그아웃'}</button>;
}
