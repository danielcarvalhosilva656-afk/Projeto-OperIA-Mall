import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { Tabs } from '../components';

const TABS = [{ id: 'usuarios', label: 'Usuários' }, { id: 'equipes', label: 'Equipes' }, { id: 'locais', label: 'Localizações' }, { id: 'categorias', label: 'Categorias' }];
const ROLES = ['ADMIN', 'MANUTENCAO', 'LIMPEZA', 'SEGURANCA'];
const SPECIALTIES = ['MANUTENCAO', 'LIMPEZA', 'SEGURANCA'];

export default function Admin() {
  const [tab, setTab] = useState('usuarios'); const [users, setUsers] = useState<any[]>([]); const [cat, setCat] = useState<any>(null);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const load = () => { api('/admin/users').then(setUsers).catch(e => setErr(e.message)); api('/catalog').then(setCat).catch(e => setErr(e.message)); };
  useEffect(load, []);
  const run = async (fn: () => Promise<any>, msg: string) => { setErr(''); setOk(''); try { await fn(); setOk(msg); load(); return true; } catch (e: any) { setErr(e.message); return false; } };
  const toggleTeam = (t: any) => run(() => api(`/admin/teams/${t.id}`, { method: 'PATCH', body: { available: !t.available } }), `Equipe ${t.name} atualizada.`);
  const toggleUser = (u: any) => run(() => api(`/admin/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }), `Acesso de ${u.name} atualizado.`);
  const anonymize = (u: any) => { if (confirm(`Anonimizar ${u.name}? Esta ação é irreversível (LGPD).`)) run(() => api(`/admin/users/${u.id}/anonymize`, { method: 'POST', body: {} }), 'Usuário anonimizado.'); };

  return (
    <>
      <h2>Cadastros e configurações</h2>
      {err && <div className="error" role="alert">{err}</div>}
      <div role="status">{ok}</div>
      <Tabs tabs={TABS} active={tab} onChange={t => { setTab(t); setErr(''); setOk(''); }}>
        <div className="panel">
          {tab === 'usuarios' && <>
            <NewUser teams={cat?.teams || []} onSubmit={(b, reset) => run(() => api('/admin/users', { body: b }), 'Usuário criado.').then(o => o && reset())} />
            <table><caption className="sr-only">Usuários cadastrados</caption><thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Matrícula</th><th scope="col">Perfil</th><th scope="col">Equipe</th><th scope="col">Ações</th></tr></thead>
              <tbody>{users.map(u => <tr key={u.id}><th scope="row">{u.name}</th><td>{u.email}</td><td>{u.registration}</td><td>{u.role}</td><td>{u.team_name || '—'}</td>
                <td className="row"><button className="btn alt" onClick={() => toggleUser(u)}>{u.active ? 'Desativar' : 'Reativar'}<span className="sr-only"> {u.name}</span></button>
                  <button className="btn alt" onClick={() => anonymize(u)}>Anonimizar<span className="sr-only"> {u.name}</span></button></td></tr>)}</tbody></table></>}
          {tab === 'equipes' && cat && <table><caption className="sr-only">Equipes e disponibilidade</caption><thead><tr><th scope="col">Equipe</th><th scope="col">Especialidade</th><th scope="col">Disponibilidade</th></tr></thead>
            <tbody>{cat.teams.map((t: any) => <tr key={t.id}><th scope="row">{t.name}</th><td>{t.specialty}</td>
              <td><button className="btn alt" aria-pressed={t.available} onClick={() => toggleTeam(t)}>{t.available ? 'Disponível' : 'Indisponível'}<span className="sr-only"> — {t.name}</span></button></td></tr>)}</tbody></table>}
          {tab === 'locais' && cat && <>
            <NewLocation onSubmit={(b, reset) => run(() => api('/admin/locations', { body: b }), 'Localização criada.').then(o => o && reset())} />
            <table><caption className="sr-only">Localizações internas</caption><thead><tr><th scope="col">Piso</th><th scope="col">Setor</th><th scope="col">Referência</th></tr></thead>
              <tbody>{cat.locations.map((l: any) => <tr key={l.id}><th scope="row">{l.floor}</th><td>{l.sector}</td><td>{l.reference}</td></tr>)}</tbody></table></>}
          {tab === 'categorias' && cat && <>
            <NewCategory onSubmit={(b, reset) => run(() => api('/admin/categories', { body: b }), 'Categoria criada.').then(o => o && reset())} />
            <table><caption className="sr-only">Categorias e regras de encaminhamento</caption><thead><tr><th scope="col">Categoria</th><th scope="col">SLA (min)</th><th scope="col">Encaminhar para</th></tr></thead>
              <tbody>{cat.categories.map((c: any) => <tr key={c.id}><th scope="row">{c.name}</th><td>{c.sla_minutes}</td><td>{c.default_specialty}</td></tr>)}</tbody></table></>}
        </div>
      </Tabs>
    </>
  );
}

type Sub = (body: any, reset: () => void) => void;

function NewUser({ teams, onSubmit }: { teams: any[]; onSubmit: Sub }) {
  const init = { name: '', email: '', registration: '', password: '', role: 'MANUTENCAO', team_id: '' };
  const [f, setF] = useState(init); const set = (k: keyof typeof init) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit({ ...f, team_id: f.team_id ? Number(f.team_id) : null }, () => setF(init)); };
  return (
    <form className="filters" onSubmit={submit} aria-label="Novo usuário">
      <label>Nome<input value={f.name} onChange={set('name')} required minLength={2} /></label>
      <label>E-mail<input type="email" value={f.email} onChange={set('email')} required /></label>
      <label>Matrícula<input value={f.registration} onChange={set('registration')} required /></label>
      <label>Senha inicial (mín. 8)<input type="password" value={f.password} onChange={set('password')} required minLength={8} autoComplete="new-password" /></label>
      <label>Perfil<select value={f.role} onChange={set('role')}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></label>
      <label>Equipe<select value={f.team_id} onChange={set('team_id')}><option value="">Sem equipe</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <button className="btn">Criar usuário</button>
    </form>
  );
}
function NewLocation({ onSubmit }: { onSubmit: Sub }) {
  const init = { floor: '', sector: '', reference: '', x: '50', y: '50' };
  const [f, setF] = useState(init); const set = (k: keyof typeof init) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="filters" aria-label="Nova localização" onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit({ ...f, x: Number(f.x), y: Number(f.y) }, () => setF(init)); }}>
      <label>Piso<input value={f.floor} onChange={set('floor')} required /></label>
      <label>Setor<input value={f.sector} onChange={set('sector')} required /></label>
      <label>Ponto de referência<input value={f.reference} onChange={set('reference')} required /></label>
      <label>Posição horizontal na planta (0–100)<input type="number" min={0} max={100} value={f.x} onChange={set('x')} required /></label>
      <label>Posição vertical na planta (0–100)<input type="number" min={0} max={100} value={f.y} onChange={set('y')} required /></label>
      <button className="btn">Criar localização</button>
    </form>
  );
}
function NewCategory({ onSubmit }: { onSubmit: Sub }) {
  const init = { name: '', sla_minutes: '60', default_specialty: 'MANUTENCAO' };
  const [f, setF] = useState(init); const set = (k: keyof typeof init) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="filters" aria-label="Nova categoria" onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit({ ...f, sla_minutes: Number(f.sla_minutes) }, () => setF(init)); }}>
      <label>Nome<input value={f.name} onChange={set('name')} required minLength={2} /></label>
      <label>SLA em minutos<input type="number" min={1} value={f.sla_minutes} onChange={set('sla_minutes')} required /></label>
      <label>Encaminhar para<select value={f.default_specialty} onChange={set('default_specialty')}>{SPECIALTIES.map(s => <option key={s}>{s}</option>)}</select></label>
      <button className="btn">Criar categoria</button>
    </form>
  );
}
