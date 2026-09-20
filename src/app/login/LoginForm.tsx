'use client';

import { FormEvent, useState } from 'react';

export function LoginForm(){
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);setError('');
    try{
      const form=new FormData(event.currentTarget);
      const csrfRes=await fetch('/api/auth/csrf',{cache:'no-store'});
      if(!csrfRes.ok)throw new Error('AUTH_NOT_CONFIGURED');
      const csrf=await csrfRes.json() as {csrfToken:string};

      const response=await fetch('/api/auth/session',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          email:String(form.get('email')||''),
          password:String(form.get('password')||''),
          csrfToken:csrf.csrfToken,
        }),
      });
      if(!response.ok)throw new Error('UNAUTHORIZED');
      window.location.href='/products';
    }catch{
      setError('로그인 정보가 맞지 않거나 관리자 권한이 없습니다.');
    }finally{
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="form-stack">
    <label>이메일<input name="email" type="email" autoComplete="username" required/></label>
    <label>비밀번호<input name="password" type="password" autoComplete="current-password" required/></label>
    {error&&<p>{error}</p>}
    <button className="primary" type="submit" disabled={busy}>{busy?'확인 중…':'로그인'}</button>
  </form>;
}
