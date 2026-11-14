import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, API, PRIORITY_LABEL, STATUS_LABEL } from '../api';
import { Drawer, PriorityBadge } from '../components';
import { useRefreshOnEvent } from '../realtime';

const EMPTY = { from: '', to: '', category_id: '', sector: '', team_id: '', status: '' };

export default function Triage() {
  const [catalog, setCatalog] = useState<any>(null);
  const [f, setF] = useState(EMPTY); const [applied, setApplied] = useState(EMPTY);
  const [page, setPage] = useState(1); const [data, setData] = useState<{ total: number; items: any[] }>({ total: 0, items: [] });
  const [openId, setOpenId] = useState<number | null>(null); const [err, setErr] = useState('');
  const size = 15;

  const load = useCallback(() => {
    api('/occurrences', { query: { ...applied, page, size } }).then(setData).catch(e => setErr(e.message));
  }, [applied, page]);
  useEffect(() => { api('/catalog').then(setCatalog).catch(e => setErr(e.message)); }, []);
  useEffect(load, [load]); useRefreshOnEvent(load);

  const sectors: string[] = [...new Set<string>((catalog?.locations || []).map((l: any) => l.sector))];
  const set = (k: keyof typeof EMPTY) => (e: any) => setF({ ...f, [k]: e.target.value });
  const apply = (e: FormEvent) => { e.preventDefault(); setPage(1); setApplied(f); };

  return (
    <>
      <h2>Gestão e triagem de ocorrências</h2>
      {err && <div className="error" role="alert">{err}</div>}
      <form className="filters" onSubmit={apply} aria-label="Filtros">
        <label>De<input type="date" value={f.from} onChange={set('from')} /></label>
        <label>Até<input type="date" value={f.to} onChange={set('to')} /></label>
        <label>Categoria<select value={f.category_id} onChange={set('category_id')}><option value="">Todas</option>{catalog?.categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Setor<select value={f.sector} onChange={set('sector')}><option value="">Todos</option>{sectors.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Equipe<select value={f.team_id} onChange={set('team_id')}><option value="">Todas</option>{catalog?.teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Status<select value={f.status} onChange={set('status')}><option value="">Todos</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <button className="btn">Aplicar filtros</button>
        <button type="button" className="btn alt" onClick={() => { setF(EMPTY); setApplied(EMPTY); setPage(1); }}>Limpar</button>
      </form>
      <section className="panel" aria-live="polite">
        <table>
          <caption>{data.total} ocorrência(s) encontrada(s)</caption>
          <thead><tr><th scope="col">Protocolo</th><th scope="col">Prioridade</th><th scope="col">Categoria</th><th scope="col">Local</th><th scope="col">Status</th><th scope="col">Equipe</th></tr></thead>
          <tbody>{data.items.map(o => (
            <tr key={o.id}>
              <th scope="row"><button className="link" onClick={() => setOpenId(o.id)} aria-label={`Abrir detalhes de ${o.protocol}`}>{o.protocol}</button></th>
              <td><PriorityBadge p={o.priority} />{!o.priority_confirmed && <span> (sugestão)</span>}</td>
              <td>{o.category_name}</td><td>{o.floor} · {o.sector}</td><td>{STATUS_LABEL[o.status]}</td><td>{o.team_name || '—'}</td>
            </tr>))}</tbody>
        </table>
        <nav className="row" aria-label="Paginação" style={{ marginTop: '.75rem' }}>
          <button className="btn alt" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>Página {page} de {Math.max(1, Math.ceil(data.total / size))}</span>
          <button className="btn alt" disabled={page * size >= data.total} onClick={() => setPage(page + 1)}>Próxima</button>
        </nav>
      </section>
      <Detail id={openId} catalog={catalog} onClose={() => setOpenId(null)} onChanged={load} />
    </>
  );
}

function Detail({ id, catalog, onClose, onChanged }: { id: number | null; catalog: any; onClose: () => void; onChanged: () => void }) {
  const [o, setO] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [prio, setPrio] = useState('MEDIA'); const [pj, setPj] = useState(''); const [team, setTeam] = useState(''); const [tj, setTj] = useState('');
  const reload = useCallback(() => { if (id) api(`/occurrences/${id}`).then(d => { setO(d); setPrio(d.priority); setTeam(String(d.team_id || '')); }).catch(e => setErr(e.message)); }, [id]);
  useEffect(() => { setO(null); setErr(''); setOk(''); reload(); }, [reload]);
  useRefreshOnEvent(reload);

  async function act(path: string, body: any, msg: string, done: () => void) {
    setErr(''); setOk('');
    try { await api(`/occurrences/${id}/${path}`, { body }); setOk(msg); done(); reload(); onChanged(); } catch (e: any) { setErr(e.message); }
  }
  return (
    <Drawer open={id !== null} onClose={onClose} title={o ? `Ocorrência ${o.protocol}` : 'Carregando…'}>
      {err && <div className="error" role="alert">{err}</div>}
      <div role="status">{ok}</div>
      {o && (<>
        <p><PriorityBadge p={o.priority} /> {STATUS_LABEL[o.status]} · {o.category_name}</p>
        <p>{o.description}</p>
        <p>Local: {o.floor} · {o.sector} · {o.reference}<br />Solicitante: {o.requester_name}<br />Equipe: {o.team_name || 'não atribuída'}</p>
        <section className="ai-box" aria-labelledby="ia">
          <h3 id="ia">Sugestão da IA</h3>
          <p>Prioridade sugerida: <strong>{PRIORITY_LABEL[o.ai_priority] || '—'}</strong>{o.priority_confirmed ? ' (revisada pelo gestor)' : ' (aguardando confirmação)'}</p>
          <p>{o.ai_justification}</p>
        </section>
        {o.attachments.length > 0 && <section aria-label="Anexos"><h3>Anexos</h3>
          {o.attachments.map((a: any, i: number) => a.kind === 'IMAGEM'
            ? <img key={a.id} src={API + a.url} alt={`Foto ${i + 1} anexada à ocorrência`} style={{ maxWidth: '100%', marginBottom: '.5rem' }} />
            : <audio key={a.id} controls src={API + a.url} aria-label={`Áudio ${i + 1} da ocorrência`} style={{ width: '100%' }} />)}</section>}
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); act('priority', { priority: prio, justification: pj }, 'Prioridade atualizada.', () => setPj('')); }} className="filters">
          <label>Prioridade<select value={prio} onChange={e => setPrio(e.target.value)}>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Justificativa<input value={pj} onChange={e => setPj(e.target.value)} required /></label>
          <button className="btn">Confirmar prioridade</button>
        </form>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); act('assign', { team_id: Number(team), justification: tj }, 'Equipe reatribuída.', () => setTj('')); }} className="filters">
          <label>Equipe<select value={team} onChange={e => setTeam(e.target.value)}>{catalog?.teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label>Justificativa<input value={tj} onChange={e => setTj(e.target.value)} required /></label>
          <button className="btn">Reatribuir</button>
        </form>
        <h3>Histórico</h3>
        <ol className="timeline">{o.history.map((h: any) => (
          <li key={h.id}><strong>{h.kind}</strong>{h.from_value || h.to_value ? `: ${h.from_value ?? '—'} → ${h.to_value ?? '—'}` : ''}<br />
            {h.author_name} · <time dateTime={h.created_at}>{new Date(h.created_at).toLocaleString('pt-BR')}</time>{h.note && <><br />{h.note}</>}</li>))}</ol>
      </>)}
    </Drawer>
  );
}
