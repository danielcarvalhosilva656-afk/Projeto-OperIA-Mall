import { useEffect, useState } from 'react';
import { api, setToken, getToken, User } from './api';
import { LiveProvider } from './realtime';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MapView from './pages/MapView';
import Triage from './pages/Triage';
import Admin from './pages/Admin';

const ROUTES = [
  { id: 'dashboard', label: 'Dashboard', el: <Dashboard /> },
  { id: 'mapa', label: 'Mapa operacional', el: <MapView /> },
  { id: 'triagem', label: 'Gestão e triagem', el: <Triage /> },
  { id: 'cadastros', label: 'Cadastros', el: <Admin /> },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState(location.hash.slice(1) || 'dashboard');

  useEffect(() => {
    if (!getToken()) return setReady(true);
    api<User>('/me').then(setUser).catch(() => setToken('')).finally(() => setReady(true));
  }, []);
  useEffect(() => {
    const h = () => setRoute(location.hash.slice(1) || 'dashboard');
    addEventListener('hashchange', h); return () => removeEventListener('hashchange', h);
  }, []);
  useEffect(() => { const r = ROUTES.find(x => x.id === route); if (r) document.title = `${r.label} — OperIA Mall`; }, [route]);

  if (!ready) return <p role="status">Carregando…</p>;
  if (!user) return <Login onLogin={setUser} />;
  const current = ROUTES.find(r => r.id === route) || ROUTES[0];

  return (
    <LiveProvider>
      <a className="skip" href="#conteudo">Ir para o conteúdo principal</a>
      <div className="shell">
        <header className="side">
          <h1>OperIA Mall</h1>
          <nav aria-label="Principal">
            <ul>{ROUTES.map(r => (
              <li key={r.id}><a href={'#' + r.id} aria-current={r.id === current.id ? 'page' : undefined}>{r.label}</a></li>
            ))}</ul>
          </nav>
          <p>{user.name}</p>
          <button className="btn alt" onClick={() => { setToken(''); setUser(null); }}>Sair</button>
        </header>
        <main id="conteudo" tabIndex={-1}>{current.el}</main>
      </div>
    </LiveProvider>
  );
}
