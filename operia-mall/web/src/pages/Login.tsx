import { FormEvent, useState } from 'react';
import { api, setToken, User } from '../api';

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [login, setLogin] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api<{ token: string; user: User }>('/auth/login', { body: { login, password } });
      if (r.user.role !== 'ADMIN') throw new Error('Acesso restrito à Administração. Use o aplicativo móvel.');
      setToken(r.token); onLogin(r.user);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <main>
      <form className="login" onSubmit={submit} aria-labelledby="t" noValidate>
        <h1 id="t">OperIA Mall — acesso gerencial</h1>
        {err && <div className="error" role="alert">{err}</div>}
        <label>E-mail ou matrícula
          <input value={login} onChange={e => setLogin(e.target.value)} autoComplete="username" required aria-invalid={!!err} />
        </label>
        <label>Senha
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required aria-invalid={!!err} />
        </label>
        <button className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
