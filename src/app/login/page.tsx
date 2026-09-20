import { adminAuthMode } from '../../server/auth/config';
import { LoginForm } from './LoginForm';

export const dynamic='force-dynamic';

export default function LoginPage(){
  const mode=adminAuthMode();
  return <main className="admin-shell">
    <header className="topbar"><div><strong>freepasserp.com</strong><span>admin</span></div><div/><div className="admin-user">LOGIN</div></header>
    <section className="workspace">
      <section className="panel"/>
      <section className="panel detail-panel">
        <div className="panel-head"><div><p className="eyebrow">ADMIN</p><h1>관리자 로그인</h1></div></div>
        {mode==='FIREBASE'
          ?<LoginForm/>
          :<p>{mode==='DEV'?'개발 모드에서는 dev actor를 사용합니다.':'운영 Auth가 아직 연결되지 않았습니다.'}</p>}
      </section>
      <section className="panel"/>
    </section>
  </main>;
}
